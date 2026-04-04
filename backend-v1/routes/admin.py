"""Admin endpoints — student enrollment, curriculum, filters."""
from __future__ import annotations
import csv
import io
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from services.auth import AuthService
from dependencies import get_db, get_vector_store, get_current_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["admin"])


class EnrollRequest(BaseModel):
    csv_data: str
    stream: Optional[str] = None
    semester: Optional[str] = None


class CurriculumSubject(BaseModel):
    name: str
    code: Optional[str] = None


class CurriculumConfig(BaseModel):
    stream: str
    semester: str
    subjects: List[CurriculumSubject]


@router.post("/admin/enroll_students")
async def enroll_students(
    body: EnrollRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
    auth=Depends(lambda r: r.app.state.auth_service),
):
    require_admin(user)
    reader = csv.DictReader(io.StringIO(body.csv_data))
    enrolled, skipped, errors = 0, 0, []

    for row in reader:
        email = (row.get("email") or "").strip()
        name = (row.get("name") or "").strip()
        roll = (row.get("roll") or row.get("roll_no") or "").strip()
        if not email:
            skipped += 1
            continue

        # Check if student already exists in student_auth
        existing = await db.db.student_auth.find_one({"email": email})
        if existing:
            skipped += 1
            continue

        import uuid
        uid = str(uuid.uuid4()).replace("-", "")
        try:
            student_stream = row.get("stream", body.stream or "cse").strip()
            student_sem = row.get("sem", body.semester or "1").strip()

            # Auth record (lean)
            await db.db.student_auth.insert_one({
                "_id": uid,
                "email": email,
                "password_hash": AuthService.hash_password("aot169"),
                "role": "student",
                "created_at": datetime.utcnow(),
            })

            # Profile record (metadata)
            await db.db.student_profiles.insert_one({
                "_id": uid,
                "email": email,
                "display_name": name or email.split("@")[0],
                "name": name,
                "roll": roll,
                "stream": student_stream,
                "sem": student_sem,
                "created_at": datetime.utcnow(),
            })

            enrolled += 1
        except Exception as exc:
            errors.append(f"{email}: {exc}")

    return {
        "enrolled": enrolled,
        "skipped": skipped,
        "errors": errors,
        "message": f"Enrolled {enrolled} students, skipped {skipped}",
    }


@router.get("/students")
async def list_students(
    stream: Optional[str] = None,
    semester: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_admin(user)

    # Query from student_profiles (not auth — no passwords exposed)
    query = {}
    if stream:
        query["stream"] = stream
    if semester:
        query["sem"] = semester

    cursor = db.db.student_profiles.find(query).sort("created_at", -1)
    students = []
    async for s in cursor:
        students.append({
            "uid": s["_id"],
            "email": s.get("email"),
            "name": s.get("name", s.get("display_name", "")),
            "roll": s.get("roll", ""),
            "stream": s.get("stream", ""),
            "sem": s.get("sem", ""),
        })

    return {"students": students, "total": len(students)}


@router.post("/admin/curriculum")
async def set_curriculum(
    body: CurriculumConfig,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    require_admin(user)
    await db.db.curriculum.update_one(
        {"stream": body.stream, "semester": body.semester},
        {
            "$set": {
                "subjects": [s.model_dump() for s in body.subjects],
                "updated_at": datetime.utcnow(),
                "updated_by": user["_id"],
            }
        },
        upsert=True,
    )
    return {"message": f"Curriculum updated for {body.stream} sem {body.semester}"}


@router.get("/filters")
async def get_filters(user=Depends(get_current_user), vs=Depends(get_vector_store)):
    return vs.get_filter_values()
