"""Health & stats endpoints."""

from fastapi import APIRouter, Depends
from dependencies import get_db, get_vector_store

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health(db=Depends(get_db), vs=Depends(get_vector_store)):
    db_ok = await db.is_healthy()
    vs_stats = vs.get_stats()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "vector_store": vs_stats,
    }


@router.get("/stats")
async def stats(vs=Depends(get_vector_store)):
    return vs.get_stats()
