"""Executor settings, env-driven."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://sdc:sdc@localhost:5432/sdc"
    )
    RUNTIME: str = os.environ.get("EXECUTOR_RUNTIME", "docker")  # docker | runsc
    SANDBOX_MEMORY: str = os.environ.get("SANDBOX_MEMORY", "256m")
    SANDBOX_CPUS: str = os.environ.get("SANDBOX_CPUS", "0.5")
    SANDBOX_PIDS: int = int(os.environ.get("SANDBOX_PIDS", "64"))
    SANDBOX_TIMEOUT_S: int = int(os.environ.get("SANDBOX_TIMEOUT_S", "10"))
    SANDBOX_TOTAL_TIMEOUT_S: int = int(os.environ.get("SANDBOX_TOTAL_TIMEOUT_S", "60"))
    DOCKER_HOST: str = os.environ.get("DOCKER_HOST", "unix:///var/run/docker.sock")


settings = Settings()
