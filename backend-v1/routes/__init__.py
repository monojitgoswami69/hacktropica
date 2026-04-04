"""
Route registration — mount all API routers onto the app.
"""

from fastapi import FastAPI

from routes.health import router as health_router
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.search import router as search_router
from routes.sessions import router as sessions_router
from routes.quiz import router as quiz_router
from routes.analytics import router as analytics_router
from routes.admin import router as admin_router


def register_routes(app: FastAPI) -> None:
    """Mount all API routers under /api/v1."""
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(search_router)
    app.include_router(sessions_router)
    app.include_router(quiz_router)
    app.include_router(analytics_router)
    app.include_router(admin_router)
