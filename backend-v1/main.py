"""
Vidyarthi Saarthi — Backend v1
Entry point: application factory, service lifecycle, server startup.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import Settings

# ── Logging setup ─────────────────────────────────────────────────────

load_dotenv()


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )
    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("qdrant_client").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


# ── Application lifespan (startup / shutdown) ─────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise all services on startup, clean up on shutdown."""
    settings: Settings = app.state.settings

    _configure_logging(settings.log_level)
    logger.info("🚀 Starting Vidyarthi Saarthi (Backend v1)…")

    # ── Database ──────────────────────────────────────────────────
    from database import Database
    db = Database(url=settings.mongodb_url, db_name=settings.mongodb_db_name)
    await db.connect()
    app.state.db = db

    # ── Vector Store ──────────────────────────────────────────────
    from services.vector_store import VectorStore
    vs = VectorStore(
        mode=settings.qdrant_mode,
        path=settings.qdrant_path,
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        collection=settings.qdrant_collection,
        dim=settings.embedding_dim,
    )
    await vs.connect()
    app.state.vector_store = vs

    # ── Embedding Service ─────────────────────────────────────────
    from services.embeddings import EmbeddingService
    emb = EmbeddingService(
        model_name=settings.embedding_model,
        dim=settings.embedding_dim,
        hf_token=settings.hf_token,
    )
    await emb.initialize()
    app.state.embedding_service = emb

    # ── LLM Service ───────────────────────────────────────────────
    from services.llm import LLMService
    llm = LLMService(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        quiz_model=settings.gemini_quiz_model,
    )
    await llm.initialize()
    app.state.llm_service = llm

    # ── Auth Service ──────────────────────────────────────────────
    from services.auth import AuthService
    app.state.auth_service = AuthService(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        expire_minutes=settings.jwt_access_token_expire_minutes,
    )

    # ── Storage Service (optional — R2) ───────────────────────────
    if settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key:
        from services.storage import StorageService
        storage = StorageService(
            account_id=settings.r2_account_id,
            access_key_id=settings.r2_access_key_id,
            secret_access_key=settings.r2_secret_access_key,
            bucket_name=settings.r2_bucket_name,
            public_url=settings.r2_public_url,
        )
        await storage.initialize()
        app.state.storage = storage
    else:
        app.state.storage = None
        logger.warning("⚠️  R2 storage not configured — file preview/download disabled")

    logger.info("✅ All services initialised — server ready")

    yield  # ← app is running ──────────────────────────────────────

    logger.info("🛑 Shutting down…")
    await db.disconnect()
    logger.info("Goodbye.")


# ── Application factory ──────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = Settings()

    app = FastAPI(
        title="Vidyarthi Saarthi API (v1)",
        version="1.0.0",
        description="Production-grade backend for the Vidyarthi Saarthi academic assistant.",
        lifespan=lifespan,
    )
    app.state.settings = settings

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    from routes import register_routes
    register_routes(app)

    return app


# ── Module-level app instance (for uvicorn main:app) ─────────────────
app = create_app()

# ── CLI entry point ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    settings = Settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
