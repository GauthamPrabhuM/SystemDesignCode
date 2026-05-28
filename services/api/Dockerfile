FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for asyncpg, argon2, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN if [ -f requirements.txt ]; then pip install -r requirements.txt; \
    else pip install \
        "fastapi>=0.115" \
        "uvicorn[standard]>=0.30" \
        "sqlalchemy[asyncio]>=2.0" \
        "asyncpg>=0.29" \
        "alembic>=1.13" \
        "pydantic>=2.6" \
        "pydantic-settings>=2.2" \
        "PyJWT>=2.8" \
        "argon2-cffi>=23.1" \
        "redis>=5.0" \
        "httpx>=0.27" \
        "anthropic>=0.39" ; \
    fi

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
