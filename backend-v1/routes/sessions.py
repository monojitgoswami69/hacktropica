"""Session management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/v1", tags=["sessions"])


@router.post("/sessions")
async def create_session(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid
    session_id = str(uuid.uuid4()).replace("-", "")[:20]
    now = datetime.utcnow()
    await db.db.sessions.insert_one({
        "_id": session_id,
        "uid": user["_id"],
        "title": "New Chat",
        "messages": [],
        "created_at": now,
        "updated_at": now,
    })
    return {"session_id": session_id, "title": "New Chat", "created_at": now.isoformat()}


@router.get("/sessions")
async def list_sessions(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.db.sessions.find({"uid": user["_id"]}).sort("updated_at", -1).limit(50)
    sessions = []
    async for s in cursor:
        sessions.append({
            "session_id": s["_id"],
            "title": s.get("title", "Untitled"),
            "created_at": s.get("created_at", datetime.utcnow()).isoformat(),
            "updated_at": s.get("updated_at", datetime.utcnow()).isoformat(),
            "message_count": len(s.get("messages", [])),
        })
    return {"sessions": sessions}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    session = await db.db.sessions.find_one({"_id": session_id, "uid": user["_id"]})
    if not session:
        raise HTTPException(404, "Session not found")

    messages = session.get("messages", [])
    for m in messages:
        if "ts" in m and hasattr(m["ts"], "isoformat"):
            m["ts"] = m["ts"].isoformat()

    return {"session_id": session_id, "messages": messages}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete a chat session."""
    session = await db.db.sessions.find_one({"_id": session_id, "uid": user["_id"]})
    if not session:
        raise HTTPException(404, "Session not found")
    
    result = await db.db.sessions.delete_one({"_id": session_id, "uid": user["_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(404, "Session not found")
    
    return {"message": "Session deleted successfully", "session_id": session_id}
