"""
AI review worker.

Consumes finished submissions from `ai:queue`, builds a structured prompt
from the rubric + code + test results, calls the model, persists the review,
and publishes an `ai_review_done` event on the submission's channel.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import sys
from typing import Any

import anthropic
import asyncpg
from redis.asyncio import Redis, from_url

from settings import settings

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","lvl":"%(levelname)s","msg":"%(message)s","logger":"%(name)s"}',
)
log = logging.getLogger("ai_worker")

STREAM = "ai:queue"
GROUP = "ai_workers"
CONSUMER = os.environ.get("HOSTNAME", "ai-worker-1")

REVIEW_SCHEMA = {
    "name": "design_review",
    "input_schema": {
        "type": "object",
        "properties": {
            "overall_score": {"type": "number", "minimum": 0, "maximum": 100},
            "dimensions": {
                "type": "object",
                "additionalProperties": {"type": "number", "minimum": 0, "maximum": 10},
            },
            "comments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "line": {"type": ["integer", "null"]},
                        "severity": {"enum": ["info", "suggestion", "warning", "critical"]},
                        "category": {"enum": ["solid", "pattern", "concurrency", "naming", "style", "extensibility", "correctness"]},
                        "message": {"type": "string"},
                    },
                    "required": ["file", "severity", "category", "message"],
                },
            },
            "detected_patterns": {"type": "array", "items": {"type": "string"}},
            "missing_patterns": {"type": "array", "items": {"type": "string"}},
            "summary_md": {"type": "string"},
        },
        "required": ["overall_score", "dimensions", "comments", "summary_md"],
    },
}


SYSTEM_PROMPT = """You are an experienced senior backend engineer reviewing a candidate's solution
to a Low-Level Design / Machine Coding interview problem. Your review should be:

- Specific and actionable (point to files and lines)
- Calibrated: don't penalize stylistic choices; focus on SOLID violations,
  poor abstractions, missing patterns the rubric expects, concurrency bugs,
  and clear extensibility issues.
- Encouraging where the candidate did well.

Return your review using the `design_review` tool. Score dimensions on 0-10 scale,
overall_score on 0-100. Only critical issues should be severity 'critical'."""


async def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.warning("ANTHROPIC_API_KEY not set; ai_worker exiting")
        return

    client = anthropic.AsyncAnthropic()
    redis: Redis = from_url(settings.REDIS_URL, decode_responses=True)
    pg = await asyncpg.create_pool(
        settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"),
        min_size=1, max_size=4,
    )

    try:
        await redis.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except Exception:
        pass

    log.info("ai_worker ready consumer=%s", CONSUMER)

    while True:
        msgs = await redis.xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=1, block=5_000)
        if not msgs:
            continue
        for _stream, entries in msgs:
            for msg_id, data in entries:
                try:
                    await handle_one(client, redis, pg, json.loads(data["job"]))
                    await redis.xack(STREAM, GROUP, msg_id)
                except Exception:
                    log.exception("ai_worker.error")
                    await redis.xack(STREAM, GROUP, msg_id)


async def handle_one(client: anthropic.AsyncAnthropic, redis: Redis, pg: asyncpg.Pool, job: dict) -> None:
    sub_id = job["submission_id"]
    problem_id = job["problem_id"]

    # Fetch submission + rubric
    sub = await pg.fetchrow("SELECT files, language FROM submissions WHERE id = $1", sub_id)
    if not sub:
        return
    problem = await pg.fetchrow("SELECT slug, title, statement_md, rubric FROM problems WHERE id = $1", problem_id)

    # Cache: same problem+code → same review
    code_hash = _hash_files(sub["files"])
    cache_key = f"ai_review:{problem_id}:{code_hash}"
    cached = await redis.get(cache_key)
    if cached:
        review_id = json.loads(cached)["id"]
        await _publish_done(redis, sub_id, review_id)
        return

    # Build prompt
    rubric = problem["rubric"] or {}
    files_text = "\n\n".join(
        f"--- FILE: {f['path']} ---\n{f['contents']}" for f in (sub["files"] if isinstance(sub["files"], list) else json.loads(sub["files"]))
    )
    user_msg = f"""# Problem
{problem['title']}

{problem['statement_md']}

# Rubric
{json.dumps(rubric, indent=2)}

# Candidate submission ({sub['language']})

{files_text}

Use the design_review tool to deliver a structured review."""

    resp = await client.messages.create(
        model=settings.AI_REVIEW_MODEL if hasattr(settings, "AI_REVIEW_MODEL") else "claude-sonnet-4-5",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        tools=[REVIEW_SCHEMA],
        tool_choice={"type": "tool", "name": "design_review"},
        messages=[{"role": "user", "content": user_msg}],
    )

    review = None
    for block in resp.content:
        if block.type == "tool_use" and block.name == "design_review":
            review = block.input
            break
    if not review:
        log.warning("no tool_use returned for submission=%s", sub_id)
        return

    row = await pg.fetchrow(
        """
        INSERT INTO ai_reviews (submission_id, model, overall_score, dimensions, comments, summary_md)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        sub_id, resp.model,
        review["overall_score"], json.dumps(review["dimensions"]),
        json.dumps(review["comments"]), review.get("summary_md", ""),
    )
    review_id = str(row["id"])
    await redis.set(cache_key, json.dumps({"id": review_id}), ex=86_400 * 7)
    await _publish_done(redis, sub_id, review_id)


async def _publish_done(redis: Redis, sub_id: str, review_id: str) -> None:
    payload = json.dumps({"type": "ai_review_done", "review_id": review_id})
    await redis.publish(f"submission:{sub_id}", payload)
    await redis.rpush(f"submission:{sub_id}:events", payload)


def _hash_files(files: Any) -> str:
    if isinstance(files, str):
        files = json.loads(files)
    canonical = json.dumps(sorted(files, key=lambda f: f["path"]), sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
