"""Quiz generation, submission, and history endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException

from models.quiz import (
    QuizGenerateRequest, QuizGenerateResponse, QuizSubmitRequest,
    QuizOption, QuizQuestion, QuizOutputSchema,
)
from services.vector_store import ChunkMetadata
from dependencies import get_db, get_vector_store, get_llm_service, get_current_user

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_INSTRUCTION = """You are an expert academic quiz generator for college exam preparation.

Your task is to generate high-quality multiple-choice questions (MCQs) based STRICTLY on the provided study material.

Rules:
1. Every question MUST be directly grounded in the provided study material. Do NOT hallucinate.
2. Questions should test understanding and application, not just rote recall.
3. Each question must have exactly 4 options labeled A, B, C, D. Exactly ONE must be correct.
4. All distractors must be plausible — avoid obviously absurd options.
5. Include a concise 1-2 sentence explanation for the correct answer.
6. Vary difficulty: ~30% easy, ~50% medium, ~20% hard.
7. Distribute correct answer positions evenly across A, B, C, D.
8. Cover as many distinct topics as possible for breadth.
9. If material is insufficient, generate as many as the material supports."""

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])


def _collect_context_for_quiz(
    chunks: Dict[str, ChunkMetadata],
    subject: Optional[str],
    document_id: Optional[str] = None,
    max_chars: int = 150_000,
) -> Tuple[str, int]:
    """Collect chunk text for quiz generation."""
    selected: List[ChunkMetadata] = []

    for chunk in chunks.values():
        match = True
        if subject and subject != "All Subjects":
            if (chunk.subject or "General").lower() != subject.lower():
                match = False
        if document_id and chunk.document_id != document_id:
            match = False
        if match:
            selected.append(chunk)

    selected.sort(key=lambda c: (c.document_id, c.chunk_index))

    parts: List[str] = []
    current_doc: Optional[str] = None
    current_num = 0
    total_chars = 0
    used = 0

    for chunk in selected:
        lines: List[str] = []
        if chunk.document_id != current_doc:
            current_doc = chunk.document_id
            current_num += 1
            lines.append(f"\n{'=' * 60}")
            lines.append(f"DOCUMENT {current_num}: {chunk.title or chunk.source or 'Unknown'}")
            lines.append(f"Source: {chunk.source or 'Unknown'}")
            lines.append(f"{'=' * 60}")

        lines.append(f"\n--- Section {chunk.chunk_index + 1}/{chunk.total_chunks} ---")
        lines.append(chunk.text.strip())

        entry = "\n".join(lines)
        if total_chars + len(entry) + 2 > max_chars:
            break

        parts.append(entry)
        total_chars += len(entry) + 2
        used += 1

    return "\n\n".join(parts), used


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    body: QuizGenerateRequest,
    user=Depends(get_current_user),
    vs=Depends(get_vector_store),
    llm=Depends(get_llm_service),
):
    if not llm.client:
        raise HTTPException(503, "Quiz generation unavailable — Gemini not configured")
    if not vs.chunks:
        raise HTTPException(404, "No study materials found. Upload documents first.")

    subject_label = body.subject if body.subject and body.subject != "All Subjects" else "All Subjects"
    context, chunks_used = _collect_context_for_quiz(vs.chunks, body.subject, body.document_id)

    if chunks_used == 0:
        raise HTTPException(404, f"No material found for subject '{subject_label}'")

    prompt = f"""Generate exactly {body.num_questions} multiple-choice questions for: {subject_label}.

Below is the study material. Base ALL questions strictly on this content.

{context}"""

    # Run structured generation in thread pool (sync Gemini call)
    try:
        parsed = await asyncio.to_thread(
            llm.generate_structured_sync,
            prompt,
            QUIZ_SYSTEM_INSTRUCTION,
            QuizOutputSchema.model_json_schema(),
        )
    except Exception as exc:
        logger.error("Quiz generation error: %s", exc)
        raise HTTPException(500, f"Quiz generation failed: {exc}")

    # Parse results
    raw_questions = parsed.get("questions", parsed) if isinstance(parsed, dict) else parsed
    questions: List[QuizQuestion] = []
    if isinstance(raw_questions, list):
        for i, q in enumerate(raw_questions):
            try:
                options = [QuizOption(label=o["label"], text=o["text"]) for o in q["options"]]
                questions.append(QuizQuestion(
                    id=i + 1,
                    question=q["question"],
                    options=options,
                    correct_option=q["correct_option"],
                    explanation=q.get("explanation", ""),
                ))
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping malformed question %d: %s", i + 1, exc)

    if not questions:
        raise HTTPException(500, "No valid questions generated. Try again.")

    quiz_id = str(uuid.uuid4()).replace("-", "")[:16]
    return QuizGenerateResponse(
        quiz_id=quiz_id,
        subject=subject_label,
        num_questions=len(questions),
        questions=questions,
        generated_at=datetime.utcnow().isoformat(),
        context_chunks_used=chunks_used,
    )


@router.post("/submit")
async def submit_quiz(body: QuizSubmitRequest, user=Depends(get_current_user), db=Depends(get_db)):
    await db.db.quiz_results.insert_one({
        "uid": user["_id"],
        "quiz_id": body.quiz_id,
        "subject": body.subject,
        "score": body.score,
        "total_questions": body.total_questions,
        "percentage": round(body.score / body.total_questions * 100) if body.total_questions else 0,
        "submitted_at": datetime.utcnow(),
    })
    return {"status": "success"}


@router.get("/history")
async def quiz_history(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.db.quiz_results.find({"uid": user["_id"]}).sort("submitted_at", -1).limit(20)
    history = []
    async for doc in cursor:
        doc["quiz_id"] = doc.get("quiz_id", doc.get("_id"))
        if "submitted_at" in doc and hasattr(doc["submitted_at"], "isoformat"):
            doc["submitted_at"] = doc["submitted_at"].isoformat()
        doc.pop("_id", None)
        history.append(doc)
    return {"history": history}
