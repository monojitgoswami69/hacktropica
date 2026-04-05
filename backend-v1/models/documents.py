"""Document ingestion and management models."""

from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class IngestRequest(BaseModel):
    content: Optional[str] = None
    source: str
    title: Optional[str] = None
    semester: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    module: Optional[str] = None
    mime_type: Optional[str] = None
    file_data_base64: Optional[str] = None
    force_ocr: Optional[bool] = False


class IngestResponse(BaseModel):
    document_id: str
    chunks_created: int
    message: str
    preview_url: Optional[str] = None
    timing: Optional[Dict[str, float]] = None


class DocumentInfo(BaseModel):
    document_id: str
    source: str
    title: Optional[str] = None
    semester: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    module: Optional[str] = None
    chunks: int = 0
    storage_key: Optional[str] = None
    preview_url: Optional[str] = None
    download_url: Optional[str] = None
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total: int
