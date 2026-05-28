"""WebSocket endpoints — submission streaming + interview collaboration.

Pattern: each WS connection subscribes to a Redis pubsub channel scoped to
the resource (submission_id / interview room). The executor publishes events
to that channel; this hub fans them out to connected clients.

This keeps the WS hub stateless (any API replica can serve any client).
"""
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.redis import redis
from app.db.session import SessionLocal
from app.modules.problems.models import Submission

log = logging.getLogger(__name__)
router = APIRouter()


async def _authenticate_ws(websocket: WebSocket) -> UUID | None:
    """Returns user_id or None (and closes socket) if auth fails."""
    token = websocket.query_params.get("access_token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    try:
        payload = decode_access_token(token)
        return UUID(payload["sub"])
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None


@router.websocket("/submissions/{submission_id}/stream")
async def submission_stream(websocket: WebSocket, submission_id: UUID):
    """Stream a submission's events: status, log, test, result, ai_review_done.

    Protocol:
        Client connects with ?access_token=<jwt>
        Server replays any cached events (LRANGE), then subscribes to live channel.
        Server emits JSON lines.
    """
    user_id = await _authenticate_ws(websocket)
    if user_id is None:
        return

    # Authorize: user must own the submission
    async with SessionLocal() as db:  # type: AsyncSession
        sub = await db.get(Submission, submission_id)
        if not sub or sub.user_id != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()
    channel = f"submission:{submission_id}"
    backlog_key = f"submission:{submission_id}:events"

    pubsub = redis.pubsub()
    try:
        # 1) Replay backlog so clients that connect late don't miss "running"
        backlog = await redis.lrange(backlog_key, 0, -1)
        for raw in backlog:
            await websocket.send_text(raw)

        # 2) Subscribe live
        await pubsub.subscribe(channel)
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            data = msg["data"]
            await websocket.send_text(data if isinstance(data, str) else data.decode())
            # Close socket on terminal event so the client knows to stop waiting.
            try:
                event = json.loads(data)
                if event.get("type") in ("result", "failed", "timeout"):
                    # Let AI review event come through afterward; don't auto-close.
                    pass
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws.submission_stream.error", extra={"submission_id": str(submission_id)})
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass


# Interview room WS would go here — Yjs sync handled by a separate handler.
