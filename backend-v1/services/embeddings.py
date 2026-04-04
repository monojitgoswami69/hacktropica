"""
Embedding Generation Service
SentenceTransformers with in-memory LRU cache and async support.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from collections import OrderedDict
from typing import Dict, List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Thread-safe embedding service with LRU cache."""

    def __init__(self, model_name: str, dim: int, hf_token: Optional[str] = None):
        self.model: Optional[SentenceTransformer] = None
        self._model_name = model_name
        self._dim = dim
        self._hf_token = hf_token
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._cache_max_size = 2000

    async def initialize(self) -> None:
        """Load the embedding model (CPU-bound, run in thread)."""
        logger.info("Loading embedding model: %s", self._model_name)

        if self._hf_token:
            from huggingface_hub import login as hf_login
            hf_login(token=self._hf_token, add_to_git_credential=False)
            logger.info("✅ Authenticated with HuggingFace")

        # Load in background thread so we don't block the event loop
        self.model = await asyncio.to_thread(
            SentenceTransformer,
            self._model_name,
            token=self._hf_token if self._hf_token else None,
        )
        logger.info("✅ Embedding model loaded: %s (dim=%d)", self._model_name, self._dim)

    # ── Sync encode (for use inside thread pools / sync generators) ───

    def encode_sync(self, text: str, use_cache: bool = True) -> np.ndarray:
        """Blocking encode — call from threads or wrap with asyncio.to_thread."""
        if use_cache:
            key = self._cache_key(text)
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]

        embedding = self.model.encode(text, show_progress_bar=False)
        embedding = np.array(embedding, dtype=np.float32)

        if use_cache:
            key = self._cache_key(text)
            self._cache[key] = embedding
            if len(self._cache) > self._cache_max_size:
                self._cache.popitem(last=False)

        return embedding

    def encode_batch_sync(self, texts: List[str]) -> np.ndarray:
        """Blocking batch encode."""
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return np.array(embeddings, dtype=np.float32)

    # ── Async wrappers (non-blocking for the event loop) ──────────────

    async def encode(self, text: str, use_cache: bool = True) -> np.ndarray:
        return await asyncio.to_thread(self.encode_sync, text, use_cache)

    async def encode_batch(self, texts: List[str]) -> np.ndarray:
        return await asyncio.to_thread(self.encode_batch_sync, texts)

    # ── Internals ─────────────────────────────────────────────────────

    @staticmethod
    def _cache_key(text: str) -> str:
        return hashlib.md5(text.lower().strip().encode()).hexdigest()
