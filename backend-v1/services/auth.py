"""
JWT Authentication Service
Password hashing, token management, role-based access control.
Uses bcrypt directly (passlib is unmaintained and incompatible with bcrypt>=4.1).
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, List

from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)


class AuthService:
    """Stateless authentication service. Receives config at construction time."""

    def __init__(self, secret_key: str, algorithm: str, expire_minutes: int):
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._expire_minutes = expire_minutes

    # ── Password helpers ──────────────────────────────────────────────

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except Exception as exc:
            logger.warning("Password verification error: %s", exc)
            return False

    # ── JWT helpers ───────────────────────────────────────────────────

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=self._expire_minutes))
        to_encode["exp"] = expire
        return jwt.encode(to_encode, self._secret_key, algorithm=self._algorithm)

    def decode_token(self, token: str) -> Dict:
        try:
            return jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
        except JWTError as exc:
            logger.warning("JWT decode error: %s", exc)
            raise HTTPException(status_code=401, detail="Invalid authentication token")

    # ── User resolution ───────────────────────────────────────────────

    async def get_current_user(self, authorization: Optional[str], db) -> Dict:
        """Resolve Bearer token → user auth document from the correct collection."""
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        token = authorization.split("Bearer ", 1)[1]
        payload = self.decode_token(token)

        uid = payload.get("uid")
        scope = payload.get("scope")  # "dashboard" or "student"
        if not uid or not scope:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Pick the right auth collection based on scope
        if scope == "dashboard":
            collection = db.dashboard_auth
        elif scope == "student":
            collection = db.student_auth
        else:
            raise HTTPException(status_code=401, detail="Invalid token scope")

        user = await collection.find_one({"_id": uid})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Attach scope to the user dict for downstream use
        user["scope"] = scope
        return user

    # ── Authentication (separate collections) ─────────────────────────

    async def authenticate_dashboard_user(self, email: str, password: str, db) -> Optional[Dict]:
        """Verify email + password against dashboard_auth. Returns user dict or None."""
        user = await db.dashboard_auth.find_one({"email": email})
        if not user:
            return None
        if not self.verify_password(password, user["password_hash"]):
            return None
        return user

    async def authenticate_student_user(self, email: str, password: str, db) -> Optional[Dict]:
        """Verify email + password against student_auth. Returns user dict or None."""
        user = await db.student_auth.find_one({"email": email})
        if not user:
            return None
        if not self.verify_password(password, user["password_hash"]):
            return None
        return user

    # ── Role checking (pure, no DB) ───────────────────────────────────

    @staticmethod
    def require_role(user: Dict, allowed_roles: List[str]) -> Dict:
        """Raise 403 if user's role is not in allowed_roles."""
        user_role = user.get("role", "student")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return user
