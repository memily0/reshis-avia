import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path


SESSION_COOKIE = "reshis_session"
SESSION_LIFETIME = timedelta(days=7)
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


def database_path() -> Path:
    configured_path = os.getenv("RESHIS_AVIA_DB")
    if configured_path:
        return Path(configured_path)
    return Path(__file__).resolve().parents[1] / "data" / "users.db"


def connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS sessions_user_id_idx
                ON sessions(user_id);
            """
        )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, n, r, p, salt, expected_hash = stored_hash.split("$")
        if algorithm != "scrypt":
            return False
        actual_hash = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt),
            n=int(n),
            r=int(r),
            p=int(p),
        )
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(actual_hash.hex(), expected_hash)


def create_user(email: str, password: str) -> dict | None:
    initialize_database()
    normalized_email = normalize_email(email)
    created_at = datetime.now(UTC).isoformat()
    try:
        with connect() as connection:
            cursor = connection.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (normalized_email, hash_password(password), created_at),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    return {"id": user_id, "email": normalized_email, "created_at": created_at}


def authenticate_user(email: str, password: str) -> dict | None:
    initialize_database()
    with connect() as connection:
        row = connection.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
            (normalize_email(email),),
        ).fetchone()
    if row is None:
        # Выполняем ту же дорогую операцию, чтобы время ответа не выдавало email.
        hash_password(password)
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return {"id": row["id"], "email": row["email"], "created_at": row["created_at"]}


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: int) -> str:
    initialize_database()
    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    expires_at = int((now + SESSION_LIFETIME).timestamp())
    with connect() as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(now.timestamp()),))
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_digest(token), user_id, expires_at),
        )
    return token


def get_user_by_session(token: str | None) -> dict | None:
    if not token:
        return None
    initialize_database()
    now = int(datetime.now(UTC).timestamp())
    digest = token_digest(token)
    with connect() as connection:
        row = connection.execute(
            """
            SELECT users.id, users.email, users.created_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (digest, now),
        ).fetchone()
        if row is None:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?",
                (digest, now),
            )
            return None
    return {"id": row["id"], "email": row["email"], "created_at": row["created_at"]}


def delete_session(token: str | None) -> None:
    if not token:
        return
    initialize_database()
    with connect() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))


def cookie_is_secure() -> bool:
    return os.getenv("RESHIS_AVIA_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
