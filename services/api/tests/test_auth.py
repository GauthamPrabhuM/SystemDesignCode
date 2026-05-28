"""Integration test: register → login → me → refresh → logout."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_full_auth_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register
        r = await client.post(
            "/api/v1/auth/register",
            json={"email": "alice@example.com", "password": "supersecret1", "username": "alice"},
        )
        assert r.status_code == 201, r.text
        user = r.json()
        assert user["email"] == "alice@example.com"
        assert user["plan"] == "free"

        # Duplicate email → 409
        r = await client.post(
            "/api/v1/auth/register",
            json={"email": "alice@example.com", "password": "supersecret1", "username": "alice2"},
        )
        assert r.status_code == 409

        # Login
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com", "password": "supersecret1"},
        )
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        assert token

        # /me
        r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == "alice"

        # Refresh — cookie was set by login
        r = await client.post("/api/v1/auth/refresh")
        assert r.status_code == 200
        new_token = r.json()["access_token"]
        assert new_token

        # Logout
        r = await client.post("/api/v1/auth/logout")
        assert r.status_code == 204

        # Refresh after logout → 401
        r = await client.post("/api/v1/auth/refresh")
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/v1/auth/register",
            json={"email": "bob@example.com", "password": "rightpassword", "username": "bob"},
        )
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob@example.com", "password": "wrongpassword"},
        )
        assert r.status_code == 401
