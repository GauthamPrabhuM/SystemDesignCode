"""WebSocket — submission event streaming.

Protocol:
  Client connects with ?access_token=<jwt>
  Server replays backlog → subscribes to live Redis pubsub channel.
  Server closes once terminal (result/failed/timeout) + AI review arrive,
  or after AI_REVIEW_GRACE_S seconds post-terminal with no AI review.
"""
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.security import decode_access_token
from app.db.redis import redis
from app.db.session import SessionLocal
from app.modules.problems.models import Submission

log = logging.getLogger(__name__)
router = APIRouter()

AI_REVIEW_GRACE_S = 30


async def _authenticate_ws(websocket: WebSocket) -> UUID | None:
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
    user_id = await _authenticate_ws(websocket)
    if user_id is None:
        return

    async with SessionLocal() as db:
        sub = await db.get(Submission, submission_id)
        if not sub or sub.user_id != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()

    channel = f"submission:{submission_id}"
    backlog_key = f"submission:{submission_id}:events"
    pubsub = redis.pubsub()

    # Event that signals the main loop to stop (terminal event received)
    terminal_event = asyncio.Event()
    done_event = asyncio.Event()  # set when we should close completely

    async def _send(text: str) -> None:
        """Send to WS and track terminal/ai events."""
        await websocket.send_text(text)
        try:
            ev = json.loads(text)
            etype = ev.get("type")
            if etype in ("result", "failed", "timeout"):
                terminal_event.set()
            if etype == "ai_review_done":
                done_event.set()
                terminal_event.set()
        except Exception:
            pass

    async def _listen() -> None:
        """Forward pubsub messages to the WebSocket until done."""
        await pubsub.subscribe(channel)
        try:
            async for msg in pubsub.listen():
                if done_event.is_set():
                    break
                if msg.get("type") != "message":
                    continue
                data = msg["data"]
                text = data if isinstance(data, str) else data.decode()
                await _send(text)
        except Exception:
            pass

    async def _timeout_after_terminal() -> None:
        """After terminal event, wait AI_REVIEW_GRACE_S then close."""
        await terminal_event.wait()
        if not done_event.is_set():
            await asyncio.sleep(AI_REVIEW_GRACE_S)
        done_event.set()

    try:
        # Replay backlog for clients that connect after execution started
        for raw in await redis.lrange(backlog_key, 0, -1):
            text = raw if isinstance(raw, str) else raw.decode()
            await _send(text)

        if not done_event.is_set():
            # Run listener + timeout concurrently; whichever ends first wins
            listener_task = asyncio.create_task(_listen())
            timeout_task = asyncio.create_task(_timeout_after_terminal())
            await done_event.wait()
            listener_task.cancel()
            timeout_task.cancel()
            await asyncio.gather(listener_task, timeout_task, return_exceptions=True)

    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws.error sid=%s", submission_id)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            pass
