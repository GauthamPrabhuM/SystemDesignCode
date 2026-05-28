"""
SystemDesignCode Executor Worker

Consumes submission jobs from the Redis stream, runs them in isolated
Docker containers, streams results back via Redis pubsub.

Designed to scale horizontally: N workers can join the consumer group
and Redis handles work distribution + recovery from crashed consumers.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import socket
import sys
from typing import Any

from redis.asyncio import Redis, from_url

from runner import SandboxRunner
from settings import settings

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","lvl":"%(levelname)s","msg":"%(message)s","logger":"%(name)s"}',
)
log = logging.getLogger("executor")

STREAM = "submissions:queue"
GROUP = "executors"
DLQ = "submissions:dlq"
CONSUMER = os.environ.get("HOSTNAME") or socket.gethostname()


class Worker:
    def __init__(self) -> None:
        self.redis: Redis = from_url(settings.REDIS_URL, decode_responses=True)
        self.runner = SandboxRunner(self.redis)
        self._stopping = asyncio.Event()

    async def setup(self) -> None:
        try:
            await self.redis.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
            log.info("created consumer group: %s", GROUP)
        except Exception:
            pass  # already exists
        log.info("worker ready consumer=%s", CONSUMER)

    async def claim_stale(self) -> None:
        """Reclaim jobs whose previous consumer died (pending > 5min)."""
        try:
            claimed = await self.redis.xautoclaim(
                STREAM, GROUP, CONSUMER, min_idle_time=300_000, start_id="0-0", count=10
            )
            if claimed and claimed[1]:
                log.info("reclaimed %d stale jobs", len(claimed[1]))
        except Exception as e:
            log.warning("xautoclaim failed: %s", e)

    async def run(self) -> None:
        await self.setup()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._stopping.set)

        while not self._stopping.is_set():
            await self.claim_stale()
            try:
                # Block up to 5s waiting for new work
                msgs = await self.redis.xreadgroup(
                    GROUP, CONSUMER, {STREAM: ">"}, count=1, block=5_000
                )
            except Exception:
                log.exception("xreadgroup failed; sleeping")
                await asyncio.sleep(1)
                continue

            if not msgs:
                continue

            for _stream, entries in msgs:
                for msg_id, data in entries:
                    await self._handle(msg_id, data)

        log.info("worker shutting down cleanly")
        await self.redis.close()

    async def _handle(self, msg_id: str, data: dict[str, Any]) -> None:
        try:
            job = json.loads(data["job"])
            log.info("job.start submission=%s", job["submission_id"])
            await self.runner.run(job)
            await self.redis.xack(STREAM, GROUP, msg_id)
            log.info("job.done submission=%s", job["submission_id"])
        except Exception as e:
            log.exception("job.error msg_id=%s", msg_id)
            try:
                await self.redis.xadd(DLQ, {"msg_id": msg_id, "err": str(e), "data": json.dumps(data)})
                await self.redis.xack(STREAM, GROUP, msg_id)  # don't loop on poison
            except Exception:
                log.exception("dlq write failed")


def main() -> int:
    try:
        asyncio.run(Worker().run())
        return 0
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
