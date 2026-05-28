"""Redis async client. One per-process connection pool."""
from __future__ import annotations

from redis.asyncio import Redis, from_url

from app.core.config import settings

redis: Redis = from_url(settings.REDIS_URL, decode_responses=True, max_connections=50)
