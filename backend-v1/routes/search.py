"""Search, RAG query (streaming + non-streaming), and query stats tracking."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional

import pytz
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from google.genai import types as genai_types

from models.search import (
    SearchRequest, SearchResponse, SearchResult, QueryRequest, TutorResponse,
)
from dependencies import (
    get_db, get_vector_store, get_embedding_service, get_llm_service,
    get_current_user, get_optional_user,
)

logger = logging.getLogger(__name__)

# ── System Instruction ────────────────────────────────────────────────

SYSTEM_INSTRUCTION = """You are Vidyarthi Saarthi, a Socratic tutor for college students.

## CRITICAL RULES

1. **ONLY answer using Reference Material below.** If empty or irrelevant → refuse: "I don't have information about this in your course materials."
2. **USE SOCRATIC METHOD by default.** Ask probing questions to guide discovery. Don't give direct answers unless:
   - Student explicitly requests it ("just tell me", "explain directly")
   - Student answered your questions (reward effort)
   - Purely factual query (syntax, definitions)
   - Student is frustrated
3. **Teach naturally.** Never mention "provided context", "material", "sources", or reveal how you access information.
4. **Be concise.** Match length to question. Greeting → 1 line. Socratic → 1-2 questions. Direct → focused explanation.
5. **Never invent.** Only use Reference Material. If aspect not covered → say so.

## Socratic Examples

**Concept:** "What is polymorphism?"
→ "What does 'poly' mean? And 'morph'? How might they combine in programming?"

**Problem:** "How does a linked list work?"
→ "In arrays, elements are adjacent in memory. What problem does that cause for insertions?"

**Comparison:** "Stack vs queue?"
→ "When you stack plates, which comes off first? What about a ticket queue?"

## Direct Answer Format
When giving direct answers:
- Use headings, bullets, code blocks for clarity
- Stay grounded in Reference Material
- Keep it focused, no filler
- Acknowledge good reasoning: "Exactly!", "You're on track"

## Refusal Format
- No Reference Material → "I don't have information about this in your course materials."
- Topic not covered → "This specific aspect isn't covered in your course materials."

