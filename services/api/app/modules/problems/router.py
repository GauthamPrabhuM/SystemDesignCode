"""Problems HTTP routes."""
from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.db.session import get_db
from .models import Problem, StarterTemplate

router = APIRouter()


class ProblemSummary(BaseModel):
    slug: str
    title: str
    difficulty: str
    category: str
    is_premium: bool
    time_limit_minutes: int

    model_config = {"from_attributes": True}


class ProblemDetail(ProblemSummary):
    statement_md: str
    constraints: dict


class FileOut(BaseModel):
    path: str
    contents: str


class StarterOut(BaseModel):
    language: str
    files: list[FileOut]
    entrypoint: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProblemSummary])
async def list_problems(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
    difficulty: Literal["easy", "medium", "hard"] | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    stmt = select(Problem).where(Problem.is_published.is_(True))
    if category:
        stmt = stmt.where(Problem.category == category)
    if difficulty:
        stmt = stmt.where(Problem.difficulty == difficulty)
    if q:
        stmt = stmt.where(Problem.title.ilike(f"%{q}%"))
    stmt = stmt.order_by(Problem.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.scalars(stmt)).all()
    return rows


@router.get("/{slug}", response_model=ProblemDetail)
async def get_problem(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    p = await db.scalar(select(Problem).where(Problem.slug == slug, Problem.is_published.is_(True)))
    if not p:
        raise NotFound("Problem not found")
    return p


@router.get("/{slug}/starter", response_model=StarterOut)
async def get_starter(
    slug: str,
    language: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    p = await db.scalar(select(Problem).where(Problem.slug == slug, Problem.is_published.is_(True)))
    if not p:
        raise NotFound("Problem not found")
    st = await db.scalar(
        select(StarterTemplate).where(
            StarterTemplate.problem_id == p.id,
            StarterTemplate.language == language,
        )
    )
    if not st:
        raise NotFound(f"No starter template for language={language}")
    return st
