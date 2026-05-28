"""Auth HTTP routes: register, login, refresh, logout, me."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import current_user
from app.core.errors import Unauthorized
from app.db.session import get_db
from . import service
from .models import User
from .schemas import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter()

REFRESH_COOKIE = "sdc_refresh"


def _set_refresh_cookie(response: Response, refresh_plain: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_plain,
        max_age=settings.JWT_REFRESH_TTL_SECONDS,
        httponly=True,
        secure=settings.ENV == "production",
        samesite="lax",
        path="/api/v1/auth",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await service.register(db, data)


@router.post("/login", response_model=TokenOut)
async def login(
    data: LoginIn,
    response: Response,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ua = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    access, refresh, _ = await service.login(db, data, ua, ip)
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, expires_in=settings.JWT_ACCESS_TTL_SECONDS)


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    sdc_refresh: Annotated[str | None, Cookie()] = None,
):
    if not sdc_refresh:
        raise Unauthorized("No refresh cookie")
    access, _ = await service.refresh(db, sdc_refresh)
    return TokenOut(access_token=access, expires_in=settings.JWT_ACCESS_TTL_SECONDS)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    sdc_refresh: Annotated[str | None, Cookie()] = None,
):
    if sdc_refresh:
        await service.logout(db, sdc_refresh)
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[User, Depends(current_user)]):
    return user
