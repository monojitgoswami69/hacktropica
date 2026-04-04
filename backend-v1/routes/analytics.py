"""
Analytics endpoints — stream, subject detail, overview.
Reads per-user query_stats (populated by routes/search.py _track_query_stats).
Now reads from student_profiles + student_auth instead of the old unified `users` table.
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pytz
from fastapi import APIRouter, Depends
from dependencies import get_db, get_vector_store, get_current_user, require_faculty

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


async def _get_students_with_stats(db, target_stream: str, semester: Optional[str] = None) -> List[dict]:
    """Fetch students from student_profiles and join with query_stats."""
    match_filter: Dict = {}
    if target_stream:
        match_filter["stream"] = target_stream
    if semester:
        match_filter["sem"] = semester

    # Aggregate from student_profiles (metadata table) and join with query_stats
    pipeline = [
        {"$match": match_filter},
        {"$lookup": {"from": "query_stats", "localField": "_id", "foreignField": "_id", "as": "stats"}},
        {"$unwind": {"path": "$stats", "preserveNullAndEmptyArrays": True}},
    ]
    students = []
    async for doc in db.db.student_profiles.aggregate(pipeline):
        stats = doc.get("stats") or {}
        students.append({
            "uid": doc["_id"],
            "name": doc.get("name", doc.get("display_name", "Unknown")),
            "roll": doc.get("roll", "N/A"),
            "stream": doc.get("stream", ""),
            "sem": doc.get("sem", ""),
            "total_queries": stats.get("total_queries", 0),
            "by_subject": stats.get("by_subject", {}),
            "by_module": stats.get("by_module", {}),
            "daily_queries": stats.get("daily_queries", {}),
        })
    return students


@router.get("/stream")
async def stream_analytics(
    semester: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
    vs=Depends(get_vector_store),
):
    require_faculty(user)

    # Get the faculty user's stream from their dashboard profile
    profile = await db.db.dashboard_profiles.find_one({"_id": user["_id"]}) or {}
    target_stream = profile.get("stream", "cse")

    students = await _get_students_with_stats(db, target_stream, semester)

    subject_chunk_counts: Dict[str, int] = {}
    for chunk in vs.chunks.values():
        subj = chunk.subject or "General"
        if semester and chunk.semester and chunk.semester != semester:
            continue
        subject_chunk_counts[subj] = subject_chunk_counts.get(subj, 0) + 1

    subject_query_totals: Dict[str, int] = {}
    for student in students:
        for subj_key, count in student["by_subject"].items():
            clean_subj = subj_key.replace("_", " ")
            subject_query_totals[clean_subj] = subject_query_totals.get(clean_subj, 0) + count

    total_queries = sum(s["total_queries"] for s in students)
    subjects = []
    for subj, chunk_count in sorted(subject_chunk_counts.items(), key=lambda x: x[1], reverse=True):
        query_count = subject_query_totals.get(subj, 0)
        if chunk_count > 0 and query_count > 0:
            proficiency = min(100, round(100 - (query_count / chunk_count * 10)))
        else:
            proficiency = 100 if chunk_count > 0 else 0
        proficiency = max(0, proficiency)
        student_count = sum(
            1 for s in students
            if subj.replace(" ", "_") in s["by_subject"] or subj in [k.replace("_", " ") for k in s["by_subject"]]
        )
        subjects.append({"subject": subj, "total_queries": query_count, "proficiency_score": proficiency, "student_count": student_count})

    net_score = round(sum(s["proficiency_score"] for s in subjects) / len(subjects)) if subjects else 0
    return {"stream": target_stream, "semester": semester, "subjects": subjects, "net_score": net_score, "total_students": len(students), "total_queries": total_queries}


@router.get("/subject/{subject_name}")
async def subject_detail(
    subject_name: str,
    semester: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
    vs=Depends(get_vector_store),
):
    require_faculty(user)

    profile = await db.db.dashboard_profiles.find_one({"_id": user["_id"]}) or {}
    target_stream = profile.get("stream", "cse")

    subject_documents: Dict[str, dict] = {}
    for chunk in vs.chunks.values():
        if chunk.subject and chunk.subject.lower() == subject_name.lower():
            if chunk.document_id not in subject_documents:
                subject_documents[chunk.document_id] = {"document_id": chunk.document_id, "title": chunk.title or chunk.source or "Unknown", "subject": chunk.subject}

    students = await _get_students_with_stats(db, target_stream, semester)
    module_query_totals: Dict[str, dict] = {}
    students_data = []
    safe_subject_key = subject_name.replace(".", "_").replace("/", "_")

    for student in students:
        student_subject_queries = student["by_subject"].get(safe_subject_key, 0)
        if student_subject_queries == 0:
            continue
        top_modules = []
        for doc_id, mod_data in student["by_module"].items():
            if isinstance(mod_data, dict):
                if str(mod_data.get("subject", "")).lower() == subject_name.lower():
                    mod_queries = mod_data.get("queries", 0)
                    if doc_id not in module_query_totals:
                        module_query_totals[doc_id] = {"document_id": doc_id, "title": mod_data.get("title", "Unknown"), "query_count": 0}
                    module_query_totals[doc_id]["query_count"] += mod_queries
                    if mod_queries > 0:
                        top_modules.append(mod_data.get("title", "Unknown"))
        students_data.append({"uid": student["uid"], "name": student["name"], "roll": student["roll"], "total_queries": student_subject_queries, "top_modules": top_modules[:3]})

    for doc_id, doc_info in subject_documents.items():
        safe_doc_id = doc_id.replace(".", "_").replace("/", "_")
        if safe_doc_id not in module_query_totals and doc_id not in module_query_totals:
            module_query_totals[doc_id] = {"document_id": doc_id, "title": doc_info["title"], "query_count": 0}

    students_data.sort(key=lambda s: s["total_queries"], reverse=True)
    modules_list = sorted(module_query_totals.values(), key=lambda m: m["query_count"], reverse=True)
    return {"subject": subject_name, "semester": semester, "stream": target_stream, "modules": modules_list, "students": students_data, "total_queries": sum(s["total_queries"] for s in students_data)}


@router.get("/overview")
async def analytics_overview(user=Depends(get_current_user), db=Depends(get_db)):
    require_faculty(user)

    profile = await db.db.dashboard_profiles.find_one({"_id": user["_id"]}) or {}
    target_stream = profile.get("stream", "cse")

    students = await _get_students_with_stats(db, target_stream)
    total_queries = sum(s["total_queries"] for s in students)

    subject_query_totals: Dict[str, int] = {}
    daily_totals: Dict[str, int] = {}
    student_query_counts = []

    for student in students:
        for subj, count in student["by_subject"].items():
            subject_query_totals[subj] = subject_query_totals.get(subj, 0) + count
        top_subjs = sorted(student["by_subject"].items(), key=lambda x: x[1], reverse=True)[:3]
        student_query_counts.append({"uid": student["uid"], "name": student["name"], "roll": student["roll"], "total_queries": student["total_queries"], "top_subjects": [s[0].replace("_", " ") for s in top_subjs]})
        for date_key, count in student["daily_queries"].items():
            daily_totals[date_key] = daily_totals.get(date_key, 0) + count

    avg_queries = total_queries / len(student_query_counts) if student_query_counts else 0
    at_risk_threshold = max(avg_queries * 2, 10)
    at_risk_students = sorted([s for s in student_query_counts if s["total_queries"] >= at_risk_threshold], key=lambda s: s["total_queries"], reverse=True)

    weak_domains = []
    for subj, count in sorted(subject_query_totals.items(), key=lambda x: x[1], reverse=True)[:5]:
        proficiency = max(0, min(100, round(100 - (count / total_queries * 100)))) if total_queries > 0 else 100
        struggling = [s["name"] for s in student_query_counts if subj in [sub.replace(" ", "_") for sub in s.get("top_subjects", [])] or subj.replace("_", " ") in s.get("top_subjects", [])][:3]
        weak_domains.append({"subject": subj.replace("_", " "), "total_queries": count, "proficiency": proficiency, "struggling_students": struggling})

    ist = pytz.timezone("Asia/Kolkata")
    today = datetime.now(ist)
    weekly_data = [{"date": (today - timedelta(days=i)).strftime("%d/%m/%Y"), "queries": daily_totals.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), 0)} for i in range(6, -1, -1)]

    return {"stream": target_stream, "total_queries": total_queries, "total_students": len(student_query_counts), "at_risk_students": at_risk_students[:10], "at_risk_count": len(at_risk_students), "weak_domains": weak_domains, "weekly_data": weekly_data}
