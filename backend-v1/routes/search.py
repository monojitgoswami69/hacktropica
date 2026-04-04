"""Search, RAG query (streaming + non-streaming), and query stats tracking."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, List, Optional

import pytz
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from models.search import SearchRequest, SearchResponse, SearchResult, QueryRequest
from dependencies import (
    get_db, get_vector_store, get_embedding_service, get_llm_service,
    get_current_user, get_optional_user,
)

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are **Vidyarthi Saarthi**, an AI academic assistant for college students.

Rules:
1. Answer ONLY from the provided study material. If the material doesn't cover the topic, say so clearly.
2. Be detailed, well-structured, and use markdown formatting (headings, bullet points, code blocks).
3. Cite sections when possible (e.g. "According to Module 3…").
4. For technical subjects, include diagrams described in text or code examples where appropriate.
5. Be encouraging but accurate — never fabricate information."""

router = APIRouter(prefix="/api/v1", tags=["search"])


# ── Query Stats Tracking ─────────────────────────────────────────────

async def _track_query_stats(db, uid: str, search_results: list, vs) -> None:
    """
    Fire-and-forget update of per-user query analytics.
    Tracks: total_queries, by_subject, by_module, daily_queries.
    Compatible with the analytics dashboard ported from v2.
    """
    try:
        ist = pytz.timezone("Asia/Kolkata")
        today = datetime.now(ist).strftime("%Y-%m-%d")

        inc_fields: Dict[str, int] = {
            "total_queries": 1,
            f"daily_queries.{today}": 1,
        }
        set_fields: Dict[str, str] = {}

        subjects_seen: set = set()
        modules_seen: set = set()

        for chunk_id, _score in search_results:
            chunk = vs.get_chunk(chunk_id)
            if not chunk:
                continue

            # Per-subject tracking
            if chunk.subject and chunk.subject not in subjects_seen:
                safe_subj = chunk.subject.replace(".", "_").replace("/", "_")
                inc_fields[f"by_subject.{safe_subj}"] = (
                    inc_fields.get(f"by_subject.{safe_subj}", 0) + 1
                )
                subjects_seen.add(chunk.subject)

            # Per-module tracking
            if chunk.document_id and chunk.document_id not in modules_seen:
                safe_doc = chunk.document_id.replace(".", "_").replace("/", "_")
                set_fields[f"by_module.{safe_doc}.subject"] = chunk.subject or ""
                set_fields[f"by_module.{safe_doc}.title"] = chunk.title or chunk.source or ""
                inc_fields[f"by_module.{safe_doc}.queries"] = (
                    inc_fields.get(f"by_module.{safe_doc}.queries", 0) + 1
                )
                modules_seen.add(chunk.document_id)

        update: Dict = {"$inc": inc_fields}
        if set_fields:
            update["$set"] = set_fields

        await db.db.query_stats.update_one({"_id": uid}, update, upsert=True)
    except Exception as exc:
        logger.warning("Failed to track query stats: %s", exc)


# ── Common RAG helpers ────────────────────────────────────────────────

async def _run_rag_pipeline(body: QueryRequest, vs, emb):
    """Shared pipeline: embed → search → build context. Returns (results, context, sources)."""
    query_vec = await emb.encode(body.query)

    filters = None
    if body.filters:
        filters = {k: v for k, v in body.filters.model_dump().items() if v}

    results = await vs.search(query_vec, k=body.top_k, filters=filters or None)

    context_parts, sources = [], []
    for chunk_id, score in results:
        chunk = vs.get_chunk(chunk_id)
        if not chunk:
            continue
        context_parts.append(f"[{chunk.source}] {chunk.text}")
        sources.append({
            "source": chunk.source,
            "title": chunk.title,
            "score": round(score, 4),
            "document_id": chunk.document_id,
        })

    context = "\n\n---\n\n".join(context_parts)
    return results, context, sources


