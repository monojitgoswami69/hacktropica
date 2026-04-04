"""Authentication endpoints — separate login for dashboard and student users."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models.auth import LoginRequest, RegisterRequest, AuthResponse
from services.audit import log_audit
from dependencies import (
    get_db, get_auth_service, get_current_user,
    require_dashboard_scope, require_student_scope,
)

router = APIRouter(prefix="/api/v1", tags=["auth"])


# ── Extra request models ──────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    stream: Optional[str] = None
    sem: Optional[str] = None
    roll: Optional[str] = None


# ── Dashboard Login (admin / hod / faculty) ──────────────────────────

@router.post("/admin/login", response_model=AuthResponse)
async def admin_login(body: LoginRequest, db=Depends(get_db), auth=Depends(get_auth_service)):
    """Login for dashboard users (admin, hod, faculty)."""
    user = await auth.authenticate_dashboard_user(body.email, body.password, db.db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token({
        "uid": user["_id"],
        "email": user["email"],
        "role": user.get("role", "admin"),
        "scope": "dashboard",
    })
    return AuthResponse(
        uid=user["_id"],
        email=user["email"],
        token=token,
        role=user.get("role", "admin"),
        display_name=user.get("display_name", user["email"].split("@")[0]),
    )


# ── Student Login (chatbot) ──────────────────────────────────────────

@router.post("/student/login", response_model=AuthResponse)
async def student_login(body: LoginRequest, db=Depends(get_db), auth=Depends(get_auth_service)):
    """Login for student users (chatbot)."""
    user = await auth.authenticate_student_user(body.email, body.password, db.db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token({
        "uid": user["_id"],
        "email": user["email"],
        "role": "student",
        "scope": "student",
    })
    return AuthResponse(
        uid=user["_id"],
        email=user["email"],
        token=token,
        role="student",
        display_name=user.get("display_name", user["email"].split("@")[0]),
    )


# ── Student Registration ─────────────────────────────────────────────

@router.post("/student/register", response_model=AuthResponse)
async def student_register(body: RegisterRequest, db=Depends(get_db), auth=Depends(get_auth_service)):
    """Self-registration for students."""
    existing = await db.db.student_auth.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    import uuid
    uid = str(uuid.uuid4()).replace("-", "")
    display_name = body.display_name or body.name or body.email.split("@")[0]

    # Auth record (lean — no created_at)
    await db.db.student_auth.insert_one({
        "_id": uid,
        "email": body.email,
        "password_hash": auth.hash_password(body.password),
        "role": "student",
    })

    # Profile record (metadata, no password)
    await db.db.student_profiles.insert_one({
        "_id": uid,
        "email": body.email,
        "display_name": display_name,
        "name": body.name or "",
        "stream": "",
        "sem": "",
        "roll": "",
        "created_at": datetime.utcnow(),
    })

    # Audit log
    await log_audit(
        db, action="user.register", user_id=uid, user_email=body.email,
        role="student", target_type="student", target_id=uid,
    )

    token = auth.create_access_token({
        "uid": uid, "email": body.email, "role": "student", "scope": "student",
    })
    return AuthResponse(uid=uid, email=body.email, token=token, role="student", display_name=display_name)


# ── Token Identity ───────────────────────────────────────────────────

@router.get("/auth/me")
async def me(user=Depends(get_current_user), db=Depends(get_db)):
    """Return current user's identity from the appropriate profile table."""
    scope = user.get("scope", "student")

    if scope == "dashboard":
        profile = await db.db.dashboard_profiles.find_one({"_id": user["_id"]}) or {}
    else:
        profile = await db.db.student_profiles.find_one({"_id": user["_id"]}) or {}

    return {
        "uid": user["_id"],
        "email": user["email"],
        "role": user.get("role", "student"),
        "scope": scope,
        "display_name": profile.get("display_name", user["email"].split("@")[0]),
        "profile": {k: v for k, v in profile.items() if k not in ("_id", "email", "password_hash")},
    }


@router.post("/auth/refresh")
async def refresh_token(user=Depends(get_current_user), auth=Depends(get_auth_service)):
    """Exchange a valid token for a fresh one."""
    token = auth.create_access_token({
        "uid": user["_id"],
        "email": user["email"],
        "role": user.get("role", "student"),
        "scope": user.get("scope", "student"),
    })
    return {"token": token, "uid": user["_id"]}


