"""
SystemDesignCode API — FastAPI monolith entrypoint.

Modules are mounted as sub-routers from `app.modules.*`. Each module owns:
- router.py  (HTTP + WS endpoints)
- service.py (business logic, no HTTP knowledge)
- schemas.py (Pydantic models, request/response)
- models.py  (SQLAlchemy ORM)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.errors import AppError, app_error_handler
from app.db.session import engine
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.problems.router import router as problems_router
from app.modules.submissions.router import router as submissions_router
from app.modules.drafts.router    import router as drafts_router
from app.modules.realtime.router import router as realtime_router
from app.modules.contests.router import router as contests_router
from app.modules.interviews.router import router as interviews_router
from app.modules.ai.router import router as ai_router
from app.modules.admin.router import router as admin_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    log.info("api.startup", extra={"env": settings.ENV})
    yield
    await engine.dispose()
    log.info("api.shutdown")


app = FastAPI(
    title="SystemDesignCode API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom errors → RFC 7807
app.add_exception_handler(AppError, app_error_handler)


@app.get("/healthz", tags=["health"])
async def healthz():
    return {"ok": True, "version": app.version}


# /api/v1 mount
API_V1 = "/api/v1"
app.include_router(auth_router,        prefix=f"{API_V1}/auth",        tags=["auth"])
app.include_router(users_router,       prefix=f"{API_V1}/users",       tags=["users"])
app.include_router(problems_router,    prefix=f"{API_V1}/problems",    tags=["problems"])
app.include_router(submissions_router, prefix=f"{API_V1}/submissions", tags=["submissions"])
app.include_router(drafts_router,      prefix=f"{API_V1}/drafts",      tags=["drafts"])
app.include_router(realtime_router,    prefix=f"{API_V1}",             tags=["realtime"])
app.include_router(contests_router,    prefix=f"{API_V1}/contests",    tags=["contests"])
app.include_router(interviews_router,  prefix=f"{API_V1}/interviews",  tags=["interviews"])
app.include_router(ai_router,          prefix=f"{API_V1}/ai",          tags=["ai"])
app.include_router(admin_router,       prefix=f"{API_V1}/admin",       tags=["admin"])


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Attach a request_id for tracing; bubble up to client as header."""
    import uuid
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response
