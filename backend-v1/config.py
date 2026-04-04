"""
Configuration Management
Centralized settings using Pydantic Settings with validation
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings — validated on startup, fails fast on missing required values."""

    # MongoDB
    mongodb_url: str = Field(..., alias="MONGODB_URL")
    mongodb_db_name: str = Field(default="vidyarthi_saarthi", alias="MONGODB_DB_NAME")

    # Qdrant
    qdrant_mode: str = Field(default="local", alias="QDRANT_MODE")  # local | server | cloud
    qdrant_path: str = Field(default="./qdrant_data", alias="QDRANT_PATH")
    qdrant_host: Optional[str] = Field(default=None, alias="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, alias="QDRANT_PORT")
    qdrant_url: Optional[str] = Field(default=None, alias="QDRANT_URL")
    qdrant_api_key: Optional[str] = Field(default=None, alias="QDRANT_API_KEY")
    qdrant_collection: str = Field(default="documents", alias="QDRANT_COLLECTION")

    # Gemini LLM
    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")
    gemini_quiz_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_QUIZ_MODEL")

    # JWT Authentication
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(default=10080, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")

    # Embeddings
    embedding_model: str = Field(default="intfloat/multilingual-e5-small", alias="EMBEDDING_MODEL")
    embedding_dim: int = Field(default=384, alias="EMBEDDING_DIM")
    hf_token: Optional[str] = Field(default=None, alias="HF_TOKEN")

    # Text Processing
    chunk_size: int = Field(default=500, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(default=50, alias="CHUNK_OVERLAP")
    retrieval_top_k: int = Field(default=5, alias="RETRIEVAL_TOP_K")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8001, alias="PORT")
    reload: bool = Field(default=False, alias="RELOAD")

    # CORS
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
        alias="CORS_ORIGINS",
    )

    # R2 Storage (Cloudflare)
    r2_account_id: Optional[str] = Field(default=None, alias="R2_ACCOUNT_ID")
    r2_access_key_id: Optional[str] = Field(default=None, alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: Optional[str] = Field(default=None, alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str = Field(default="vidyarthi-saarthi", alias="R2_BUCKET_NAME")
    r2_public_url: Optional[str] = Field(default=None, alias="R2_PUBLIC_URL")  # e.g. https://pub-xxx.r2.dev

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    model_config = {
        "env_file": ".env",
        "populate_by_name": True,
        "case_sensitive": False,
    }
