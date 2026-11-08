import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def auth_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RESHIS_AVIA_DB", str(tmp_path / "users.db"))
    with TestClient(app) as client:
        yield client


def test_registration_creates_session_and_hashes_password(
    auth_client: TestClient,
    tmp_path: Path,
) -> None:
    response = auth_client.post(
        "/api/auth/register",
        json={"email": "Pilot@Example.com", "password": "Flight2026"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "pilot@example.com"
    assert "reshis_session=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]

    current_user = auth_client.get("/api/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["email"] == "pilot@example.com"

    with sqlite3.connect(tmp_path / "users.db") as connection:
        password_hash = connection.execute(
            "SELECT password_hash FROM users WHERE email = ?",
            ("pilot@example.com",),
        ).fetchone()[0]
        session_token = connection.execute("SELECT token_hash FROM sessions").fetchone()[0]

    assert password_hash != "Flight2026"
    assert password_hash.startswith("scrypt$")
    assert "Flight2026" not in password_hash
    assert auth_client.cookies["reshis_session"] != session_token


def test_duplicate_email_and_invalid_registration(auth_client: TestClient) -> None:
    payload = {"email": "user@example.com", "password": "Secure123"}
    assert auth_client.post("/api/auth/register", json=payload).status_code == 201

    duplicate = auth_client.post(
        "/api/auth/register",
        json={"email": "USER@example.com", "password": "Another123"},
    )
    assert duplicate.status_code == 409

    invalid_payloads = [
        {"email": "not-an-email", "password": "Secure123"},
        {"email": "user2@example.com", "password": "short1"},
        {"email": "user2@example.com", "password": "onlyletters"},
        {"email": "user2@example.com", "password": "12345678"},
    ]
    for invalid_payload in invalid_payloads:
        response = auth_client.post("/api/auth/register", json=invalid_payload)
        assert response.status_code == 422


def test_login_logout_and_current_user(auth_client: TestClient) -> None:
    credentials = {"email": "crew@example.com", "password": "Clouds2026"}
    auth_client.post("/api/auth/register", json=credentials)
    assert auth_client.post("/api/auth/logout").status_code == 204
    assert auth_client.get("/api/auth/me").status_code == 401

    wrong_password = auth_client.post(
        "/api/auth/login",
        json={"email": credentials["email"], "password": "Wrong2026"},
    )
    assert wrong_password.status_code == 401
    assert wrong_password.json()["detail"] == "Неверный email или пароль"

    login = auth_client.post("/api/auth/login", json=credentials)
    assert login.status_code == 200
    assert login.json()["email"] == credentials["email"]
    assert auth_client.get("/api/auth/me").status_code == 200

    logout = auth_client.post("/api/auth/logout")
    assert logout.status_code == 204
    assert "reshis_session" not in auth_client.cookies
    assert auth_client.get("/api/auth/me").status_code == 401


def test_forecast_remains_public(auth_client: TestClient) -> None:
    assert auth_client.get("/api/auth/me").status_code == 401

    response = auth_client.post(
        "/api/forecast",
        json={"route": "MOW-AER", "date": "2026-06-01", "price": 9000},
    )
    assert response.status_code == 200
    assert len(response.json()["quantiles"]) == 9
