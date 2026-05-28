FROM python:3.12-slim

# Pre-install commonly needed libs so submissions don't pip-install at runtime.
# Anything not listed here is unavailable to the sandbox — that's the point.
RUN pip install --no-cache-dir \
    pytest==8.* \
    pydantic==2.*

# Non-root user; sandbox container also gets --read-only and dropped caps.
RUN useradd --create-home --shell /bin/bash runner
USER runner
WORKDIR /workspace