**Remember:** Socratic method is your PRIMARY mode. Make students think and discover.
"""


def _build_system_instruction(context_block: str) -> str:
    """Combine the base instruction with the structured context block."""
    if not context_block.strip():
        return SYSTEM_INSTRUCTION + "\n\n## Reference Material\n(EMPTY - No relevant course content available. You MUST refuse to answer.)\n"

    return (
        SYSTEM_INSTRUCTION
        + "\n\n## Reference Material\n(Internal — not visible to the student. Use ONLY this information to answer. If the answer isn't here, refuse to answer.)\n\n"
        + context_block
        + "\n"
    )


router = APIRouter(prefix="/api/v1", tags=["search"])


# ── Query Stats Tracking ─────────────────────────────────────────────

async def _track_query_stats(db, uid: str, search_results: list, vs) -> None:
    """
    Fire-and-forget update of:
      1. Global daily_queries counter
      2. Per-student query_stats (by_subject, by_module, daily_queries)
      3. Global stream-level stream_hit_counts (by_subject, by_module) — shared
         across all students in the same stream, not tied to any individual student.
    
    CRITICAL: Uses the TOP chunk (highest similarity) to determine subject/stream/module.
    This ensures we track based on what was actually used in the response.
    """
    try:
        logger.info(f"🔍 TRACKING: Starting for uid={uid}, results_count={len(search_results)}")
        
        if not search_results:
            logger.warning(f"⚠️ TRACKING: No search results to track for uid={uid}")
            return
        
        ist = pytz.timezone("Asia/Kolkata")
        today = datetime.now(ist).strftime("%Y-%m-%d")
        logger.info(f"📅 TRACKING: Today={today}")

        # 1. Global daily counter - ALWAYS increment
        result = await db.db.daily_queries.update_one(
            {"date": today},
            {"$inc": {"count": 1}},
            upsert=True,
        )
        logger.info(f"✅ TRACKING: Daily counter updated - matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")

        # ── Get the TOP chunk (highest similarity) for metadata ───────────
        top_chunk_id, top_score = search_results[0]
        top_chunk = vs.get_chunk(top_chunk_id)
        
        if not top_chunk:
            logger.error(f"❌ TRACKING: Top chunk {top_chunk_id} not found in vector store!")
            return
        
        logger.info(f"🎯 TRACKING: Top chunk - subject={top_chunk.subject}, module={top_chunk.module}, title={top_chunk.title}, doc_id={top_chunk.document_id}, score={top_score:.4f}")
        
        # Verify chunk has required metadata
        if not top_chunk.subject:
            logger.error(f"❌ TRACKING: Top chunk {top_chunk_id} has NO SUBJECT! This is a critical metadata issue.")
            logger.error(f"   Chunk details: doc_id={top_chunk.document_id}, title={top_chunk.title}, source={top_chunk.source}")
            # Still track the query, but without subject/module details
        
        if not top_chunk.stream:
            logger.warning(f"⚠️ TRACKING: Top chunk {top_chunk_id} has NO STREAM! doc_id={top_chunk.document_id}")
        
        # ── Collect subject/module data from TOP chunk only ───────────
        inc_fields: Dict[str, int] = {
            "total_queries": 1,
            f"daily_queries.{today}": 1,
        }
        set_fields: Dict[str, str] = {}
        
        # Track subject from top chunk
        if top_chunk.subject:
            safe_subj = top_chunk.subject.replace(".", "_").replace("/", "_").replace(" ", "_")
            inc_fields[f"by_subject.{safe_subj}"] = 1
            logger.info(f"➕ TRACKING: Subject={top_chunk.subject} (sanitized: {safe_subj})")
        
        # Track module from top chunk
        if top_chunk.document_id:
            safe_doc = top_chunk.document_id.replace(".", "_").replace("/", "_")
            set_fields[f"by_module.{safe_doc}.subject"] = top_chunk.subject or "Unknown"
            set_fields[f"by_module.{safe_doc}.title"] = top_chunk.title or top_chunk.source or "Unknown"
            inc_fields[f"by_module.{safe_doc}.queries"] = 1
            logger.info(f"➕ TRACKING: Module={top_chunk.document_id} (title: {top_chunk.title})")

        # 2. Per-student query_stats
        update: Dict = {"$inc": inc_fields}
        if set_fields:
            update["$set"] = set_fields

        logger.info(f"💾 TRACKING: Updating query_stats for uid={uid}")
        logger.info(f"   Inc fields: {inc_fields}")
        logger.info(f"   Set fields: {set_fields}")
        
        result = await db.db.query_stats.update_one({"_id": uid}, update, upsert=True)
        logger.info(f"✅ TRACKING: query_stats updated - matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")

        # 3. Global stream-level hit counters (stream_hit_counts)
        #    Use stream from CHUNK metadata first, fallback to student profile
        try:
            chunk_stream = (top_chunk.stream or "").strip().lower()
            
            # Fallback to student profile if chunk doesn't have stream
            if not chunk_stream:
                logger.warning(f"⚠️ TRACKING: Chunk has no stream, checking student profile")
                profile = await db.db.student_profiles.find_one({"_id": uid}, {"stream": 1})
                logger.info(f"👤 TRACKING: Profile lookup - found={profile is not None}")
                chunk_stream = (profile.get("stream", "") if profile else "").strip().lower()
            
            logger.info(f"🎓 TRACKING: Using stream={chunk_stream}")

            if chunk_stream:
                stream_inc: Dict[str, int] = {"total_queries": 1}
                stream_set: Dict[str, str] = {}

                # Track subject for stream
                if top_chunk.subject:
                    safe_subj = top_chunk.subject.replace(".", "_").replace("/", "_").replace(" ", "_")
                    stream_inc[f"by_subject.{safe_subj}"] = 1

                # Track module for stream
                if top_chunk.document_id:
                    safe_doc = top_chunk.document_id.replace(".", "_").replace("/", "_")
                    stream_set[f"by_module.{safe_doc}.subject"] = top_chunk.subject or "Unknown"
                    stream_set[f"by_module.{safe_doc}.title"] = top_chunk.title or top_chunk.source or "Unknown"
                    stream_inc[f"by_module.{safe_doc}.queries"] = 1

                stream_update: Dict = {"$inc": stream_inc}
                if stream_set:
                    stream_update["$set"] = stream_set

                logger.info(f"💾 TRACKING: Updating stream_hit_counts for stream={chunk_stream}")
                logger.info(f"   Stream inc: {stream_inc}")
                logger.info(f"   Stream set: {stream_set}")
                
                result = await db.db.stream_hit_counts.update_one(
                    {"_id": chunk_stream},
                    stream_update,
                    upsert=True,
                )
                logger.info(f"✅ TRACKING: stream_hit_counts updated - matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")
            else:
                logger.error(f"❌ TRACKING: No stream found in chunk OR student profile for uid={uid}")
        except Exception as stream_exc:
            logger.error(f"❌ TRACKING: Stream update failed: {stream_exc}", exc_info=True)

        logger.info(f"✅ TRACKING: Completed successfully for uid={uid}")
    except Exception as exc:
        logger.error(f"❌ TRACKING: Failed for uid={uid}: {exc}", exc_info=True)


# ── Common RAG helpers ────────────────────────────────────────────────

async def _run_rag_pipeline(body: QueryRequest, vs, emb):
    """
    Shared pipeline: embed → search → build structured context.
    Returns (results, context_block, source_titles).
    """
    query_vec = await emb.encode(body.query)

    filters = None
    if body.filters:
        filters = {k: v for k, v in body.filters.model_dump().items() if v}

    results = await vs.search(query_vec, k=body.top_k, filters=filters or None)

    # Build structured context blocks
    context_parts = []
    source_titles: list[str] = []
    seen_titles: set[str] = set()

    for chunk_id, score in results:
        chunk = vs.get_chunk(chunk_id)
        if not chunk:
            continue
        title = chunk.title or chunk.source or "Unknown"
        context_parts.append(
            f"### Source: {title}\n"
            f"- **Similarity:** {score:.4f}\n"
            f"- **Content:**\n{chunk.text}"
        )
        if title not in seen_titles:
            seen_titles.add(title)
            source_titles.append(title)

    context_block = "\n\n---\n\n".join(context_parts)
    return results, context_block, source_titles


def _build_history(body: QueryRequest) -> List[genai_types.Content]:
    """Convert chat history from the request into Gemini Content objects."""
    contents = []
    if body.history:
        for h in body.history[-10:]:
            role = "user" if h.role == "user" else "model"
            contents.append(
                genai_types.Content(role=role, parts=[genai_types.Part(text=h.content)])
            )
    return contents


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
            module=chunk.module,
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
    Non-streaming RAG query — LLM returns structured JSON with answer + sources.
    """
    results, context_block, source_titles = await _run_rag_pipeline(body, vs, emb)
    system_instruction = _build_system_instruction(context_block)
    history = _build_history(body)

    # Structured output: LLM returns {answer, sources}
    parsed = await llm.generate_chat_structured_async(
        body.query,
        system_instruction=system_instruction,
        history=history,
        response_schema=TutorResponse.model_json_schema(),
    )

    answer = parsed.get("answer", "")
    sources = parsed.get("sources", [])

    # Fire-and-forget with error handling
    uid = user["_id"]
    logger.info(f"🎯 /query endpoint: uid={uid}, results={len(results)}, session={body.session_id}")
    
    # Create tasks and keep references to prevent garbage collection
    tracking_task = asyncio.create_task(_track_query_stats(db, uid, results, vs))
    tracking_task.add_done_callback(lambda t: logger.info(f"✅ Tracking task completed for {uid}") if not t.exception() else logger.error(f"❌ Tracking task failed: {t.exception()}"))
    
    if body.session_id:
        save_task = asyncio.create_task(_save_message(db, uid, body.session_id, body.query, answer))
        save_task.add_done_callback(lambda t: logger.info(f"✅ Save task completed") if not t.exception() else logger.error(f"❌ Save task failed: {t.exception()}"))

    return {"answer": answer, "sources": sources, "query": body.query}


