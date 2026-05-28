"""Application errors with RFC 7807 problem+json output."""
from __future__ import annotations

from typing import Any
from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for typed app errors. Carries an HTTP status."""
    status: int = 400
    type_uri: str = "https://systemdesigncode.dev/errors/generic"
    title: str = "Bad request"

    def __init__(self, detail: str | None = None, **extra: Any):
        self.detail = detail or self.title
        self.extra = extra
        super().__init__(self.detail)


class Unauthorized(AppError):
    status = 401
    type_uri = "https://systemdesigncode.dev/errors/unauthorized"
    title = "Unauthorized"


class Forbidden(AppError):
    status = 403
    type_uri = "https://systemdesigncode.dev/errors/forbidden"
    title = "Forbidden"


class NotFound(AppError):
    status = 404
    type_uri = "https://systemdesigncode.dev/errors/not-found"
    title = "Resource not found"


class Conflict(AppError):
    status = 409
    type_uri = "https://systemdesigncode.dev/errors/conflict"
    title = "Conflict"


class QuotaExceeded(AppError):
    status = 429
    type_uri = "https://systemdesigncode.dev/errors/quota-exceeded"
    title = "Quota exceeded"


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    body = {
        "type": exc.type_uri,
        "title": exc.title,
        "status": exc.status,
        "detail": exc.detail,
        "instance": request.url.path,
        **exc.extra,
    }
    return JSONResponse(status_code=exc.status, content=body, media_type="application/problem+json")
