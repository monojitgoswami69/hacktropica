"""Search, RAG query, and context models."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class SearchFilter(BaseModel):
    semester: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    document_id: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[SearchFilter] = None


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    score: float
    source: str
    title: Optional[str] = None
    semester: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    document_id: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
    total_results: int
    timing: Optional[Dict[str, float]] = None


class HistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[SearchFilter] = None
    history: Optional[List[HistoryMessage]] = None
    session_id: Optional[str] = None


class ContextChunk(BaseModel):
    text: str
    source: str
    score: float
