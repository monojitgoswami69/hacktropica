"""
Qdrant Vector Store Service
HNSW-based ANN search with payload filtering.
Uses UUID-based point IDs to prevent cross-document collisions.
Maintains an in-memory metadata cache for fast iteration (quiz, filters).
"""

from __future__ import annotations

import asyncio
import logging
import uuid as _uuid
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    HnswConfigDiff,
    MatchValue,
    OptimizersConfigDiff,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)


@dataclass
class ChunkMetadata:
    """Metadata for a single document chunk."""

    chunk_id: str  # UUID string — Qdrant point ID
    document_id: str
    text: str
    chunk_index: int
    total_chunks: int
    source: str
    title: Optional[str] = None
    semester: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None


class VectorStore:
    """Qdrant-backed vector store with in-memory metadata mirror."""

    def __init__(
        self,
        mode: str = "local",
        path: str = "./qdrant_data",
        host: Optional[str] = None,
        port: int = 6333,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        collection: str = "documents",
        dim: int = 384,
    ):
        self.client: Optional[QdrantClient] = None
        self._mode = mode
        self._path = path
        self._host = host
        self._port = port
        self._url = url
        self._api_key = api_key
        self.collection_name = collection
        self.dim = dim

        # In-memory metadata mirror (populated on startup + updated on add/delete)
        self._metadata: Dict[str, ChunkMetadata] = {}
        self._lock = Lock()  # Guards _metadata mutations

        # Cached filter value sets (fast for /filters endpoint)
        self._filter_cache: Dict[str, Set[str]] = {
            "semesters": set(),
            "streams": set(),
            "subjects": set(),
        }

    # ── Public property for backward compat (quiz, filters use .chunks) ───

    @property
    def chunks(self) -> Dict[str, ChunkMetadata]:
        """Read-only view of all chunk metadata keyed by point-ID."""
        return self._metadata

    # ── Lifecycle ──────────────────────────────────────────────────────

    async def connect(self) -> None:
        """Initialise the Qdrant client and ensure collection exists."""
        try:
            if self._mode == "local":
                storage = Path(self._path)
                storage.mkdir(exist_ok=True, parents=True)
                self.client = await asyncio.to_thread(QdrantClient, path=str(storage))
                logger.info("✅ Qdrant connected (local): %s", storage)
            elif self._mode == "server":
                self.client = await asyncio.to_thread(
                    QdrantClient, host=self._host, port=self._port
                )
                logger.info("✅ Qdrant connected (server): %s:%s", self._host, self._port)
            elif self._mode == "cloud":
                self.client = await asyncio.to_thread(
                    QdrantClient, url=self._url, api_key=self._api_key
                )
                logger.info("✅ Qdrant connected (cloud): %s", self._url)
            else:
                raise ValueError(f"Unknown qdrant_mode: {self._mode}")

            await self._ensure_collection()
            await self._load_metadata_cache()
        except Exception as exc:
            logger.error("❌ Qdrant connection failed: %s", exc)
            raise

    async def _ensure_collection(self) -> None:
        collections = await asyncio.to_thread(lambda: self.client.get_collections().collections)
        exists = any(c.name == self.collection_name for c in collections)

        if not exists:
            await asyncio.to_thread(
                self.client.create_collection,
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE, on_disk=False),
                hnsw_config=HnswConfigDiff(m=16, ef_construct=100, full_scan_threshold=10000),
                optimizers_config=OptimizersConfigDiff(indexing_threshold=1000),
            )
            for fld in ("semester", "stream", "subject", "document_id"):
                await asyncio.to_thread(
                    self.client.create_payload_index,
                    collection_name=self.collection_name,
                    field_name=fld,
                    field_schema="keyword",
                )
            logger.info("✅ Created Qdrant collection: %s", self.collection_name)
        else:
            logger.info("✅ Using existing Qdrant collection: %s", self.collection_name)

    async def _load_metadata_cache(self) -> None:
        """Scroll through all points on startup to populate the metadata mirror."""
        offset = None
        total = 0
        while True:
            points, next_offset = await asyncio.to_thread(
                self.client.scroll,
                collection_name=self.collection_name,
                limit=500,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for pt in points:
                chunk = self._payload_to_chunk(str(pt.id), pt.payload)
                self._metadata[str(pt.id)] = chunk
                self._update_filter_cache_add(chunk)
                total += 1
            if next_offset is None:
                break
            offset = next_offset
        logger.info("✅ Loaded %d chunks into metadata cache", total)

    # ── CRUD ──────────────────────────────────────────────────────────

    async def add(self, vectors: np.ndarray, chunks: List[ChunkMetadata]) -> None:
        """Add vectors + metadata. Assigns deterministic UUID point IDs."""
        if len(vectors) != len(chunks):
            raise ValueError("vectors and chunks must have the same length")

        points: List[PointStruct] = []
        for vec, chunk in zip(vectors, chunks):
            point_id = self._make_point_id(chunk.document_id, chunk.chunk_index)
            chunk.chunk_id = point_id

            payload = {
                "document_id": chunk.document_id,
                "text": chunk.text,
                "chunk_index": chunk.chunk_index,
                "total_chunks": chunk.total_chunks,
                "source": chunk.source,
            }
            for opt_field in ("title", "semester", "stream", "subject"):
                val = getattr(chunk, opt_field, None)
                if val:
                    payload[opt_field] = val
            if chunk.page_start is not None:
                payload["page_start"] = chunk.page_start
            if chunk.page_end is not None:
                payload["page_end"] = chunk.page_end

            points.append(PointStruct(id=point_id, vector=vec.tolist(), payload=payload))

        await asyncio.to_thread(
            self.client.upsert,
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )

        # Update metadata cache
        with self._lock:
            for chunk in chunks:
                self._metadata[chunk.chunk_id] = chunk
                self._update_filter_cache_add(chunk)

        logger.info("✅ Added %d vectors to Qdrant", len(points))

    async def search(
        self,
        query_vector: np.ndarray,
        k: int = 5,
        filters: Optional[Dict[str, str]] = None,
    ) -> List[Tuple[str, float]]:
        """Returns list of (point_id, score) tuples."""
        qdrant_filter = self._build_filter(filters)

        response = await asyncio.to_thread(
            self.client.query_points,
            collection_name=self.collection_name,
            query=query_vector.tolist(),
            limit=k,
            query_filter=qdrant_filter,
            with_payload=False,
        )
        return [(str(r.id), r.score) for r in response.points]

    def get_chunk(self, chunk_id: str) -> Optional[ChunkMetadata]:
        """Get chunk metadata from the in-memory cache (O(1))."""
        return self._metadata.get(chunk_id)

    async def delete_document(self, document_id: str) -> int:
        """Delete all chunks for a document. Returns count deleted."""
        # Find affected point IDs from cache
        with self._lock:
            to_delete = [cid for cid, c in self._metadata.items() if c.document_id == document_id]

        if not to_delete:
            return 0

        await asyncio.to_thread(
            self.client.delete,
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
        )

        # Update metadata cache
        with self._lock:
            for cid in to_delete:
                self._metadata.pop(cid, None)
            self._rebuild_filter_cache()

        logger.info("✅ Deleted %d chunks for document %s", len(to_delete), document_id[:8])
        return len(to_delete)

    def get_stats(self) -> Dict[str, Any]:
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "total_chunks": info.points_count,
                "vector_dimension": self.dim,
                "indexed": info.status == "green",
            }
        except Exception:
            return {"total_chunks": 0, "vector_dimension": self.dim, "indexed": False}

    def get_filter_values(self) -> Dict[str, List[str]]:
        """Return cached unique filter values."""
        return {k: sorted(v) for k, v in self._filter_cache.items()}

    # ── Internals ─────────────────────────────────────────────────────

    @staticmethod
    def _make_point_id(document_id: str, chunk_index: int) -> str:
        """Deterministic UUID from document_id + chunk_index. Prevents collisions."""
        return str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f"{document_id}:{chunk_index}"))

    @staticmethod
    def _build_filter(filters: Optional[Dict[str, str]]) -> Optional[Filter]:
        if not filters:
            return None
        conditions = [
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in filters.items()
            if v
        ]
        return Filter(must=conditions) if conditions else None

    @staticmethod
    def _payload_to_chunk(point_id: str, payload: Dict) -> ChunkMetadata:
        return ChunkMetadata(
            chunk_id=point_id,
            document_id=payload["document_id"],
            text=payload.get("text", ""),
            chunk_index=payload.get("chunk_index", 0),
            total_chunks=payload.get("total_chunks", 1),
            source=payload.get("source", ""),
            title=payload.get("title"),
            semester=payload.get("semester"),
            stream=payload.get("stream"),
            subject=payload.get("subject"),
            page_start=payload.get("page_start"),
            page_end=payload.get("page_end"),
        )

    def _update_filter_cache_add(self, chunk: ChunkMetadata) -> None:
        if chunk.semester:
            self._filter_cache["semesters"].add(chunk.semester)
        if chunk.stream:
            self._filter_cache["streams"].add(chunk.stream)
        if chunk.subject:
            self._filter_cache["subjects"].add(chunk.subject)

    def _rebuild_filter_cache(self) -> None:
        self._filter_cache = {"semesters": set(), "streams": set(), "subjects": set()}
        for c in self._metadata.values():
            self._update_filter_cache_add(c)
