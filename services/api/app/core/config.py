"""Typed application settings, loaded from env via Pydantic v2."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: Literal["development", "staging", "production"] = "development"
    DATABASE_URL: str = "postgresql+asyncpg://sdc:sdc@localhost:5432/sdc"
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = Field(min_length=16)
    JWT_ALG: Literal["HS256", "EdDSA"] = "HS256"
    JWT_ACCESS_TTL_SECONDS: int = 15 * 60
    JWT_REFRESH_TTL_SECONDS: int = 30 * 24 * 3600

    # OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # Submission quotas (per user, per hour)
    QUOTA_SUBMISSIONS_FREE: int = 50
    QUOTA_SUBMISSIONS_PRO: int = 200

    # AI
    ANTHROPIC_API_KEY: str = ""
    AI_REVIEW_MODEL: str = "claude-sonnet-4-5"
    AI_TRIAGE_MODEL: str = "claude-haiku-4-5"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