@router.post("/query/stream")
async def query_stream(
    body: QueryRequest,
    user=Depends(get_optional_user),
    vs=Depends(get_vector_store),
    emb=Depends(get_embedding_service),
    llm=Depends(get_llm_service),
    db=Depends(get_db),
):
    """
    Streaming RAG query using NDJSON protocol.
    Each line is a JSON object:
      {"type":"chunk","text":"..."}   — streamed answer text
      {"type":"done","sources":[...]} — final event with LLM-determined sources
    """
    results, context_block, source_titles = await _run_rag_pipeline(body, vs, emb)
    system_instruction = _build_system_instruction(context_block)
    history = _build_history(body)

    # Get full structured response from LLM
    parsed = await llm.generate_chat_structured_async(
        body.query,
        system_instruction=system_instruction,
        history=history,
        response_schema=TutorResponse.model_json_schema(),
    )

    answer = parsed.get("answer", "")
    sources = parsed.get("sources", [])

    async def generate():
        # Stream the answer text in chunks
        chunk_size = 12
        for i in range(0, len(answer), chunk_size):
            yield json.dumps({"type": "chunk", "text": answer[i:i + chunk_size]}) + "\n"
            await asyncio.sleep(0.015)

        # Final event with sources
        yield json.dumps({"type": "done", "sources": sources}) + "\n"

    # Fire-and-forget stats + session persistence
    if user:
        uid = user["_id"]
        logger.info(f"🎯 /query/stream endpoint: uid={uid}, results={len(results)}, session={body.session_id}")
        
        # Create tasks with error handling
        tracking_task = asyncio.create_task(_track_query_stats(db, uid, results, vs))
        tracking_task.add_done_callback(lambda t: logger.info(f"✅ Tracking task completed for {uid}") if not t.exception() else logger.error(f"❌ Tracking task failed: {t.exception()}"))
        
        if body.session_id:
            save_task = asyncio.create_task(_save_message(db, uid, body.session_id, body.query, answer))
            save_task.add_done_callback(lambda t: logger.info(f"✅ Save task completed") if not t.exception() else logger.error(f"❌ Save task failed: {t.exception()}"))
    else:
        logger.warning("⚠️ /query/stream called without authenticated user - analytics will not be tracked")

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ── Session persistence helper ────────────────────────────────────────

async def _save_message(db, uid: str, session_id: str, query: str, answer: str = ""):
    """Persist query (and optionally answer) to session history."""
    try:
        now = datetime.utcnow()
        messages_to_push = [{"role": "user", "content": query, "ts": now}]
        if answer:
            messages_to_push.append({"role": "assistant", "content": answer, "ts": now})

        # Check if this is the first message in the session
        session = await db.db.sessions.find_one({"_id": session_id, "uid": uid})
        
        update_ops = {
            "$push": {"messages": {"$each": messages_to_push}},
            "$set": {"updated_at": now},
            "$setOnInsert": {"created_at": now, "title": query[:60]},
        }
        
        # If session exists and has no messages (or title is "New Chat"), update the title
        if session:
            existing_messages = session.get("messages", [])
            existing_title = session.get("title", "")
            if len(existing_messages) == 0 or existing_title == "New Chat":
                update_ops["$set"]["title"] = query[:60]
        
        await db.db.sessions.update_one(
            {"_id": session_id, "uid": uid},
            update_ops,
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Failed to save message: %s", exc)
