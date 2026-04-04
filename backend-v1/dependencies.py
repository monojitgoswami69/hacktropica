"""
FastAPI Dependency Injection
All service access goes through these dependencies — no global state in routes.
"""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import Header, HTTPException, Request

from database import Database
from services.vector_store import VectorStore
from services.embeddings import EmbeddingService
from services.llm import LLMService
from services.auth import AuthService
from services.storage import StorageService


# ── Service accessors ─────────────────────────────────────────────────

def get_db(request: Request) -> Database:
    return request.app.state.db


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vector_store


def get_embedding_service(request: Request) -> EmbeddingService:
    return request.app.state.embedding_service


def get_llm_service(request: Request) -> LLMService:
    return request.app.state.llm_service


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


def get_storage_service(request: Request) -> Optional[StorageService]:
    return getattr(request.app.state, "storage", None)


# ── Authentication dependencies ──────────────────────────────────────

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict:
    """Mandatory auth — raises 401 if missing or invalid."""
    auth_svc: AuthService = request.app.state.auth_service
    db: Database = request.app.state.db
    return await auth_svc.get_current_user(authorization, db.db)


async def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[Dict]:
    """Optional auth — returns None instead of raising."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        auth_svc: AuthService = request.app.state.auth_service
        db: Database = request.app.state.db
        return await auth_svc.get_current_user(authorization, db.db)
    except HTTPException:
        return None


# ── Role-based dependencies ──────────────────────────────────────────

def require_admin(user: Dict):
    """Call after get_current_user to enforce admin role."""
    AuthService.require_role(user, ["admin", "superuser"])
    return user


def require_faculty(user: Dict):
    """Call after get_current_user to enforce faculty+ role."""
    AuthService.require_role(user, ["faculty", "hod", "admin", "superuser"])
    return user


def require_hod(user: Dict):
    """Call after get_current_user to enforce hod+ role."""
    AuthService.require_role(user, ["hod", "admin", "superuser"])
    return user


def require_dashboard_scope(user: Dict):
    """Ensure the token was issued for the dashboard (not student chatbot)."""
    if user.get("scope") != "dashboard":
        raise HTTPException(status_code=403, detail="Dashboard access required")
    return user


def require_student_scope(user: Dict):
    """Ensure the token was issued for the student chatbot."""
    if user.get("scope") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    return user
