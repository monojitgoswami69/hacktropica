"""Document ingestion, listing, deletion, preview, download, and content endpoints."""

from __future__ import annotations

import base64
import logging
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from models.documents import IngestRequest, IngestResponse, DocumentInfo, DocumentListResponse
from services.vector_store import ChunkMetadata
from services.document_processor import DocumentProcessor
from services.audit import log_audit
from dependencies import (
    get_db, get_vector_store, get_embedding_service,
    get_current_user, get_storage_service,
)

logger = logging.getLogger(__name__)
doc_processor = DocumentProcessor()

router = APIRouter(prefix="/api/v1", tags=["documents"])

# ── Mime-type helpers ─────────────────────────────────────────────────

_MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
}


def _guess_mime(filename: str, fallback: str = "application/octet-stream") -> str:
    for ext, mime in _MIME_MAP.items():
        if filename.lower().endswith(ext):
            return mime
    return fallback


# ── Ingest ────────────────────────────────────────────────────────────

@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    body: IngestRequest,
    request: Request,
    user=Depends(get_current_user),
    db=Depends(get_db),
    vs=Depends(get_vector_store),
    emb=Depends(get_embedding_service),
    storage=Depends(get_storage_service),
):
    t0 = time.perf_counter()
    timings: dict = {}

    # 1. Extract text ──────────────────────────────────────────────────
    t = time.perf_counter()
    raw_text, page_texts_data = None, None
    file_bytes = None
    mime = (body.mime_type or "").lower()

    if body.file_data_base64:
        file_bytes = base64.b64decode(body.file_data_base64)

        if mime == "application/pdf" or body.source.lower().endswith(".pdf"):
            try:
                if body.force_ocr:
                    raise ValueError("force OCR")
                raw_text, page_texts_data = doc_processor.extract_pdf_text(file_bytes)
            except Exception:
                raw_text, page_texts_data = doc_processor.extract_pdf_ocr(file_bytes)

        elif "image" in mime:
            raw_text = doc_processor.extract_image_ocr(file_bytes)

        elif mime in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ) or body.source.lower().endswith(".docx"):
            raw_text = doc_processor.extract_docx_text(file_bytes)

        elif mime in (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
        ) or body.source.lower().endswith(".pptx"):
            raw_text, page_texts_data = doc_processor.extract_pptx_text(file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="replace")
    elif body.content:
        raw_text = body.content
    else:
        raise HTTPException(400, "Provide either content or file_data_base64")

    if not raw_text or not raw_text.strip():
        raise HTTPException(400, "No extractable text found")
    timings["extraction_ms"] = round((time.perf_counter() - t) * 1000, 1)

    # 2. Chunk ─────────────────────────────────────────────────────────
    t = time.perf_counter()
    settings = request.app.state.settings
    chunk_dicts = doc_processor.chunk_text(raw_text, settings.chunk_size, settings.chunk_overlap, page_texts_data)
    if not chunk_dicts:
        raise HTTPException(400, "Text produced zero chunks")
    timings["chunking_ms"] = round((time.perf_counter() - t) * 1000, 1)

    # 3. Generate document_id
    document_id = str(uuid.uuid4()).replace("-", "")[:16]

    # 4. Upload original file to R2 (if storage configured + file provided)
    storage_key = None
    preview_url = None
    if storage and file_bytes:
        t = time.perf_counter()
        content_type = mime or _guess_mime(body.source)
        storage_key = f"documents/{document_id}/{body.source}"
        await storage.upload(storage_key, file_bytes, content_type=content_type, filename=body.source)
        preview_url = storage.get_public_url(storage_key)
        timings["upload_ms"] = round((time.perf_counter() - t) * 1000, 1)

    # 5. Build ChunkMetadata
    chunks = [
        ChunkMetadata(
            chunk_id="",
            document_id=document_id,
            text=c["text"],
            chunk_index=i,
            total_chunks=len(chunk_dicts),
            source=body.source,
            title=body.title,
            semester=body.semester,
            stream=body.stream,
            subject=body.subject,
            page_start=c.get("page_start"),
            page_end=c.get("page_end"),
        )
        for i, c in enumerate(chunk_dicts)
    ]

    # 6. Generate embeddings (async — thread pool)
    t = time.perf_counter()
    texts = [c.text for c in chunks]
    vectors = await emb.encode_batch(texts)
    timings["embedding_ms"] = round((time.perf_counter() - t) * 1000, 1)

    # 7. Store vectors
    t = time.perf_counter()
    await vs.add(vectors, chunks)
    timings["indexing_ms"] = round((time.perf_counter() - t) * 1000, 1)

    # 8. Build download URL (presigned URLs are generated on-demand, store key for lookup)
    download_url = None
    if preview_url and storage_key:
        # Download URL is generated on-demand via /documents/{id}/download
        # Store a flag that download is available
        download_url = f"/api/v1/documents/{document_id}/download"

    # 9. Store document metadata in MongoDB
    doc_record = {
        "_id": document_id,
        "source": body.source,
        "title": body.title,
        "semester": body.semester,
        "stream": body.stream,
        "subject": body.subject,
        "chunks": len(chunks),
        "uploaded_by": user["_id"],
        "storage_key": storage_key or "",
        "preview_url": preview_url or "",
        "download_url": download_url or "",
        "created_at": datetime.utcnow(),
    }

    await db.db.documents.insert_one(doc_record)

    # 10. Audit log
    await log_audit(
        db, action="document.create", user_id=user["_id"], user_email=user.get("email", ""),
        role=user.get("role", ""), target_type="document", target_id=document_id,
        details={"title": body.title, "source": body.source, "stream": body.stream,
                 "subject": body.subject, "chunks": len(chunks)},
    )

    timings["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    logger.info("Ingested %s: %d chunks in %.0fms", body.source, len(chunks), timings["total_ms"])

    return IngestResponse(
        document_id=document_id,
        chunks_created=len(chunks),
        message=f"Ingested {len(chunks)} chunks from {body.source}",
        preview_url=preview_url,
        timing=timings,
    )


# ── List / Delete ─────────────────────────────────────────────────────

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.db.documents.find().sort("created_at", -1)
    docs = []
    async for doc in cursor:
        docs.append(DocumentInfo(
            document_id=doc["_id"],
            source=doc.get("source", ""),
            title=doc.get("title"),
            semester=doc.get("semester"),
            stream=doc.get("stream"),
            subject=doc.get("subject"),
            chunks=doc.get("chunks", 0),
            storage_key=doc.get("storage_key"),
            preview_url=doc.get("preview_url"),
            download_url=doc.get("download_url"),
            created_at=doc.get("created_at", datetime.utcnow()),
        ))
    return DocumentListResponse(documents=docs, total=len(docs))


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
    vs=Depends(get_vector_store),
    storage=Depends(get_storage_service),
):
    doc = await db.db.documents.find_one({"_id": document_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Delete from R2
    if doc.get("storage_key") and storage:
        await storage.delete(doc["storage_key"])

    # Delete vectors
    deleted_chunks = await vs.delete_document(document_id)
    # Delete metadata
    await db.db.documents.delete_one({"_id": document_id})

    # Audit log
    await log_audit(
        db, action="document.delete", user_id=user["_id"], user_email=user.get("email", ""),
        role=user.get("role", ""), target_type="document", target_id=document_id,
        details={"title": doc.get("title", ""), "source": doc.get("source", "")},
    )

    return {"message": f"Deleted {deleted_chunks} chunks", "document_id": document_id}


# ── Preview / Download / Content ──────────────────────────────────────

@router.get("/documents/{document_id}/preview")
async def get_document_preview(
    document_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
    storage=Depends(get_storage_service),
):
    """
    Return a publicly-accessible preview URL for the original file.
    Prefers the permanent public R2 URL; falls back to a 1-hour presigned URL.
    """
    doc = await db.db.documents.find_one({"_id": document_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    storage_key = doc.get("storage_key")
    if not storage_key:
        raise HTTPException(404, "Original file not available (text-only ingest)")
    if not storage:
        raise HTTPException(503, "File storage not configured")

    # Prefer cached public URL from DB
    public_url = doc.get("preview_url")
    if not public_url:
        public_url = storage.get_public_url(storage_key)

    if public_url:
        return {
            "preview_url": public_url,
            "document_id": document_id,
            "source": doc.get("source", ""),
        }

    # Fall back to presigned URL
    presigned = await storage.get_presigned_url(storage_key, expires_in=3600)
    return {
        "preview_url": presigned,
        "document_id": document_id,
        "source": doc.get("source", ""),
    }


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
    storage=Depends(get_storage_service),
):
    """Return a short-lived presigned download URL (5 minutes)."""
    doc = await db.db.documents.find_one({"_id": document_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    storage_key = doc.get("storage_key")
    if not storage_key:
        raise HTTPException(404, "Original file not available")
    if not storage:
        raise HTTPException(503, "File storage not configured")

    presigned = await storage.get_presigned_url(storage_key, expires_in=300)
    return {
        "download_url": presigned,
        "filename": doc.get("source", "document"),
        "document_id": document_id,
    }


@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: str,
    user=Depends(get_current_user),
    vs=Depends(get_vector_store),
):
    """Return the full extracted text of a document (reconstructed from chunks)."""
    chunks = [
        (c.chunk_index, c.text)
        for c in vs.chunks.values()
        if c.document_id == document_id
    ]
    if not chunks:
        raise HTTPException(404, "Document not found or has no content")

    chunks.sort(key=lambda x: x[0])
    full_text = "\n\n".join(text for _, text in chunks)

    return {
        "document_id": document_id,
        "content": full_text,
        "total_chunks": len(chunks),
    }
