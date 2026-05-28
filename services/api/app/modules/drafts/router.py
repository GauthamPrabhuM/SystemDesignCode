"""Draft autosave routes."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import current_user
from app.core.errors import NotFound
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.problems.models import Draft, Problem

router = APIRouter()


class FileIn(BaseModel):
    path: str = Field(min_length=1, max_length=300)
    contents: str = Field(max_length=200_000)


class DraftIn(BaseModel):
    language: str
    files: list[FileIn]


class DraftOut(BaseModel):
    language: str
    files: list[FileIn]


@router.put("/{slug}", response_model=DraftOut)
async def upsert_draft(
    slug: str,
    data: DraftIn,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    problem = await db.scalar(select(Problem).where(Problem.slug == slug))
    if not problem:
        raise NotFound("Problem not found")
    files_json = [f.model_dump() for f in data.files]
    stmt = pg_insert(Draft.__table__).values(
        user_id=user.id,
        problem_id=problem.id,
        language=data.language,
        files=files_json,
    ).on_conflict_do_update(
        index_elements=["user_id", "problem_id", "language"],
        set_={"files": files_json},
    )
    await db.execute(stmt)
    await db.commit()
    return DraftOut(language=data.language, files=data.files)


@router.get("/{slug}", response_model=DraftOut | None)
async def get_draft(
    slug: str,
    language: str,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    problem = await db.scalar(select(Problem).where(Problem.slug == slug))
    if not problem:
        raise NotFound("Problem not found")
    d = await db.scalar(
        select(Draft).where(
            Draft.user_id == user.id,
            Draft.problem_id == problem.id,
            Draft.language == language,
        )
    )
    if not d:
        return None
    return DraftOut(language=d.language, files=d.files)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    slug: str,
    language: str,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    problem = await db.scalar(select(Problem).where(Problem.slug == slug))
    if not problem:
        return
    d = await db.scalar(
        select(Draft).where(
            Draft.user_id == user.id,
            Draft.problem_id == problem.id,
            Draft.language == language,
        )
    )
    if d:
        await db.delete(d)
        await db.commit()
