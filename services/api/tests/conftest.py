"""Test fixtures."""
from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db.session import SessionLocal, engine


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Truncate volatile tables between tests."""
    async with SessionLocal() as session:
        await session.execute(text(
            "TRUNCATE TABLE sessions, oauth_accounts, users RESTART IDENTITY CASCADE"
        ))
        await session.commit()
    yield
