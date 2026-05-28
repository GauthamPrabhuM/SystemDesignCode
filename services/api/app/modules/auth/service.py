"""Auth business logic. No HTTP knowledge — router layer translates."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import Conflict, Unauthorized
from app.core.security import (
    hash_password,
    issue_access_token,
    new_refresh_token,
    verify_password,
)
from .models import Session as DbSession, User
from .schemas import LoginIn, RegisterIn


def _hash_refresh(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def register(db: AsyncSession, data: RegisterIn) -> User:
    existing = await db.scalar(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing:
        raise Conflict("Email or username already taken")
    user = User(
        email=data.email,
        username=data.username,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login(
    db: AsyncSession, data: LoginIn, user_agent: str | None, ip: str | None
) -> tuple[str, str, User]:
    """Returns (access_token, refresh_token_plain, user)."""
    user = await db.scalar(select(User).where(User.email == data.email))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise Unauthorized("Invalid credentials")
    refresh_plain = new_refresh_token()
    session = DbSession(
        user_id=user.id,
        refresh_token_hash=_hash_refresh(refresh_plain),
        user_agent=user_agent,
        ip=ip,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.JWT_REFRESH_TTL_SECONDS),
    )
    db.add(session)
    await db.commit()
    access = issue_access_token(user.id, user.role, user.plan, str(session.id))
    return access, refresh_plain, user


async def refresh(db: AsyncSession, refresh_plain: str) -> tuple[str, User]:
    h = _hash_refresh(refresh_plain)
    session = await db.scalar(
        select(DbSession).where(
            DbSession.refresh_token_hash == h,
            DbSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if not session:
        raise Unauthorized("Invalid refresh token")
    user = await db.get(User, session.user_id)
    if not user:
        raise Unauthorized("User not found")
    access = issue_access_token(user.id, user.role, user.plan, str(session.id))
    return access, user


async def logout(db: AsyncSession, refresh_plain: str) -> None:
    h = _hash_refresh(refresh_plain)
    session = await db.scalar(select(DbSession).where(DbSession.refresh_token_hash == h))
    if session:
        await db.delete(session)
        await db.commit()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    return await db.get(User, user_id)
