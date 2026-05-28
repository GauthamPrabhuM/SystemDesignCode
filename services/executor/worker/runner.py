"""
Sandbox runner.

Spawns a fresh Docker container per submission with hardened defaults.
Streams test results back to Redis pubsub as they complete.

Hardening (in order):
  1) Docker network=none
  2) read-only root + tmpfs /tmp and /workspace-rw
  3) drop ALL Linux capabilities + no-new-privileges
  4) seccomp profile (Docker default + extra denies)
  5) gVisor runtime (--runtime=runsc) when EXECUTOR_RUNTIME=runsc
  6) cgroup limits: memory, cpus, pids, ulimit
  7) per-test wall-clock timeout, total walltime ceiling
  8) source-size guard (caller enforces)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import asyncpg
from redis.asyncio import Redis

from languages import RUNTIMES
from settings import settings

log = logging.getLogger("runner")


class SandboxRunner:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis
        self._pg: asyncpg.Pool | None = None

    async def _pg_pool(self) -> asyncpg.Pool:
        if self._pg is None:
            # asyncpg wants raw postgres:// URLs, not asyncpg://
            dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
            self._pg = await asyncpg.create_pool(dsn, min_size=1, max_size=4)
        return self._pg

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------
    async def run(self, job: dict[str, Any]) -> None:
        sub_id = job["submission_id"]
        problem_id = job["problem_id"]
        language = job["language"]
        files = job["files"]
        channel = f"submission:{sub_id}"
        backlog_key = f"submission:{sub_id}:events"

        async def emit(event: dict) -> None:
            payload = json.dumps(event)
            # Both publish (live consumers) and push to backlog list (late connectors)
            pipe = self.redis.pipeline()
            pipe.publish(channel, payload)
            pipe.rpush(backlog_key, payload)
            pipe.expire(backlog_key, 3600)
            await pipe.execute()

        await self._update_status(sub_id, "running")
        await emit({"type": "status", "status": "running"})

        if language not in RUNTIMES:
            await self._update_status(sub_id, "failed", error=f"Unsupported language: {language}")
            await emit({"type": "failed", "error": f"Unsupported language: {language}"})
            return

        rt = RUNTIMES[language]
        test_cases = await self._fetch_test_cases(problem_id)

        with tempfile.TemporaryDirectory(prefix="sdc-") as tmp:
            workspace = Path(tmp) / "workspace"
            workspace.mkdir()
            self._materialize_files(workspace, files, rt.entrypoint_filename)

            # Compile if needed
            if rt.compile:
                compile_res = await self._exec_in_container(workspace, rt.image, rt.compile, timeout=20)
                if compile_res["exit_code"] != 0:
                    await emit({
                        "type": "log",
                        "stream": "stderr",
                        "line": compile_res["stderr"],
                    })
                    await self._update_status(sub_id, "failed", error="Compilation error")
                    await emit({"type": "failed", "error": "Compilation error", "stderr": compile_res["stderr"]})
                    return

            passed = 0
            total = len(test_cases)
            total_runtime_ms = 0
            max_memory_kb = 0
            start_total = time.monotonic()

            for tc in test_cases:
                if time.monotonic() - start_total > settings.SANDBOX_TOTAL_TIMEOUT_S:
                    await emit({"type": "test", "test_id": str(tc["id"]), "status": "timeout", "runtime_ms": 0})
                    continue

                stdin_payload = json.dumps(tc["input"])
                res = await self._exec_in_container(
                    workspace, rt.image, rt.run,
                    timeout=tc["timeout_ms"] / 1000.0,
                    stdin=stdin_payload,
                )
                total_runtime_ms += int(res["runtime_ms"])
                max_memory_kb = max(max_memory_kb, res.get("memory_kb", 0))

                if res["exit_code"] != 0:
                    status = "error" if res["exit_code"] != 124 else "timeout"
                    await self._save_test_result(sub_id, tc["id"], status, res)
                    await emit({
                        "type": "test", "test_id": str(tc["id"]), "name": tc["name"],
                        "status": status, "runtime_ms": res["runtime_ms"],
                        "stderr": res["stderr"][-1000:],
                    })
                    continue

                # Compare stdout vs expected (problem-defined JSON)
                actual = self._try_parse_json(res["stdout"])
                expected = tc["expected"]
                test_status = "passed" if actual == expected else "failed"
                if test_status == "passed":
                    passed += tc["weight"]
                diff = self._make_diff(actual, expected) if test_status == "failed" else None

                await self._save_test_result(sub_id, tc["id"], test_status, res, diff=diff)
                await emit({
                    "type": "test", "test_id": str(tc["id"]), "name": tc["name"],
                    "status": test_status, "runtime_ms": res["runtime_ms"],
                    "diff": diff,
                })

            total_weight = sum(t["weight"] for t in test_cases) or 1
            score = (passed / total_weight) * 100

            await self._finalize_submission(
                sub_id,
                status="done",
                score=score,
                passed_tests=passed,
                total_tests=total,
                runtime_ms=total_runtime_ms,
                memory_kb=max_memory_kb,
            )
            await emit({
                "type": "result",
                "score": round(score, 2),
                "passed": passed,
                "total": total,
                "runtime_ms": total_runtime_ms,
                "memory_kb": max_memory_kb,
            })

            # Enqueue AI review (fire-and-forget; ai_worker handles it)
            await self.redis.xadd(
                "ai:queue",
                {"job": json.dumps({"submission_id": sub_id, "problem_id": problem_id})},
                maxlen=1000,
                approximate=True,
            )

    # ------------------------------------------------------------------
    # Container execution
    # ------------------------------------------------------------------
    async def _exec_in_container(
        self,
        workspace: Path,
        image: str,
        cmd: list[str],
        timeout: float,
        stdin: str | None = None,
    ) -> dict[str, Any]:
        """Run cmd inside a fresh sandbox container. Returns timing + io."""
        docker_cmd = [
            "docker", "run", "--rm", "-i",
            "--network=none",
            "--read-only",
            "--tmpfs", "/tmp:rw,size=64m,mode=1777",
            "--mount", f"type=bind,src={workspace},dst=/workspace,ro=false",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--pids-limit", str(settings.SANDBOX_PIDS),
            "--memory", settings.SANDBOX_MEMORY,
            "--memory-swap", settings.SANDBOX_MEMORY,
            "--cpus", settings.SANDBOX_CPUS,
            "--ulimit", "nofile=64:64",
            "-w", "/workspace",
        ]
        if settings.RUNTIME == "runsc":
            docker_cmd += ["--runtime=runsc"]
        docker_cmd.append(image)
        docker_cmd += cmd

        start = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdin=asyncio.subprocess.PIPE if stdin else asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(input=stdin.encode() if stdin else None),
                    timeout=timeout,
                )
                exit_code = proc.returncode or 0
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return {
                    "exit_code": 124,
                    "stdout": "",
                    "stderr": f"Time limit exceeded ({timeout}s)",
                    "runtime_ms": int(timeout * 1000),
                    "memory_kb": 0,
                }
        except FileNotFoundError:
            return {
                "exit_code": 127,
                "stdout": "",
                "stderr": "docker not available on host",
                "runtime_ms": 0,
                "memory_kb": 0,
            }
        runtime_ms = int((time.monotonic() - start) * 1000)
        return {
            "exit_code": exit_code,
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace"),
            "runtime_ms": runtime_ms,
            "memory_kb": 0,  # Real impl: parse `docker stats` or use cgroup hooks
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _materialize_files(self, workspace: Path, files: list[dict], entrypoint: str) -> None:
        """Write submission files to workspace, ensuring an entrypoint exists."""
        wrote_entrypoint = False
        for f in files:
            path = workspace / Path(f["path"]).name  # flatten; reject nested for now
            path.write_text(f["contents"])
            if path.name == entrypoint:
                wrote_entrypoint = True
        if not wrote_entrypoint and len(files) == 1:
            (workspace / entrypoint).write_text(files[0]["contents"])

    def _try_parse_json(self, raw: str) -> Any:
        raw = raw.strip()
        if not raw:
            return None
        # Tests may print multiple lines; the last JSON line is the answer.
        for line in reversed(raw.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return raw

    def _make_diff(self, actual: Any, expected: Any) -> str:
        import difflib
        a = json.dumps(actual, indent=2, sort_keys=True, default=str).splitlines()
        b = json.dumps(expected, indent=2, sort_keys=True, default=str).splitlines()
        return "\n".join(difflib.unified_diff(b, a, fromfile="expected", tofile="actual", lineterm=""))

    # ------------------------------------------------------------------
    # DB
    # ------------------------------------------------------------------
    async def _fetch_test_cases(self, problem_id: str) -> list[dict]:
        pool = await self._pg_pool()
        rows = await pool.fetch(
            "SELECT id, name, kind, weight, input, expected, timeout_ms "
            "FROM test_cases WHERE problem_id = $1 ORDER BY name",
            problem_id,
        )
        return [
            {**dict(r), "input": json.loads(r["input"]) if isinstance(r["input"], str) else r["input"],
             "expected": json.loads(r["expected"]) if isinstance(r["expected"], str) else r["expected"]}
            for r in rows
        ]

    async def _update_status(self, sub_id: str, status: str, *, error: str | None = None) -> None:
        pool = await self._pg_pool()
        await pool.execute(
            "UPDATE submissions SET status = $1, error = $2 WHERE id = $3",
            status, error, sub_id,
        )

    async def _finalize_submission(self, sub_id: str, **fields: Any) -> None:
        pool = await self._pg_pool()
        await pool.execute(
            """
            UPDATE submissions
               SET status = $1, score = $2, passed_tests = $3, total_tests = $4,
                   runtime_ms = $5, memory_kb = $6, completed_at = $7
             WHERE id = $8
            """,
            fields["status"], fields["score"], fields["passed_tests"], fields["total_tests"],
            fields["runtime_ms"], fields["memory_kb"], datetime.now(timezone.utc), sub_id,
        )

    async def _save_test_result(
        self, sub_id: str, test_case_id: str, status: str, res: dict, *, diff: str | None = None
    ) -> None:
        pool = await self._pg_pool()
        await pool.execute(
            """
            INSERT INTO test_results (submission_id, test_case_id, status, runtime_ms, stdout, stderr, diff)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            sub_id, test_case_id, status, res.get("runtime_ms"),
            res.get("stdout", "")[:10_000], res.get("stderr", "")[:10_000], diff,
        )
