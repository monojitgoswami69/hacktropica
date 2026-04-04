"""Chat session models."""

from pydantic import BaseModel


class SessionInfo(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
