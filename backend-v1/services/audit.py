"""
Audit logging service — records all data-changing operations.

Actions recorded:
- document.create, document.delete
- student.enroll, student.delete
- curriculum.update
- user.register, user.login
- quiz.submit
- profile.update
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


async def log_audit(
    db,
    *,
    action: str,
    user_id: str,
    user_email: str = "",
    role: str = "",
    target_type: str = "",
    target_id: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Insert an audit log entry.

    Parameters
    ----------
    db          : Database instance (has db.db)
    action      : Dot-notation verb, e.g. "document.create"
    user_id     : UID of the actor
    user_email  : Email of the actor (for display)
    role        : Role of the actor (admin, hod, faculty, student)
    target_type : What was acted on (document, student, curriculum, etc.)
    target_id   : ID of the target object
    details     : Any extra context (e.g. {"title": "notes.pdf", "stream": "cse"})
    """
    entry = {
        "action": action,
        "user_id": user_id,
        "user_email": user_email,
        "role": role,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "timestamp": datetime.utcnow(),
    }
    try:
        await db.db.audit_logs.insert_one(entry)
    except Exception as exc:
        logger.warning("Failed to write audit log: %s", exc)
