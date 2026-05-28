"""
Minimal HTTP healthcheck server.

Fly's auto-start/auto-stop machine routing needs an HTTP endpoint to wake
the worker. This serves /healthz alongside the actual queue consumer.
"""
from __future__ import annotations

import asyncio
import logging
from aiohttp import web

log = logging.getLogger("healthcheck")


async def healthz(_req: web.Request) -> web.Response:
    return web.json_response({"ok": True})


async def start_healthcheck_server(port: int = 9100) -> None:
    app = web.Application()
    app.router.add_get("/healthz", healthz)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    log.info("healthcheck server on :%d", port)
