"""Submission HTTP routes."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import current_user
from app.db.session import get_db
from app.modules.auth.models import User
from . import service

router = APIRouter()


# ---------- Schemas ----------
class FileIn(BaseModel):
    path: str = Field(min_length=1, max_length=300)
    contents: str = Field(max_length=200_000)


class SubmissionCreateIn(BaseModel):
    problem_slug: str
    language: Literal["python", "java", "cpp", "go", "typescript", "javascript"]
    files: list[FileIn] = Field(min_length=1, max_length=20)


class SubmissionOut(BaseModel):
    id: UUID
    status: str
    score: float | None
    passed_tests: int | None
    total_tests: int | None
    runtime_ms: int | None
    memory_kb: int | None
    error: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ---------- Routes ----------
@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def create(
    data: SubmissionCreateIn,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    sub = await service.create_submission(
        db,
        user_id=user.id,
        user_plan=user.plan,
        problem_slug=data.problem_slug,
        language=data.language,
        files=[f.model_dump() for f in data.files],
    )
    return sub


@router.get("/{submission_id}", response_model=SubmissionOut)
async def get(
    submission_id: UUID,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await service.get_submission(db, submission_id, user.id)
