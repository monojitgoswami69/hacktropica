"""Authentication request / response models."""

from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    display_name: Optional[str] = None


class AuthResponse(BaseModel):
    uid: str
    email: str
    token: str
    role: str
    display_name: str