def _build_messages(body: QueryRequest, context: str) -> list:
    """Build the LLM message list with history + augmented query."""
    messages = []
    if body.history:
        for h in body.history[-10:]:
            messages.append({"role": h.role, "content": h.content})

    augmented = f"""Answer the following question using ONLY the provided study material.

**Question:** {body.query}

**Study Material:**
{context}"""
    messages.append({"role": "user", "content": augmented})
    return messages


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/search", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    user=Depends(get_current_user),
    vs=Depends(get_vector_store),
    emb=Depends(get_embedding_service),
):
    t0 = time.perf_counter()
    query_vec = await emb.encode(body.query)

    filters = None
    if body.filters:
        filters = {k: v for k, v in body.filters.model_dump().items() if v}

    results = await vs.search(query_vec, k=body.top_k, filters=filters or None)

    search_results = []
    for chunk_id, score in results:
        chunk = vs.get_chunk(chunk_id)
        if not chunk:
            continue
        search_results.append(SearchResult(
            chunk_id=chunk_id,
            text=chunk.text,
            score=round(score, 4),
            source=chunk.source,
            title=chunk.title,
            semester=chunk.semester,
            stream=chunk.stream,
            subject=chunk.subject,
            document_id=chunk.document_id,
            page_start=chunk.page_start,
            page_end=chunk.page_end,
        ))

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    return SearchResponse(
        results=search_results,
        query=body.query,
        total_results=len(search_results),
        timing={"total_ms": elapsed},
    )


@router.post("/query")
async def query_sync(
    body: QueryRequest,
    user=Depends(get_current_user),
    vs=Depends(get_vector_store),
    emb=Depends(get_embedding_service),
    llm=Depends(get_llm_service),
    db=Depends(get_db),
):
    """
    Non-streaming RAG query — returns the full answer in a single JSON response.
    Tracks per-user query stats for the analytics dashboard.
    """
    results, context, sources = await _run_rag_pipeline(body, vs, emb)
    messages = _build_messages(body, context)

    # Generate full response (sync generator consumed in thread pool)
    full_response = await asyncio.to_thread(
        lambda: "".join(llm.stream_chat_sync(messages, system_instruction=SYSTEM_INSTRUCTION))
    )

    # Fire-and-forget query stats tracking
    asyncio.create_task(_track_query_stats(db, user["_id"], results, vs))

    # Persist to session if provided
    if body.session_id:
        asyncio.create_task(_save_message(db, user["_id"], body.session_id, body.query, full_response))

    return {
        "answer": full_response,
        "sources": sources,
        "query": body.query,
    }


@router.post("/query/stream")
async def query_stream(
    body: QueryRequest,
    user=Depends(get_optional_user),
    vs=Depends(get_vector_store),
    emb=Depends(get_embedding_service),
    llm=Depends(get_llm_service),
    db=Depends(get_db),
):
    """RAG query with streaming response. Auth is optional (graceful degradation)."""
    results, context, sources = await _run_rag_pipeline(body, vs, emb)
    messages = _build_messages(body, context)

    def generate():
        for chunk in llm.stream_chat_sync(messages, system_instruction=SYSTEM_INSTRUCTION):
            yield chunk

        # Append source block
        if sources:
            yield "\n\n---\n📚 **Sources:**\n"
            seen = set()
            for s in sources:
                key = s["source"]
                if key not in seen:
                    seen.add(key)
                    title = s.get("title") or key
                    yield f"- {title} (relevance: {s['score']})\n"

    # Fire-and-forget stats + session persistence
    if user:
        asyncio.create_task(_track_query_stats(db, user["_id"], results, vs))
        if body.session_id:
            asyncio.create_task(_save_message(db, user["_id"], body.session_id, body.query))

    return StreamingResponse(generate(), media_type="text/plain")


# ── Session persistence helper ────────────────────────────────────────

async def _save_message(db, uid: str, session_id: str, query: str, answer: str = ""):
    """Persist query (and optionally answer) to session history."""
    try:
        now = datetime.utcnow()
        messages_to_push = [{"role": "user", "content": query, "ts": now}]
        if answer:
            messages_to_push.append({"role": "assistant", "content": answer, "ts": now})

        await db.db.sessions.update_one(
            {"_id": session_id, "uid": uid},
            {
                "$push": {"messages": {"$each": messages_to_push}},
                "$set": {"updated_at": now},
                "$setOnInsert": {"created_at": now, "title": query[:60]},
            },
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Failed to save message: %s", exc)