# ── Profile Endpoints ────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user=Depends(get_current_user), db=Depends(get_db)):
    """Return the current user's full profile."""
    scope = user.get("scope", "student")

    if scope == "dashboard":
        profile = await db.db.dashboard_profiles.find_one({"_id": user["_id"]}) or {}
    else:
        profile = await db.db.student_profiles.find_one({"_id": user["_id"]}) or {}

    return {
        "uid": user["_id"],
        "email": user["email"],
        "role": user.get("role", "student"),
        "display_name": profile.get("display_name", ""),
        "name": profile.get("name", profile.get("display_name", "")),
        "stream": profile.get("stream", ""),
        "sem": profile.get("sem", ""),
        "roll": profile.get("roll", ""),
        "created_at": profile.get("created_at", datetime.utcnow()).isoformat()
        if hasattr(profile.get("created_at", ""), "isoformat") else str(profile.get("created_at", "")),
    }


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Update the current user's profile. Only provided fields are changed."""
    scope = user.get("scope", "student")
    collection = db.db.dashboard_profiles if scope == "dashboard" else db.db.student_profiles

    update_set: dict = {}
    if body.display_name is not None:
        update_set["display_name"] = body.display_name
    if body.name is not None:
        update_set["name"] = body.name
    if body.stream is not None:
        update_set["stream"] = body.stream
    if body.sem is not None:
        update_set["sem"] = body.sem
    if body.roll is not None:
        update_set["roll"] = body.roll

    if not update_set:
        raise HTTPException(400, "No fields to update")

    update_set["updated_at"] = datetime.utcnow()

    await collection.update_one({"_id": user["_id"]}, {"$set": update_set}, upsert=True)
    return {"message": "Profile updated", "updated_fields": list(update_set.keys())}


# ── Dashboard ─────────────────────────────────────────────────────────

@router.get("/dashboard")
async def student_dashboard(user=Depends(get_current_user), db=Depends(get_db)):
    """Student dashboard: recent sessions, quiz history summary, query stats."""
    uid = user["_id"]
    scope = user.get("scope", "student")

    # Get profile for display
    if scope == "dashboard":
        profile = await db.db.dashboard_profiles.find_one({"_id": uid}) or {}
    else:
        profile = await db.db.student_profiles.find_one({"_id": uid}) or {}

    # Recent sessions (last 5)
    session_cursor = db.db.sessions.find({"uid": uid}).sort("updated_at", -1).limit(5)
    recent_sessions = []
    async for s in session_cursor:
        recent_sessions.append({
            "session_id": s["_id"],
            "title": s.get("title", "Untitled"),
            "updated_at": s.get("updated_at", datetime.utcnow()).isoformat()
            if hasattr(s.get("updated_at", ""), "isoformat") else "",
            "message_count": len(s.get("messages", [])),
        })

    # Quiz history (last 5)
    quiz_cursor = db.db.quiz_results.find({"uid": uid}).sort("submitted_at", -1).limit(5)
    recent_quizzes = []
    async for q in quiz_cursor:
        recent_quizzes.append({
            "quiz_id": q.get("quiz_id", str(q.get("_id", ""))),
            "subject": q.get("subject", ""),
            "score": q.get("score", 0),
            "total_questions": q.get("total_questions", 0),
            "percentage": q.get("percentage", 0),
            "submitted_at": q.get("submitted_at", "").isoformat()
            if hasattr(q.get("submitted_at", ""), "isoformat") else "",
        })

    # Query stats summary
    stats = await db.db.query_stats.find_one({"_id": uid})
    query_summary = {
        "total_queries": 0,
        "top_subjects": [],
    }
    if stats:
        query_summary["total_queries"] = stats.get("total_queries", 0)
        by_subject = stats.get("by_subject", {})
        sorted_subjects = sorted(by_subject.items(), key=lambda x: x[1], reverse=True)[:5]
        query_summary["top_subjects"] = [
            {"subject": subj.replace("_", " "), "queries": count}
            for subj, count in sorted_subjects
        ]

    return {
        "uid": uid,
        "display_name": profile.get("display_name", ""),
        "role": user.get("role", "student"),
        "recent_sessions": recent_sessions,
        "recent_quizzes": recent_quizzes,
        "query_summary": query_summary,
    }
