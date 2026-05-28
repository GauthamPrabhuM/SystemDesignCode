"""Submission lifecycle: validate, quota-check, persist, enqueue."""
from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFound, QuotaExceeded
from app.db.redis import redis
from app.modules.problems.models import Problem, Submission, TestCase

SUBMISSION_STREAM = "submissions:queue"
MAX_SOURCE_BYTES = 200_000


async def _quota_check(user_id: UUID, plan: str) -> None:
    """Sliding-hour quota using a Redis key with TTL."""
    limit = settings.QUOTA_SUBMISSIONS_PRO if plan in ("pro", "team") else settings.QUOTA_SUBMISSIONS_FREE
    key = f"quota:sub:{user_id}"
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 3600)
    if n > limit:
        raise QuotaExceeded(f"Submission quota: {limit}/hour")


def _validate_files(files: list[dict]) -> None:
    total = sum(len(f.get("contents", "")) for f in files)
    if total > MAX_SOURCE_BYTES:
        from app.core.errors import AppError
        raise AppError("Source too large", **{"limit_bytes": MAX_SOURCE_BYTES})


async def create_submission(
    db: AsyncSession,
    user_id: UUID,
    user_plan: str,
    problem_slug: str,
    language: str,
    files: list[dict],
) -> Submission:
    _validate_files(files)
    await _quota_check(user_id, user_plan)

    problem = await db.scalar(
        select(Problem).where(Problem.slug == problem_slug, Problem.is_published.is_(True))
    )
    if not problem:
        raise NotFound("Problem not found")

    total_tests = await db.scalar(
        select(func.count()).select_from(TestCase).where(TestCase.problem_id == problem.id)
    ) or 0

    sub = Submission(
        user_id=user_id,
        problem_id=problem.id,
        language=language,
        files=files,
        status="queued",
        total_tests=total_tests,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    # Enqueue
    job = {
        "submission_id": str(sub.id),
        "problem_id": str(problem.id),
        "language": language,
        "files": files,
    }
    await redis.xadd(SUBMISSION_STREAM, {"job": json.dumps(job)}, maxlen=10_000, approximate=True)
    return sub


async def get_submission(db: AsyncSession, submission_id: UUID, user_id: UUID) -> Submission:
    sub = await db.get(Submission, submission_id)
    if not sub or sub.user_id != user_id:
        raise NotFound("Submission not found")
    return sub
