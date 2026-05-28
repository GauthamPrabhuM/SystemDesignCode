"""Shared FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, WebSocket, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Unauthorized
from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not token:
        raise Unauthorized("Missing token")
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except Exception as exc:
        raise Unauthorized("Invalid token") from exc
    user = await get_user_by_id(db, user_id)
    if not user:
        raise Unauthorized("User not found")
    return user


async def ws_auth(websocket: WebSocket, db: AsyncSession) -> User:
    """WebSocket auth: token comes from `?access_token=` query param."""
    token = websocket.query_params.get("access_token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise Unauthorized("Missing token")
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise Unauthorized("Invalid token")
    user = await get_user_by_id(db, user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise Unauthorized("User not found")
    return user
