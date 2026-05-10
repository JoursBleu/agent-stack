"""
agent-stack router
==================
Multi-backend per-user agent runtime orchestrator.

Goals
-----
* Single web entrypoint, multiple backends (hermes, openclaw, ...).
* Per (user, backend) docker container lifecycle.
* Idle reaper: when a runner is idle for N seconds, docker stop + rm it.
* OpenAI compatible /v1 surface aggregated across all running backends, routed
  by `model` field.
* Per-user JWT cookie auth (no OpenWebUI).
* Cold-start progress via SSE so the frontend can show a progress bar.

This file is intentionally a single module; it is small enough to grok in one
read, and complex enough to host the full lifecycle.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
import socket
import sqlite3
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

import bcrypt
import docker
import httpx
import jwt
import uvicorn
from docker.errors import APIError, ImageNotFound, NotFound
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from slugify import slugify


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("router")


_ENV_VAR_RE = re.compile(r"\$\{([A-Z_][A-Z0-9_]*)\}")


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    return int(raw) if raw else default


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


STACK_ROOT = Path(os.getenv("STACK_DATA_ROOT", "/data")).resolve()
USERS_ROOT = Path(os.getenv("USERS_ROOT", str(STACK_ROOT / "users"))).resolve()
SEEDS_ROOT = Path(os.getenv("SEEDS_ROOT", str(STACK_ROOT / "seeds"))).resolve()
DB_PATH = Path(os.getenv("DB_PATH", str(STACK_ROOT / "router.db"))).resolve()

# When the router runs inside a container and spawns peer containers via the
# host docker socket, bind mounts must use *host* paths. We translate any path
# that lives under STACK_DATA_ROOT to its corresponding host path under
# HOST_STACK_ROOT before passing to dockerd.
HOST_STACK_ROOT = Path(os.getenv("HOST_STACK_ROOT", str(STACK_ROOT))).resolve()


def to_host_path(p: Path | str) -> str:
    p = Path(p).resolve()
    try:
        rel = p.relative_to(STACK_ROOT)
    except ValueError:
        return str(p)
    return str(HOST_STACK_ROOT / rel)


ROUTER_BIND_HOST = os.getenv("ROUTER_BIND_HOST", "0.0.0.0")
ROUTER_PORT = env_int("ROUTER_PORT", 18080)
ROUTER_PUBLIC_BASE_URL = os.getenv("ROUTER_PUBLIC_BASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is required")
if JWT_SECRET.startswith("CHANGE_ME") or len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET looks like the placeholder or is too short (<32 chars). "
        "Generate one with `openssl rand -hex 48` and put it in .env."
    )
JWT_TTL_SECONDS = env_int("JWT_TTL_SECONDS", 7 * 24 * 3600)
COOKIE_NAME = os.getenv("COOKIE_NAME", "agent_stack_session")
COOKIE_SECURE = env_bool("COOKIE_SECURE", False)

ALLOW_SIGNUP = env_bool("ALLOW_SIGNUP", True)
INVITE_CODE = os.getenv("INVITE_CODE", "").strip()  # empty = no invite required

REAPER_INTERVAL_SECONDS = env_int("REAPER_INTERVAL_SECONDS", 30)
DEFAULT_IDLE_SECONDS = env_int("DEFAULT_IDLE_SECONDS", 600)
MIN_IDLE_SECONDS = env_int("MIN_IDLE_SECONDS", 60)
MAX_IDLE_SECONDS = env_int("MAX_IDLE_SECONDS", 6 * 3600)

BACKEND_HOST = os.getenv("BACKEND_BIND_HOST", "127.0.0.1")
BACKEND_PORT_START = env_int("BACKEND_PORT_START", 19000)
BACKEND_PORT_END = env_int("BACKEND_PORT_END", 19999)
BACKEND_STARTUP_TIMEOUT = env_int("BACKEND_STARTUP_TIMEOUT", 90)
BACKEND_STARTUP_POLL = float(os.getenv("BACKEND_STARTUP_POLL", "0.5"))
BACKEND_PREPULL_AT_STARTUP = os.getenv("BACKEND_PREPULL_AT_STARTUP", "false").lower() in ("1","true","yes","on")

BACKENDS_CONFIG_PATH = Path(
    os.getenv("BACKENDS_CONFIG_PATH", str(STACK_ROOT / "backends.json"))
).resolve()


# ---------------------------------------------------------------------------
# Backend definitions
# ---------------------------------------------------------------------------


class Backend(BaseModel):
    """Static config for a backend kind (hermes, openclaw, ...)."""

    name: str  # canonical model id, e.g. "openclaw" or "hermes-agent"
    display_name: str
    image: str
    container_prefix: str
    internal_port: int  # port inside the container
    health_path: str = "/healthz"
    ready_path: str = "/v1/models"  # final readiness probe (after health passes)
    extra_models: list[str] = []  # additional model ids served by this backend
    api_key_env: str = "OPENAI_API_KEY"  # env var inside container for the auth secret
    api_key_header: str = "Authorization"  # header to send upstream
    api_key_scheme: str = "Bearer"
    seed_subdir: str  # subdir in SEEDS_ROOT that is copied into per-user home
    mount_target: str  # path inside container where per-user home is mounted
    extra_env: dict[str, str] = {}
    # Env vars that users can override via per-account settings. Listed values
    # are exposed in /api/backends so the frontend can render input widgets.
    user_overridable_env: list[str] = []
    # Seed files (relative to the per-user home) that should be re-rendered on
    # every ensure() so changes to user_overridable_env propagate. Without
    # this, _ensure_user_home only renders missing files (`if dst.exists():
    # continue`), and updating a user's API key would have no effect on the
    # already-copied seed.
    templated_files: list[str] = []
    cmd: list[str] | None = None
    user: str | None = None
    chown_uid: int | None = None  # chown the per-user home to this uid before mount
    chown_gid: int | None = None
    network_mode: str = "bridge"
    extra_hosts: dict[str, str] = {}  # hostname -> ip; --add-host equivalent
    extra_networks: list[str] = []  # docker networks to attach after container starts
    dns: list[str] = []  # custom DNS servers for the container
    default_idle_seconds: int = DEFAULT_IDLE_SECONDS
    disabled: bool = False  # placeholder backend; visible in /api/backends but cannot be spawned

    def serves_model(self, model: str) -> bool:
        if not model:
            return False
        if model == self.name:
            return True
        if model in self.extra_models:
            return True
        # openclaw allows model="openclaw/<agentId>"
        if model.startswith(self.name + "/"):
            return True
        return False


def load_backends() -> dict[str, Backend]:
    if not BACKENDS_CONFIG_PATH.exists():
        raise RuntimeError(f"backends config not found: {BACKENDS_CONFIG_PATH}")
    raw = json.loads(BACKENDS_CONFIG_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise RuntimeError("backends config must be a JSON list")
    out: dict[str, Backend] = {}
    for entry in raw:
        b = Backend(**entry)
        out[b.name] = b
    log.info("loaded backends: %s", list(out))
    return out


BACKENDS: dict[str, Backend] = load_backends()


def find_backend_for_model(model: str) -> Backend | None:
    for backend in BACKENDS.values():
        if backend.serves_model(model):
            return backend
    return None


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


_DB_LOCK = threading.Lock()


def db_connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def db_init() -> None:
    with _DB_LOCK, db_connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                slug TEXT UNIQUE NOT NULL,
                pw_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_backend_prefs (
                user_id TEXT NOT NULL,
                backend TEXT NOT NULL,
                idle_seconds INTEGER NOT NULL,
                PRIMARY KEY (user_id, backend),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS user_env_overrides (
                user_id TEXT NOT NULL,
                backend_name TEXT NOT NULL DEFAULT '',
                env_var TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, backend_name, env_var),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS admin_shared_env (
                env_var TEXT PRIMARY KEY,
                shared INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS runners (
                user_id TEXT NOT NULL,
                backend TEXT NOT NULL,
                container_name TEXT NOT NULL,
                host_port INTEGER NOT NULL,
                api_key TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                last_active INTEGER NOT NULL,
                PRIMARY KEY (user_id, backend),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                backend TEXT NOT NULL,
                model TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_conversations_user
                ON conversations(user_id, updated_at DESC);
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conv
                ON messages(conversation_id, created_at);
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                owner_user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                paused INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS room_members (
                room_id TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('user','runner')),
                user_id TEXT NOT NULL,
                backend_name TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL DEFAULT 'passive' CHECK(mode IN ('passive','active')),
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
                invited_by_user_id TEXT,
                approved_by_user_id TEXT,
                created_at INTEGER NOT NULL,
                approved_at INTEGER,
                PRIMARY KEY (room_id, kind, user_id, backend_name),
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_room_members_room
                ON room_members(room_id, status);
            CREATE TABLE IF NOT EXISTS room_messages (
                id TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                sender_kind TEXT NOT NULL CHECK(sender_kind IN ('user','runner')),
                sender_user_id TEXT NOT NULL,
                sender_backend_name TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                agent_turn_id TEXT,
                in_reply_to_message_id TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_room_messages_room
                ON room_messages(room_id, id);
            """
        )
        # --- Migrations -------------------------------------------------
        # v1 user_env_overrides had PRIMARY KEY (user_id, env_var). v2 adds
        # backend_name to the PK so a user can scope an override to one
        # backend (empty string = applies to all backends for this user).
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_env_overrides)").fetchall()}
        if cols and "backend_name" not in cols:
            log.info("migrating user_env_overrides to v2 (per-backend scoping)")
            conn.executescript(
                """
                CREATE TABLE user_env_overrides_new (
                    user_id TEXT NOT NULL,
                    backend_name TEXT NOT NULL DEFAULT '',
                    env_var TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (user_id, backend_name, env_var),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                INSERT INTO user_env_overrides_new
                  (user_id, backend_name, env_var, value, updated_at)
                SELECT user_id, '', env_var, value, updated_at FROM user_env_overrides;
                DROP TABLE user_env_overrides;
                ALTER TABLE user_env_overrides_new RENAME TO user_env_overrides;
                """
            )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


def find_user_by_email(email: str) -> dict[str, Any] | None:
    with db_connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?)", (email,)
        ).fetchone()
        return dict(row) if row else None


def find_user_by_id(user_id: str) -> dict[str, Any] | None:
    with db_connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def pick_unique_slug(base: str) -> str:
    base_slug = slugify(base, lowercase=True, separator="-", max_length=24).strip("-") or "user"
    with db_connect() as conn:
        existing = {
            r["slug"]
            for r in conn.execute("SELECT slug FROM users").fetchall()
        }
    if base_slug not in existing:
        return base_slug
    i = 2
    while f"{base_slug}-{i}" in existing:
        i += 1
    return f"{base_slug}-{i}"


def count_admins() -> int:
    """Return how many users currently have role='admin'."""
    with db_connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").fetchone()
    return int(row["n"] if row else 0)


def create_user(email: str, name: str | None, password: str, role: str = "user") -> dict[str, Any]:
    if role == "admin" and count_admins() > 0:
        raise HTTPException(status_code=409, detail="an admin already exists; only one admin is allowed")
    user_id = uuid.uuid4().hex
    slug = pick_unique_slug(name or email.split("@", 1)[0])
    pw_hash = hash_password(password)
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, name, slug, pw_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, email.strip(), (name or "").strip() or None, slug, pw_hash, role, now),
        )
    return find_user_by_id(user_id)  # type: ignore[return-value]


def current_user(
    request: Request,
    session: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> dict[str, Any]:
    token = session
    if not token:
        auth = request.headers.get("authorization") or ""
        scheme, _, rest = auth.partition(" ")
        if scheme.lower() == "bearer":
            token = rest.strip()
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")
    try:
        payload = decode_jwt(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"invalid token: {exc}") from exc
    user = find_user_by_id(payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user


def require_admin(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return user


# ---------------------------------------------------------------------------
# Runner manager
# ---------------------------------------------------------------------------


class RunnerEvent(BaseModel):
    stage: str
    progress: int  # 0-100
    message: str = ""
    detail: dict[str, Any] = {}


class RunnerManager:
    """Owns per-(user, backend) container lifecycle."""

    def __init__(self) -> None:
        self.docker = docker.from_env()
        self._lock = threading.RLock()
        # progress channels: key = (user_id, backend) -> list[asyncio.Queue]
        self._progress_subs: dict[tuple[str, str], list[asyncio.Queue]] = {}

    # -- progress fan-out ------------------------------------------------

    def subscribe_progress(
        self, user_id: str, backend: str, loop: asyncio.AbstractEventLoop
    ) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._progress_subs.setdefault((user_id, backend), []).append(q)
        return q

    def unsubscribe_progress(self, user_id: str, backend: str, q: asyncio.Queue) -> None:
        with self._lock:
            subs = self._progress_subs.get((user_id, backend), [])
            if q in subs:
                subs.remove(q)
            if not subs:
                self._progress_subs.pop((user_id, backend), None)

    def _emit_progress(self, user_id: str, backend: str, event: RunnerEvent) -> None:
        with self._lock:
            subs = list(self._progress_subs.get((user_id, backend), []))
        for q in subs:
            try:
                q.put_nowait(event)
            except Exception:
                pass

    # -- registry helpers -----------------------------------------------

    def get_runner(self, user_id: str, backend: str) -> dict[str, Any] | None:
        with db_connect() as conn:
            row = conn.execute(
                "SELECT * FROM runners WHERE user_id = ? AND backend = ?",
                (user_id, backend),
            ).fetchone()
            return dict(row) if row else None

    def list_runners(self, user_id: str) -> list[dict[str, Any]]:
        with db_connect() as conn:
            rows = conn.execute(
                "SELECT * FROM runners WHERE user_id = ?", (user_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def list_all_runners(self) -> list[dict[str, Any]]:
        with db_connect() as conn:
            rows = conn.execute("SELECT * FROM runners").fetchall()
        return [dict(r) for r in rows]

    def get_idle_seconds(self, user_id: str, backend: str) -> int:
        backend_def = BACKENDS[backend]
        with db_connect() as conn:
            row = conn.execute(
                "SELECT idle_seconds FROM user_backend_prefs WHERE user_id = ? AND backend = ?",
                (user_id, backend),
            ).fetchone()
        if row:
            return int(row["idle_seconds"])
        return backend_def.default_idle_seconds

    # -- per-user env overrides ----------------------------------------

    def get_user_env_overrides_all(self, user_id: str) -> dict[str, dict[str, str]]:
        """All overrides for a user, grouped by backend_name ("" = global)."""
        with db_connect() as conn:
            rows = conn.execute(
                "SELECT backend_name, env_var, value FROM user_env_overrides WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        out: dict[str, dict[str, str]] = {}
        for r in rows:
            out.setdefault(r["backend_name"], {})[r["env_var"]] = r["value"]
        return out

    def get_effective_env_for_backend(
        self, user_id: str, backend_name: str
    ) -> dict[str, str]:
        """Compose env-var values for (user, backend), backend-specific over
        global override over admin-shared process env. Returns only vars that
        end up with a value; vars that resolve to nothing are omitted."""
        groups = self.get_user_env_overrides_all(user_id)
        global_over = groups.get("", {})
        backend_over = groups.get(backend_name, {})
        shared = self.list_admin_shared_env()
        backend_def = BACKENDS.get(backend_name)
        vars_ = list(backend_def.user_overridable_env) if backend_def else []
        out: dict[str, str] = {}
        for var in vars_:
            if var in backend_over and backend_over[var]:
                out[var] = backend_over[var]
            elif var in global_over and global_over[var]:
                out[var] = global_over[var]
            else:
                shared_val = self.get_admin_shared_value(var) if shared.get(var) else None
                if shared_val:
                    out[var] = shared_val
        return out

    def set_user_env_override(
        self, user_id: str, env_var: str, value: str, backend_name: str = ""
    ) -> None:
        now = int(time.time())
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                """
                INSERT INTO user_env_overrides
                  (user_id, backend_name, env_var, value, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, backend_name, env_var) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (user_id, backend_name, env_var, value, now),
            )

    def delete_user_env_override(
        self, user_id: str, env_var: str, backend_name: str = ""
    ) -> None:
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                "DELETE FROM user_env_overrides WHERE user_id = ? AND backend_name = ? AND env_var = ?",
                (user_id, backend_name, env_var),
            )

    # -- admin shared env ----------------------------------------------

    def get_admin_shared_value(self, env_var: str) -> str | None:
        """Return the most-recently-updated *global* override for ``env_var``
        set by any user with role='admin'. This is what gets shown to other
        users when ``admin_shared_env.shared`` is on for that var.

        Process env (``.env``) is intentionally NOT consulted for these vars
        — admin keeps the value in the DB by setting their own override."""
        with db_connect() as conn:
            row = conn.execute(
                """
                SELECT u.value AS value
                FROM user_env_overrides u
                JOIN users s ON s.id = u.user_id
                WHERE u.backend_name = '' AND u.env_var = ? AND s.role = 'admin'
                  AND u.value <> ''
                ORDER BY u.updated_at DESC
                LIMIT 1
                """,
                (env_var,),
            ).fetchone()
        return row["value"] if row else None

    def list_admin_shared_env(self) -> dict[str, bool]:
        with db_connect() as conn:
            rows = conn.execute(
                "SELECT env_var, shared FROM admin_shared_env"
            ).fetchall()
        return {r["env_var"]: bool(r["shared"]) for r in rows}

    def set_admin_shared_env(self, env_var: str, shared: bool) -> None:
        now = int(time.time())
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                """
                INSERT INTO admin_shared_env (env_var, shared, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(env_var) DO UPDATE SET
                    shared = excluded.shared,
                    updated_at = excluded.updated_at
                """,
                (env_var, 1 if shared else 0, now),
            )

    def set_idle_seconds(self, user_id: str, backend: str, seconds: int) -> int:
        seconds = max(MIN_IDLE_SECONDS, min(MAX_IDLE_SECONDS, int(seconds)))
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                """
                INSERT INTO user_backend_prefs (user_id, backend, idle_seconds)
                VALUES (?, ?, ?)
                ON CONFLICT (user_id, backend) DO UPDATE SET idle_seconds = excluded.idle_seconds
                """,
                (user_id, backend, seconds),
            )
        return seconds

    def touch(self, user_id: str, backend: str) -> None:
        now = int(time.time())
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                "UPDATE runners SET last_active = ? WHERE user_id = ? AND backend = ?",
                (now, user_id, backend),
            )

    # -- ports ----------------------------------------------------------

    def _pick_free_port(self) -> int:
        with db_connect() as conn:
            used = {int(r["host_port"]) for r in conn.execute("SELECT host_port FROM runners").fetchall()}
        for port in range(BACKEND_PORT_START, BACKEND_PORT_END + 1):
            if port in used:
                continue
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind((BACKEND_HOST, port))
                except OSError:
                    continue
            return port
        raise RuntimeError("no free port in BACKEND_PORT range")

    # -- per-user home --------------------------------------------------

    def _ensure_user_home(
        self,
        user: dict[str, Any],
        backend_def: Backend,
        env_overrides: dict[str, str] | None = None,
    ) -> Path:
        home = USERS_ROOT / user["slug"] / backend_def.name
        home.mkdir(parents=True, exist_ok=True)
        seed = SEEDS_ROOT / backend_def.seed_subdir
        templated = {t.lstrip("/") for t in (backend_def.templated_files or [])}
        if seed.exists():
            for src in seed.rglob("*"):
                rel = src.relative_to(seed)
                dst = home / rel
                if src.is_dir():
                    dst.mkdir(parents=True, exist_ok=True)
                    continue
                rel_posix = rel.as_posix()
                is_templated = rel_posix in templated
                if dst.exists() and not is_templated:
                    continue
                dst.parent.mkdir(parents=True, exist_ok=True)
                self._copy_with_env_subst(src, dst, user, env_overrides or {})
        # Recursively chown to the backend's expected uid/gid so the runner
        # (which usually runs as a non-root user) can write to its mount.
        if backend_def.chown_uid is not None:
            uid = backend_def.chown_uid
            gid = backend_def.chown_gid if backend_def.chown_gid is not None else uid
            for path in [home, *home.rglob("*")]:
                try:
                    os.chown(path, uid, gid)
                except OSError as exc:
                    log.warning("chown failed on %s: %s", path, exc)
        return home

    def _copy_with_env_subst(
        self,
        src: Path,
        dst: Path,
        user: dict[str, Any],
        env_overrides: dict[str, str] | None = None,
    ) -> None:
        """Copy seed file. For text files, substitute ${VAR} from process env
        plus AGENT_USER_* values. Binary files copied verbatim."""
        try:
            text = src.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            dst.write_bytes(src.read_bytes())
            try:
                dst.chmod(src.stat().st_mode)
            except OSError:
                pass
            return
        ctx = dict(os.environ)
        ctx.setdefault("AGENT_USER_ID", user["id"])
        ctx.setdefault("AGENT_USER_EMAIL", user.get("email", "") or "")
        ctx.setdefault("AGENT_USER_NAME", user.get("name", "") or "")
        # Per-user overrides win over both process env and AGENT_USER_*.
        if env_overrides:
            ctx.update(env_overrides)
        ctx.setdefault("AGENT_USER_SLUG", user["slug"])

        def _sub(match: "re.Match[str]") -> str:
            name = match.group(1)
            return ctx.get(name, match.group(0))

        rendered = _ENV_VAR_RE.sub(_sub, text)
        dst.write_text(rendered, encoding="utf-8")
        try:
            dst.chmod(src.stat().st_mode)
        except OSError:
            pass

    # -- ensure ---------------------------------------------------------

    def ensure(self, user: dict[str, Any], backend_name: str) -> dict[str, Any]:
        """Idempotently make sure a runner exists and is reachable. Blocking."""
        backend_def = BACKENDS.get(backend_name)
        if backend_def is None:
            raise HTTPException(status_code=404, detail=f"unknown backend {backend_name}")
        if backend_def.disabled:
            raise HTTPException(status_code=503, detail=f"backend {backend_name} is a placeholder and not yet available")

        with self._lock:
            existing = self.get_runner(user["id"], backend_def.name)
            if existing:
                # verify container still exists & running; if not, drop & rebuild
                try:
                    container = self.docker.containers.get(existing["container_name"])
                    container.reload()
                    if container.status != "running":
                        log.info("starting stopped container %s", existing["container_name"])
                        self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                            stage="resuming", progress=10, message="starting existing container",
                        ))
                        container.start()
                except NotFound:
                    log.info("container %s missing, removing stale row", existing["container_name"])
                    self._delete_runner_row(user["id"], backend_def.name)
                    existing = None

            if existing is None:
                self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                    stage="creating", progress=5, message="preparing user workspace",
                ))
                effective_env = self.get_effective_env_for_backend(user["id"], backend_def.name)
                # Refuse to spawn until every required overridable var resolves
                # to a value (admin-shared default, user global override, or
                # backend-specific override).
                missing = [
                    v for v in backend_def.user_overridable_env if not effective_env.get(v)
                ]
                if missing:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"backend {backend_def.name} requires "
                            f"{', '.join(missing)} — set it in Settings → "
                            "Backend API keys"
                        ),
                    )
                home = self._ensure_user_home(user, backend_def, effective_env)
                port = self._pick_free_port()
                api_key = secrets.token_hex(24)
                container_name = f"{backend_def.container_prefix}-{user['slug']}"
                env = dict(backend_def.extra_env)
                env[backend_def.api_key_env] = api_key
                env["AGENT_USER_ID"] = user["id"]
                env["AGENT_USER_EMAIL"] = user.get("email", "") or ""
                env["AGENT_USER_NAME"] = user.get("name", "") or ""
                env.update(effective_env)

                self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                    stage="docker_run", progress=20,
                    message=f"docker run {backend_def.image}",
                    detail={"container": container_name, "host_port": port},
                ))
                try:
                    # remove a leftover with the same name (e.g. from a stale crash)
                    try:
                        old = self.docker.containers.get(container_name)
                        old.remove(force=True)
                    except NotFound:
                        pass

                    run_kwargs = dict(
                        image=backend_def.image,
                        name=container_name,
                        detach=True,
                        environment=env,
                        ports={f"{backend_def.internal_port}/tcp": (BACKEND_HOST, port)},
                        volumes={to_host_path(home): {"bind": backend_def.mount_target, "mode": "rw"}},
                        labels={
                            "managed-by": "agent-stack-router",
                            "agent-stack.user": user["id"],
                            "agent-stack.backend": backend_def.name,
                        },
                    )
                    if backend_def.cmd:
                        run_kwargs["command"] = backend_def.cmd
                    if backend_def.user:
                        run_kwargs["user"] = backend_def.user
                    if backend_def.network_mode and backend_def.network_mode != "bridge":
                        run_kwargs["network_mode"] = backend_def.network_mode
                        run_kwargs.pop("ports", None)
                    if backend_def.extra_hosts:
                        run_kwargs["extra_hosts"] = dict(backend_def.extra_hosts)
                    if backend_def.dns:
                        run_kwargs["dns"] = list(backend_def.dns)

                    try:
                        self.docker.containers.run(**run_kwargs)
                    except ImageNotFound:
                        self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                            stage="image_pull", progress=15,
                            message=f"pulling image {backend_def.image}",
                        ))
                        try:
                            self.docker.images.pull(backend_def.image)
                        except (APIError, NotFound) as pull_exc:
                            # Pull failed (registry 404, auth, network, ...).
                            # Translate into a typed 502 with the docker
                            # daemon's own explanation so the SPA / curl
                            # caller doesn't just see HTTP 500.
                            explanation = getattr(pull_exc, "explanation", None) or str(pull_exc)
                            raise HTTPException(
                                status_code=502,
                                detail=(
                                    f"failed to pull image {backend_def.image!r} "
                                    f"for backend {backend_def.name}: {explanation}"
                                ),
                            )
                        self.docker.containers.run(**run_kwargs)
                    except APIError as exc:
                        if "is already in use" in str(exc):
                            self.docker.containers.get(container_name).remove(force=True)
                            self.docker.containers.run(**run_kwargs)
                        else:
                            raise

                    # Attach to any extra docker networks (e.g. so the runner
                    # can reach a sidecar service like an LLM proxy by its
                    # container DNS name without exposing it on the host).
                    for net_name in backend_def.extra_networks:
                        try:
                            net = self.docker.networks.get(net_name)
                            net.connect(container_name)
                        except (NotFound, APIError) as exc:
                            log.warning(
                                "failed to attach container %s to network %s: %s",
                                container_name, net_name, exc,
                            )

                    now = int(time.time())
                    with _DB_LOCK, db_connect() as conn:
                        conn.execute(
                            """
                            INSERT INTO runners
                              (user_id, backend, container_name, host_port, api_key, started_at, last_active)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """,
                            (user["id"], backend_def.name, container_name, port, api_key, now, now),
                        )
                except HTTPException:
                    # Already a typed error with rich detail; let it propagate.
                    self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                        stage="error", progress=100, message="container failed to start",
                    ))
                    raise
                except APIError as exc:
                    log.exception("docker APIError starting runner %s/%s", user["id"], backend_def.name)
                    self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                        stage="error", progress=100, message="container failed to start",
                    ))
                    explanation = getattr(exc, "explanation", None) or str(exc)
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            f"docker daemon refused to start backend {backend_def.name}: "
                            f"{explanation}"
                        ),
                    )
                except Exception:
                    log.exception("failed to start runner %s/%s", user["id"], backend_def.name)
                    self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                        stage="error", progress=100, message="container failed to start",
                    ))
                    raise

            self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                stage="health_wait", progress=60, message="waiting for backend health",
            ))
            self._wait_ready(user["id"], backend_def)
            self._emit_progress(user["id"], backend_def.name, RunnerEvent(
                stage="ready", progress=100, message="ready",
            ))
            self.touch(user["id"], backend_def.name)
            return self.get_runner(user["id"], backend_def.name)  # type: ignore[return-value]

    def _wait_ready(self, user_id: str, backend_def: Backend) -> None:
        runner = self.get_runner(user_id, backend_def.name)
        if not runner:
            raise RuntimeError("runner row vanished while waiting")
        url_health = f"http://{BACKEND_HOST}:{runner['host_port']}{backend_def.health_path}"
        url_ready = f"http://{BACKEND_HOST}:{runner['host_port']}{backend_def.ready_path}"
        deadline = time.time() + BACKEND_STARTUP_TIMEOUT
        last_err = ""
        elapsed = 0.0
        with httpx.Client(timeout=2.0) as client:
            while time.time() < deadline:
                elapsed = time.time() - (deadline - BACKEND_STARTUP_TIMEOUT)
                pct = min(60 + int(elapsed / BACKEND_STARTUP_TIMEOUT * 35), 95)
                try:
                    r = client.get(url_health)
                    if r.status_code < 500:
                        # health up; do a final ready probe (auth-aware)
                        headers = self._auth_headers(runner["api_key"], backend_def)
                        r2 = client.get(url_ready, headers=headers)
                        if r2.status_code < 500 and r2.status_code != 404:
                            return
                        last_err = f"ready probe HTTP {r2.status_code}"
                    else:
                        last_err = f"health probe HTTP {r.status_code}"
                except Exception as exc:
                    last_err = str(exc)
                self._emit_progress(user_id, backend_def.name, RunnerEvent(
                    stage="health_wait", progress=pct,
                    message="waiting for backend to come up",
                    detail={"last_err": last_err} if last_err else None,
                ))
                time.sleep(BACKEND_STARTUP_POLL)
        # Capture the last few lines of the spawn container's stderr/stdout
        # so the user (and the SPA) gets a real diagnostic instead of just
        # "Connection refused".
        log_tail = ""
        try:
            c = self.docker.containers.get(runner["container_name"])
            raw = c.logs(tail=20, stdout=True, stderr=True)
            if isinstance(raw, (bytes, bytearray)):
                log_tail = raw.decode("utf-8", "replace").strip()
            else:
                log_tail = str(raw).strip()
            status = c.status
        except Exception:
            status = "unknown"
        detail = f"runner not ready: {last_err} (container status={status})"
        if log_tail:
            detail += f"\n--- last 20 log lines ---\n{log_tail}"
        raise HTTPException(status_code=504, detail=detail)

    def _auth_headers(self, api_key: str, backend_def: Backend) -> dict[str, str]:
        if not api_key:
            return {}
        if backend_def.api_key_scheme:
            return {backend_def.api_key_header: f"{backend_def.api_key_scheme} {api_key}"}
        return {backend_def.api_key_header: api_key}

    # -- stop -----------------------------------------------------------

    def stop(self, user_id: str, backend: str) -> bool:
        runner = self.get_runner(user_id, backend)
        if not runner:
            return False
        try:
            c = self.docker.containers.get(runner["container_name"])
            try:
                c.stop(timeout=15)
            finally:
                try:
                    c.remove(force=True)
                except Exception:
                    pass
        except NotFound:
            pass
        self._delete_runner_row(user_id, backend)
        return True

    def _delete_runner_row(self, user_id: str, backend: str) -> None:
        with _DB_LOCK, db_connect() as conn:
            conn.execute(
                "DELETE FROM runners WHERE user_id = ? AND backend = ?", (user_id, backend)
            )

    # -- reaper ---------------------------------------------------------

    def reap_idle(self) -> list[str]:
        reaped: list[str] = []
        now = int(time.time())
        for runner in self.list_all_runners():
            # First: if the container has exited (crash, OOM, schema mismatch),
            # clear the row immediately regardless of idle time so the SPA's
            # "running" badge stops lying within one reaper tick.
            try:
                c = self.docker.containers.get(runner["container_name"])
                container_status = c.status  # "running" / "exited" / "created" / ...
            except NotFound:
                container_status = "missing"
            except Exception:
                container_status = None
            if container_status in ("exited", "dead", "missing"):
                log.info(
                    "reaping dead runner user=%s backend=%s status=%s",
                    runner["user_id"], runner["backend"], container_status,
                )
                try:
                    self.stop(runner["user_id"], runner["backend"])
                    reaped.append(runner["container_name"])
                except Exception:
                    log.exception("dead-runner cleanup failed for %s", runner["container_name"])
                continue
            idle_limit = self.get_idle_seconds(runner["user_id"], runner["backend"])
            if now - int(runner["last_active"]) > idle_limit:
                log.info(
                    "reaping idle runner user=%s backend=%s idle=%ss limit=%ss",
                    runner["user_id"], runner["backend"], now - int(runner["last_active"]), idle_limit,
                )
                try:
                    self.stop(runner["user_id"], runner["backend"])
                    reaped.append(runner["container_name"])
                except Exception:
                    log.exception("reap failed for %s", runner["container_name"])
        return reaped


MANAGER = RunnerManager()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


# In-memory map populated by _prepull_backend_images(); surfaced via /healthz
# so operators can tell at a glance which images failed to prepull (would
# otherwise only show up in `docker logs` after the first /start request
# blows past BACKEND_STARTUP_TIMEOUT).
PREPULL_STATUS: dict[str, str] = {}


def _prepull_backend_images() -> None:
    """Pull every backends.json image once at router startup so the first
    POST /api/runners/<backend>/start never blocks on a 1-2 GB image pull
    inside the BACKEND_STARTUP_TIMEOUT window.

    Best-effort: log + swallow any failure (offline host, private registry
    without creds, etc.). The on-demand pull path in spawn() still kicks
    in as a fallback. Per-image outcome is recorded in PREPULL_STATUS and
    exposed by /healthz."""
    if not BACKEND_PREPULL_AT_STARTUP:
        PREPULL_STATUS["_disabled"] = "BACKEND_PREPULL_AT_STARTUP=false"
        return
    try:
        client = docker.from_env()
    except Exception as exc:
        log.warning("prepull: docker client unavailable, skipping: %s", exc)
        PREPULL_STATUS["_docker"] = f"unavailable: {exc}"
        return
    seen: set[str] = set()
    for backend in BACKENDS.values():
        if backend.disabled:
            continue
        img = backend.image
        if not img or img in seen:
            continue
        seen.add(img)
        try:
            client.images.get(img)
            log.info("prepull: %s already present", img)
            PREPULL_STATUS[img] = "present"
            continue
        except Exception:
            pass
        log.info("prepull: pulling %s ...", img)
        try:
            client.images.pull(img)
            log.info("prepull: %s ok", img)
            PREPULL_STATUS[img] = "ok"
        except Exception as exc:
            msg = str(exc).strip().splitlines()[-1][:300] if str(exc) else exc.__class__.__name__
            log.warning("prepull: %s failed: %s (will retry on demand)", img, exc)
            PREPULL_STATUS[img] = f"failed: {msg}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_init()
    bootstrap_admin()
    await asyncio.to_thread(_prepull_backend_images)
    stop_event = asyncio.Event()

    async def reaper_loop():
        while not stop_event.is_set():
            try:
                await asyncio.to_thread(MANAGER.reap_idle)
            except Exception:
                log.exception("reaper loop error")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=REAPER_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                pass

    task = asyncio.create_task(reaper_loop())
    try:
        yield
    finally:
        stop_event.set()
        task.cancel()
        try:
            await task
        except Exception:
            pass


app = FastAPI(title="agent-stack router", lifespan=lifespan)


def bootstrap_admin() -> None:
    admin_email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip()
    admin_pw = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "").strip()
    if not (admin_email and admin_pw):
        return
    if admin_pw.startswith("CHANGE_ME") or admin_pw == "changeme" or len(admin_pw) < 12:
        raise RuntimeError(
            "BOOTSTRAP_ADMIN_PASSWORD looks like the placeholder or is too "
            "short (<12 chars). Set a real password in .env before first boot."
        )
    if find_user_by_email(admin_email):
        return
    if count_admins() > 0:
        log.warning(
            "bootstrap_admin: an admin already exists; not creating BOOTSTRAP_ADMIN_EMAIL=%s",
            admin_email,
        )
        return
    log.info("bootstrapping admin user %s", admin_email)
    create_user(admin_email, os.getenv("BOOTSTRAP_ADMIN_NAME", "Admin"), admin_pw, role="admin")


# -- auth routes -----------------------------------------------------


class SignupBody(BaseModel):
    email: str
    password: str
    name: str | None = None
    invite_code: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=JWT_TTL_SECONDS, httponly=True,
        secure=COOKIE_SECURE, samesite="lax", path="/",
    )


@app.post("/auth/signup")
def auth_signup(body: SignupBody, response: Response):
    if not ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="signup disabled")
    if INVITE_CODE and (body.invite_code or "").strip() != INVITE_CODE:
        raise HTTPException(status_code=403, detail="invalid invite code")
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="invalid email")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="password too short")
    if find_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="email already registered")
    user = create_user(body.email, body.name, body.password)
    token = make_jwt(user["id"])
    _set_session_cookie(response, token)
    return {"user": _public_user(user)}


@app.post("/auth/login")
def auth_login(body: LoginBody, response: Response):
    user = find_user_by_email(body.email)
    if not user or not verify_password(body.password, user["pw_hash"]):
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = make_jwt(user["id"])
    _set_session_cookie(response, token)
    return {"user": _public_user(user)}


@app.post("/auth/logout")
def auth_logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(current_user)):
    return {"user": _public_user(user)}


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "slug": user["slug"],
        "role": user.get("role"),
    }


# -- backends + runners ---------------------------------------------


@app.get("/api/backends")
def api_backends(user: dict[str, Any] = Depends(current_user)):
    out = []
    for b in BACKENDS.values():
        out.append({
            "name": b.name,
            "display_name": b.display_name,
            "models": [b.name] + list(b.extra_models),
            "default_idle_seconds": b.default_idle_seconds,
            "idle_seconds": MANAGER.get_idle_seconds(user["id"], b.name),
            "user_overridable_env": list(b.user_overridable_env),
            "disabled": b.disabled,
        })
    return {"backends": out}


def _mask(v: str) -> str:
    if not v:
        return ""
    if len(v) <= 8:
        return "•" * len(v)
    return v[:4] + "•" * (len(v) - 8) + v[-4:]


def _allowed_overridable_envs() -> set[str]:
    out: set[str] = set()
    for b in BACKENDS.values():
        out.update(b.user_overridable_env)
    return out


def _backends_using_env(env_var: str) -> list[str]:
    return [b.name for b in BACKENDS.values() if env_var in b.user_overridable_env]


def _validate_env_scope(env_var: str, backend_name: str) -> None:
    if env_var not in _allowed_overridable_envs():
        raise HTTPException(status_code=400, detail=f"env var {env_var} is not user-overridable")
    if backend_name == "":
        return
    bd = BACKENDS.get(backend_name)
    if bd is None:
        raise HTTPException(status_code=404, detail=f"unknown backend {backend_name}")
    if env_var not in bd.user_overridable_env:
        raise HTTPException(
            status_code=400,
            detail=f"backend {backend_name} does not accept override for {env_var}",
        )


@app.get("/api/me/env-overrides")
def api_list_env_overrides(user: dict[str, Any] = Depends(current_user)):
    """Return everything the Settings UI needs:

    - vars: which env vars are user-overridable on at least one backend
    - backends: which backend each var applies to (so the UI can show one row per backend)
    - admin_shared: which vars the admin has marked as shared (DB-backed)
    - admin_shared_present: whether the process actually has a value for that shared var
    - overrides: this user's overrides, grouped by scope (\"\" = global; backend name = scoped),
                 values masked.
    - effective: per (backend, var) -> {source: shared|global|backend|unset, masked: value-or-empty}
    """
    raw = MANAGER.get_user_env_overrides_all(user["id"])
    overrides: dict[str, dict[str, str]] = {
        scope: {k: _mask(v) for k, v in vs.items()} for scope, vs in raw.items()
    }
    shared = MANAGER.list_admin_shared_env()
    vars_list = sorted(_allowed_overridable_envs())
    by_backend = {v: _backends_using_env(v) for v in vars_list}
    shared_value = {v: MANAGER.get_admin_shared_value(v) for v in vars_list}
    shared_present = {v: bool(shared_value.get(v)) for v in vars_list}
    effective: dict[str, dict[str, dict[str, str]]] = {}
    for b in BACKENDS.values():
        per_backend = {}
        eff_env = MANAGER.get_effective_env_for_backend(user["id"], b.name)
        global_over = raw.get("", {})
        backend_over = raw.get(b.name, {})
        for var in b.user_overridable_env:
            if var in backend_over and backend_over[var]:
                source = "backend"
            elif var in global_over and global_over[var]:
                source = "global"
            elif shared.get(var) and shared_value.get(var):
                source = "shared"
            else:
                source = "unset"
            per_backend[var] = {"source": source, "masked": _mask(eff_env.get(var, ""))}
        effective[b.name] = per_backend
    return {
        "vars": vars_list,
        "backends": by_backend,
        "admin_shared": {v: bool(shared.get(v)) for v in vars_list},
        "admin_shared_present": shared_present,
        "overrides": overrides,
        "effective": effective,
    }


class EnvOverrideBody(BaseModel):
    value: str
    backend: str = ""  # \"\" = global for this user; otherwise a backend name


@app.put("/api/me/env-overrides/{env_var}")
async def api_set_env_override(
    env_var: str,
    body: EnvOverrideBody,
    user: dict[str, Any] = Depends(current_user),
):
    backend_name = (body.backend or "").strip()
    _validate_env_scope(env_var, backend_name)
    value = (body.value or "").strip()
    if value:
        MANAGER.set_user_env_override(user["id"], env_var, value, backend_name)
    else:
        MANAGER.delete_user_env_override(user["id"], env_var, backend_name)
    # Stop affected runners so the new value takes effect on next start.
    affected = [backend_name] if backend_name else _backends_using_env(env_var)
    for bn in affected:
        try:
            await asyncio.to_thread(MANAGER.stop, user["id"], bn)
        except Exception as exc:
            log.warning("failed to stop runner %s for user %s: %s", bn, user["id"], exc)
    return {"ok": True, "set": bool(value)}


@app.delete("/api/me/env-overrides/{env_var}")
async def api_delete_env_override(
    env_var: str,
    backend: str = "",
    user: dict[str, Any] = Depends(current_user),
):
    backend_name = (backend or "").strip()
    _validate_env_scope(env_var, backend_name)
    MANAGER.delete_user_env_override(user["id"], env_var, backend_name)
    affected = [backend_name] if backend_name else _backends_using_env(env_var)
    for bn in affected:
        try:
            await asyncio.to_thread(MANAGER.stop, user["id"], bn)
        except Exception as exc:
            log.warning("failed to stop runner %s for user %s: %s", bn, user["id"], exc)
    return {"ok": True}


# -- admin: shared env --------------------------------------------------

@app.get("/api/admin/shared-env")
def admin_list_shared_env(_: dict[str, Any] = Depends(require_admin)):
    shared = MANAGER.list_admin_shared_env()
    vars_list = sorted(_allowed_overridable_envs())
    has_value = {v: bool(MANAGER.get_admin_shared_value(v)) for v in vars_list}
    return {
        "vars": vars_list,
        "shared": {v: bool(shared.get(v)) for v in vars_list},
        # Whether some admin has stored a global override for this var. Only
        # vars with admin_has_value=true can actually share something useful.
        "admin_has_value": has_value,
    }


class AdminSharedBody(BaseModel):
    shared: bool


@app.put("/api/admin/shared-env/{env_var}")
async def admin_set_shared_env(
    env_var: str,
    body: AdminSharedBody,
    _: dict[str, Any] = Depends(require_admin),
):
    if env_var not in _allowed_overridable_envs():
        raise HTTPException(status_code=400, detail=f"env var {env_var} is not user-overridable")
    MANAGER.set_admin_shared_env(env_var, bool(body.shared))
    # Stop every runner that reads this var so changes propagate (each user
    # respawns on next chat with the new effective env).
    for bn in _backends_using_env(env_var):
        for r in MANAGER.list_all_runners():
            if r["backend"] == bn:
                try:
                    await asyncio.to_thread(MANAGER.stop, r["user_id"], bn)
                except Exception as exc:
                    log.warning("failed to stop runner %s/%s: %s", r["user_id"], bn, exc)
    return {"ok": True, "shared": bool(body.shared)}


@app.get("/api/runners")
def api_runners(user: dict[str, Any] = Depends(current_user)):
    runners = MANAGER.list_runners(user["id"])
    out = []
    for r in runners:
        idle_limit = MANAGER.get_idle_seconds(user["id"], r["backend"])
        idle_for = int(time.time()) - int(r["last_active"])
        out.append({
            "backend": r["backend"],
            "container_name": r["container_name"],
            "host_port": r["host_port"],
            "started_at": r["started_at"],
            "last_active": r["last_active"],
            "idle_seconds": idle_limit,
            "idle_for_seconds": idle_for,
            "stops_in_seconds": max(0, idle_limit - idle_for),
            "running": True,
        })
    return {"runners": out}


@app.post("/api/runners/{backend}/start")
async def api_runner_start(backend: str, user: dict[str, Any] = Depends(current_user)):
    if backend not in BACKENDS:
        raise HTTPException(status_code=404, detail="unknown backend")
    runner = await asyncio.to_thread(MANAGER.ensure, user, backend)
    return {"runner": {
        "backend": backend,
        "container_name": runner["container_name"],
        "host_port": runner["host_port"],
    }}


@app.delete("/api/runners/{backend}")
async def api_runner_stop(backend: str, user: dict[str, Any] = Depends(current_user)):
    if backend not in BACKENDS:
        raise HTTPException(status_code=404, detail="unknown backend")
    stopped = await asyncio.to_thread(MANAGER.stop, user["id"], backend)
    return {"stopped": stopped}


class IdleBody(BaseModel):
    idle_seconds: int


@app.put("/api/runners/{backend}/idle")
def api_runner_idle(backend: str, body: IdleBody, user: dict[str, Any] = Depends(current_user)):
    if backend not in BACKENDS:
        raise HTTPException(status_code=404, detail="unknown backend")
    new_value = MANAGER.set_idle_seconds(user["id"], backend, body.idle_seconds)
    return {"idle_seconds": new_value}


@app.get("/api/runners/{backend}/progress")
async def api_runner_progress(backend: str, user: dict[str, Any] = Depends(current_user)):
    if backend not in BACKENDS:
        raise HTTPException(status_code=404, detail="unknown backend")
    loop = asyncio.get_running_loop()
    queue = MANAGER.subscribe_progress(user["id"], backend, loop)

    async def gen() -> AsyncIterator[bytes]:
        # initial snapshot
        runner = MANAGER.get_runner(user["id"], backend)
        snapshot = RunnerEvent(
            stage="snapshot",
            progress=100 if runner else 0,
            message="ready" if runner else "not started",
        )
        yield f"data: {snapshot.json()}\n\n".encode()
        try:
            while True:
                event: RunnerEvent = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"data: {event.json()}\n\n".encode()
                if event.stage in {"ready", "error"}:
                    break
        except asyncio.TimeoutError:
            yield b": keepalive\n\n"
        finally:
            MANAGER.unsubscribe_progress(user["id"], backend, queue)

    return StreamingResponse(gen(), media_type="text/event-stream")


# -- /v1 OpenAI proxy ------------------------------------------------


UPSTREAM_CLIENT = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=None, write=60.0, pool=None))


HOP_BY_HOP = {
    "connection", "content-length", "host", "keep-alive",
    "proxy-authenticate", "proxy-authorization", "te", "trailer",
    "transfer-encoding", "upgrade",
}


_BROWSER_HEADERS_TO_STRIP = {"origin", "referer", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"}


def _proxy_headers(request: Request, runner_api_key: str, backend_def: Backend) -> dict[str, str]:
    headers: dict[str, str] = {}
    for k, v in request.headers.items():
        kl = k.lower()
        if kl in HOP_BY_HOP or kl == "authorization" or kl == "cookie":
            continue
        # Strip browser-added headers that some backends (e.g. Hermes Agent)
        # treat as CSRF and reject with 403.
        if kl in _BROWSER_HEADERS_TO_STRIP:
            continue
        headers[k] = v
    if backend_def.api_key_scheme:
        headers[backend_def.api_key_header] = f"{backend_def.api_key_scheme} {runner_api_key}"
    else:
        headers[backend_def.api_key_header] = runner_api_key
    return headers


@app.get("/v1/models")
async def v1_models(user: dict[str, Any] = Depends(current_user)):
    """Return aggregated model list across user's running runners.

    To avoid auto-spawning every backend just because the UI fetches /v1/models,
    we list models for backends that already have a runner, plus a static
    catalog of available backends (so the UI can render dropdowns without
    booting anything).
    """
    runners_by_backend = {r["backend"]: r for r in MANAGER.list_runners(user["id"])}
    data = []
    now = int(time.time())
    for b in BACKENDS.values():
        running = b.name in runners_by_backend
        data.append({
            "id": b.name,
            "object": "model",
            "created": now,
            "owned_by": "agent-stack",
            "root": b.name,
            "running": running,
            "display_name": b.display_name,
        })
        for extra in b.extra_models:
            data.append({
                "id": extra,
                "object": "model",
                "created": now,
                "owned_by": "agent-stack",
                "root": b.name,
                "running": running,
            })
    return {"object": "list", "data": data}


@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def v1_proxy(path: str, request: Request, user: dict[str, Any] = Depends(current_user)):
    if path == "models" and request.method == "GET":
        return await v1_models(user)

    body = await request.body()
    model_id = ""
    user_field = ""
    if body:
        try:
            payload = json.loads(body)
            model_id = str(payload.get("model") or "")
            user_field = str(payload.get("user") or "")
        except Exception:
            pass

    backend_def = find_backend_for_model(model_id) if model_id else None
    if backend_def is None:
        raise HTTPException(
            status_code=400,
            detail=f"no backend serves model={model_id!r}; available={list(BACKENDS)}",
        )

    runner = await asyncio.to_thread(MANAGER.ensure, user, backend_def.name)
    MANAGER.touch(user["id"], backend_def.name)

    upstream_url = f"http://{BACKEND_HOST}:{runner['host_port']}/v1/{path}"
    headers = _proxy_headers(request, runner["api_key"], backend_def)

    # Hermes Agent derives a session id from sha256(system + first user msg)
    # by default, which collides whenever two conversations start with the
    # same prompt (e.g. both "hi"). It honors `X-Hermes-Session-Id` if set,
    # so pin the session to our conversation id (sent by the SPA in the
    # OpenAI `user` field). When the client is a raw OpenAI SDK that does
    # not pass `user`, fall back to a per-(agent-stack-)user session id so
    # at least different users never share a Hermes context.
    if backend_def.name == "hermes-agent":
        headers["X-Hermes-Session-Id"] = user_field or f"agstack-u{user['id']}"

    try:
        upstream_request = UPSTREAM_CLIENT.build_request(
            method=request.method,
            url=upstream_url,
            headers=headers,
            params=request.query_params,
            content=body,
        )
        upstream_response = await UPSTREAM_CLIENT.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc

    response_headers = {k: v for k, v in upstream_response.headers.items()
                        if k.lower() not in HOP_BY_HOP}
    content_type = upstream_response.headers.get("content-type", "")

    if "text/event-stream" in content_type.lower():
        async def stream_gen():
            try:
                async for chunk in upstream_response.aiter_raw():
                    MANAGER.touch(user["id"], backend_def.name)
                    yield chunk
            finally:
                await upstream_response.aclose()
        return StreamingResponse(
            stream_gen(),
            status_code=upstream_response.status_code,
            headers=response_headers,
            media_type=content_type,
        )

    content = await upstream_response.aread()
    await upstream_response.aclose()
    return Response(
        content=content,
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=content_type or None,
    )


# -- admin -----------------------------------------------------------


@app.get("/api/admin/runners")
def admin_runners(_: dict[str, Any] = Depends(require_admin)):
    return {"runners": MANAGER.list_all_runners()}


@app.delete("/api/admin/runners/{user_id}/{backend}")
async def admin_stop(
    user_id: str, backend: str,
    _: dict[str, Any] = Depends(require_admin),
):
    stopped = await asyncio.to_thread(MANAGER.stop, user_id, backend)
    return {"stopped": stopped}


@app.get("/api/admin/users")
def admin_users(_: dict[str, Any] = Depends(require_admin)):
    with db_connect() as conn:
        rows = conn.execute(
            "SELECT id, email, name, slug, role, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    return {"users": [dict(r) for r in rows]}


class AdminUserCreate(BaseModel):
    email: str
    password: str
    name: str | None = None


class AdminUserPatch(BaseModel):
    name: str | None = None
    password: str | None = None


@app.post("/api/admin/users")
def admin_create_user(
    body: AdminUserCreate,
    _: dict[str, Any] = Depends(require_admin),
):
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="invalid email")
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="password must be at least 6 chars")
    if find_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="email already registered")
    # Single-admin invariant: admin-created users are always regular users.
    user = create_user(body.email, body.name, body.password, role="user")
    return {"user": _public_user(user)}


@app.patch("/api/admin/users/{user_id}")
def admin_patch_user(
    user_id: str,
    body: AdminUserPatch,
    actor: dict[str, Any] = Depends(require_admin),
):
    with db_connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")

    updates: list[str] = []
    params: list[Any] = []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name.strip() or None)
    if body.password is not None:
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="password must be at least 6 chars")
        updates.append("pw_hash = ?")
        params.append(hash_password(body.password))
    if not updates:
        return {"user": _public_user(dict(row))}

    params.append(user_id)
    with _DB_LOCK, db_connect() as conn:
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        new_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"user": _public_user(dict(new_row))}


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    actor: dict[str, Any] = Depends(require_admin),
):
    if user_id == actor["id"]:
        raise HTTPException(status_code=400, detail="cannot delete yourself")
    with db_connect() as conn:
        row = conn.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    if row["role"] == "admin":
        # Single-admin invariant: the admin account is permanent.
        raise HTTPException(status_code=400, detail="the admin account cannot be deleted")
    # stop any running runners owned by this user before cascading delete
    for r in MANAGER.list_runners(user_id):
        try:
            await asyncio.to_thread(MANAGER.stop, user_id, r["backend"])
        except Exception as exc:
            log.warning("admin_delete_user: stop runner failed: %s", exc)
    with _DB_LOCK, db_connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return Response(status_code=204)


# -- conversations ---------------------------------------------------


class ConversationCreate(BaseModel):
    backend: str
    model: str | None = None
    title: str | None = None


class ConversationPatch(BaseModel):
    title: str


class MessageAppend(BaseModel):
    role: str
    content: str


def _conversation_row(conv: sqlite3.Row, msg_count: int | None = None) -> dict[str, Any]:
    out = {
        "id": conv["id"],
        "backend": conv["backend"],
        "model": conv["model"],
        "title": conv["title"] or "",
        "created_at": conv["created_at"],
        "updated_at": conv["updated_at"],
    }
    if msg_count is not None:
        out["message_count"] = msg_count
    return out


def _message_row(m: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": m["id"],
        "role": m["role"],
        "content": m["content"],
        "created_at": m["created_at"],
    }


def _get_user_conversation(conv_id: str, user_id: str) -> sqlite3.Row:
    with db_connect() as conn:
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conv_id, user_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="conversation not found")
    return row


@app.get("/api/conversations")
def list_conversations(user: dict[str, Any] = Depends(current_user)):
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT c.*, (
                SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
            ) AS msg_count
            FROM conversations c
            WHERE c.user_id = ?
            ORDER BY c.updated_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return {
        "conversations": [_conversation_row(r, r["msg_count"]) for r in rows]
    }


@app.post("/api/conversations")
def create_conversation(
    body: ConversationCreate,
    user: dict[str, Any] = Depends(current_user),
):
    if body.backend not in BACKENDS:
        raise HTTPException(status_code=400, detail="unknown backend")
    conv_id = secrets.token_hex(12)
    now = int(time.time())
    model = body.model or body.backend
    title = (body.title or "").strip()
    with _DB_LOCK, db_connect() as conn:
        conn.execute(
            """
            INSERT INTO conversations (id, user_id, backend, model, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (conv_id, user["id"], body.backend, model, title, now, now),
        )
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
    return {"conversation": _conversation_row(row, 0)}


@app.get("/api/conversations/{conv_id}")
def get_conversation(
    conv_id: str,
    user: dict[str, Any] = Depends(current_user),
):
    row = _get_user_conversation(conv_id, user["id"])
    with db_connect() as conn:
        msgs = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, id",
            (conv_id,),
        ).fetchall()
    return {
        "conversation": _conversation_row(row, len(msgs)),
        "messages": [_message_row(m) for m in msgs],
    }


@app.patch("/api/conversations/{conv_id}")
def patch_conversation(
    conv_id: str,
    body: ConversationPatch,
    user: dict[str, Any] = Depends(current_user),
):
    _get_user_conversation(conv_id, user["id"])
    title = (body.title or "").strip()[:200]
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conv_id),
        )
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
    return {"conversation": _conversation_row(row)}


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(
    conv_id: str,
    user: dict[str, Any] = Depends(current_user),
):
    _get_user_conversation(conv_id, user["id"])
    with _DB_LOCK, db_connect() as conn:
        conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    return Response(status_code=204)


@app.delete("/api/conversations/{conv_id}/messages/after/{msg_id}")
def delete_messages_after(
    conv_id: str,
    msg_id: str,
    user: dict[str, Any] = Depends(current_user),
):
    """Delete every message in this conversation strictly newer than msg_id.

    Used by the 'resend' UI: when a user resends an earlier message we drop
    everything that came after it (assistant replies, errors, and any follow-up
    user turns) so the regenerated reply replaces them in the saved history.
    """
    _get_user_conversation(conv_id, user["id"])
    with _DB_LOCK, db_connect() as conn:
        anchor = conn.execute(
            "SELECT created_at, id FROM messages WHERE id = ? AND conversation_id = ?",
            (msg_id, conv_id),
        ).fetchone()
        if anchor is None:
            raise HTTPException(status_code=404, detail="message not found")
        # delete strictly after the anchor (by created_at, tie-break on id)
        conn.execute(
            """
            DELETE FROM messages
            WHERE conversation_id = ?
              AND (created_at > ? OR (created_at = ? AND id > ?))
            """,
            (conv_id, anchor["created_at"], anchor["created_at"], msg_id),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (int(time.time()), conv_id),
        )
    return Response(status_code=204)


@app.post("/api/conversations/{conv_id}/messages")
def append_message(
    conv_id: str,
    body: MessageAppend,
    user: dict[str, Any] = Depends(current_user),
):
    _get_user_conversation(conv_id, user["id"])
    role = (body.role or "").strip()
    if role not in ("user", "assistant", "system", "error"):
        raise HTTPException(status_code=400, detail="invalid role")
    content = body.content or ""
    msg_id = secrets.token_hex(12)
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        conn.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conv_id, role, content, now),
        )
        # touch conversation; auto-fill title from first user message
        conn.execute(
            """
            UPDATE conversations
            SET updated_at = ?,
                title = CASE
                  WHEN (title IS NULL OR title = '') AND ? = 'user'
                    THEN substr(?, 1, 60)
                  ELSE title
                END
            WHERE id = ?
            """,
            (now, role, content, conv_id),
        )
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (msg_id,)
        ).fetchone()
    return {"message": _message_row(row)}


# -- health ----------------------------------------------------------


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "backends": list(BACKENDS),
        # Per-image prepull outcome from startup. Empty dict (or only the
        # "_disabled" sentinel) when BACKEND_PREPULL_AT_STARTUP=false.
        # Useful for ops to spot "image not in registry" / network errors
        # without grepping docker logs.
        "prepull_status": dict(PREPULL_STATUS),
    }


# ---------------------------------------------------------------------------
# Rooms (phase 1: user-only chat; runner integration in phase 2)
# ---------------------------------------------------------------------------


class RoomCreateBody(BaseModel):
    title: str


class RoomJoinBody(BaseModel):
    kind: str = "user"  # 'user' or 'runner'
    backend_name: str = ""  # required when kind='runner'
    mode: str = "passive"  # 'passive' or 'active' (only meaningful for runners)


class RoomMessageBody(BaseModel):
    content: str


def _room_owner_check(conn: sqlite3.Connection, room_id: str, user: dict[str, Any]) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="room not found")
    is_owner = row["owner_user_id"] == user["id"]
    is_admin = user.get("role") == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="owner or admin only")
    return dict(row)


def _room_visible(conn: sqlite3.Connection, room_id: str, user: dict[str, Any]) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="room not found")
    if user.get("role") == "admin" or row["owner_user_id"] == user["id"]:
        return dict(row)
    member = conn.execute(
        "SELECT 1 FROM room_members WHERE room_id = ? AND kind='user' AND user_id = ? AND status = 'approved'",
        (room_id, user["id"]),
    ).fetchone()
    if not member:
        raise HTTPException(status_code=403, detail="not a member")
    return dict(row)


@app.get("/api/rooms")
def api_list_rooms(user: dict[str, Any] = Depends(current_user)):
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT r.*, (
                SELECT COUNT(*) FROM room_members rm
                WHERE rm.room_id = r.id AND rm.status = 'approved'
            ) AS member_count
            FROM rooms r
            WHERE r.owner_user_id = ?
               OR EXISTS (
                    SELECT 1 FROM room_members rm
                    WHERE rm.room_id = r.id AND rm.kind='user'
                      AND rm.user_id = ? AND rm.status='approved'
               )
            ORDER BY r.created_at DESC
            """,
            (user["id"], user["id"]),
        ).fetchall()
        return {"rooms": [dict(r) for r in rows]}


@app.post("/api/rooms")
def api_create_room(body: RoomCreateBody, user: dict[str, Any] = Depends(current_user)):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    room_id = uuid.uuid4().hex
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        conn.execute(
            "INSERT INTO rooms (id, title, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
            (room_id, title, user["id"], now),
        )
        conn.execute(
            """
            INSERT INTO room_members
                (room_id, kind, user_id, backend_name, mode, status,
                 invited_by_user_id, approved_by_user_id, created_at, approved_at)
            VALUES (?, 'user', ?, '', 'passive', 'approved', ?, ?, ?, ?)
            """,
            (room_id, user["id"], user["id"], user["id"], now, now),
        )
    return {"room": {"id": room_id, "title": title, "owner_user_id": user["id"], "created_at": now, "paused": 0}}


@app.get("/api/rooms/{room_id}")
def api_get_room(room_id: str, user: dict[str, Any] = Depends(current_user)):
    with db_connect() as conn:
        room = _room_visible(conn, room_id, user)
        members = conn.execute(
            "SELECT * FROM room_members WHERE room_id = ? ORDER BY created_at",
            (room_id,),
        ).fetchall()
        return {
            "room": room,
            "members": [dict(m) for m in members],
            "is_owner": room["owner_user_id"] == user["id"],
        }


@app.delete("/api/rooms/{room_id}")
def api_delete_room(room_id: str, user: dict[str, Any] = Depends(current_user)):
    with _DB_LOCK, db_connect() as conn:
        _room_owner_check(conn, room_id, user)
        conn.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    return {"ok": True}


@app.post("/api/rooms/{room_id}/pause")
def api_room_pause(room_id: str, paused: bool = True, user: dict[str, Any] = Depends(current_user)):
    with _DB_LOCK, db_connect() as conn:
        _room_owner_check(conn, room_id, user)
        conn.execute("UPDATE rooms SET paused = ? WHERE id = ?", (1 if paused else 0, room_id))
    return {"ok": True, "paused": paused}


@app.post("/api/rooms/{room_id}/join")
def api_room_join(room_id: str, body: RoomJoinBody, user: dict[str, Any] = Depends(current_user)):
    if body.kind not in ("user", "runner"):
        raise HTTPException(status_code=400, detail="kind must be user|runner")
    if body.kind == "runner":
        if not body.backend_name:
            raise HTTPException(status_code=400, detail="backend_name required for runner")
        if body.backend_name not in BACKENDS:
            raise HTTPException(status_code=400, detail="unknown backend")
        if body.mode not in ("passive", "active"):
            raise HTTPException(status_code=400, detail="mode must be passive|active")
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="room not found")
        # owner self-add is auto-approved
        is_owner = room["owner_user_id"] == user["id"]
        status = "approved" if is_owner else "pending"
        approved_by = user["id"] if is_owner else None
        approved_at = now if is_owner else None
        try:
            conn.execute(
                """
                INSERT INTO room_members
                    (room_id, kind, user_id, backend_name, mode, status,
                     invited_by_user_id, approved_by_user_id, created_at, approved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (room_id, body.kind, user["id"], body.backend_name,
                 body.mode if body.kind == "runner" else "passive",
                 status, user["id"], approved_by, now, approved_at),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="already requested or member")
    return {"ok": True, "status": status}


@app.post("/api/rooms/{room_id}/members/approve")
def api_room_approve(
    room_id: str,
    member_user_id: str,
    member_kind: str = "user",
    backend_name: str = "",
    user: dict[str, Any] = Depends(current_user),
):
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        _room_owner_check(conn, room_id, user)
        cur = conn.execute(
            """
            UPDATE room_members
               SET status = 'approved', approved_by_user_id = ?, approved_at = ?
             WHERE room_id = ? AND kind = ? AND user_id = ? AND backend_name = ?
               AND status = 'pending'
            """,
            (user["id"], now, room_id, member_kind, member_user_id, backend_name),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="pending member not found")
    return {"ok": True}


@app.post("/api/rooms/{room_id}/members/reject")
def api_room_reject(
    room_id: str,
    member_user_id: str,
    member_kind: str = "user",
    backend_name: str = "",
    user: dict[str, Any] = Depends(current_user),
):
    with _DB_LOCK, db_connect() as conn:
        _room_owner_check(conn, room_id, user)
        cur = conn.execute(
            """
            UPDATE room_members SET status = 'rejected'
             WHERE room_id = ? AND kind = ? AND user_id = ? AND backend_name = ?
               AND status = 'pending'
            """,
            (room_id, member_kind, member_user_id, backend_name),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="pending member not found")
    return {"ok": True}


@app.delete("/api/rooms/{room_id}/members")
def api_room_remove_member(
    room_id: str,
    member_user_id: str,
    member_kind: str = "user",
    backend_name: str = "",
    user: dict[str, Any] = Depends(current_user),
):
    with _DB_LOCK, db_connect() as conn:
        room = _room_owner_check(conn, room_id, user)
        if member_kind == "user" and member_user_id == room["owner_user_id"]:
            raise HTTPException(status_code=400, detail="cannot remove owner")
        conn.execute(
            "DELETE FROM room_members WHERE room_id = ? AND kind = ? AND user_id = ? AND backend_name = ?",
            (room_id, member_kind, member_user_id, backend_name),
        )
    return {"ok": True}


@app.get("/api/rooms/{room_id}/messages")
def api_room_messages(
    room_id: str,
    after_id: str | None = None,
    limit: int = 200,
    user: dict[str, Any] = Depends(current_user),
):
    limit = max(1, min(limit, 500))
    with db_connect() as conn:
        _room_visible(conn, room_id, user)
        if after_id:
            rows = conn.execute(
                "SELECT * FROM room_messages WHERE room_id = ? AND id > ? ORDER BY id LIMIT ?",
                (room_id, after_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM (SELECT * FROM room_messages WHERE room_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id",
                (room_id, limit),
            ).fetchall()
    return {"messages": [dict(r) for r in rows]}


@app.post("/api/rooms/{room_id}/messages")
def api_room_post_message(
    room_id: str,
    body: RoomMessageBody,
    user: dict[str, Any] = Depends(current_user),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="empty content")
    if len(content) > 32000:
        raise HTTPException(status_code=413, detail="message too large")
    msg_id = uuid.uuid4().hex
    now = int(time.time())
    with _DB_LOCK, db_connect() as conn:
        _room_visible(conn, room_id, user)
        conn.execute(
            """
            INSERT INTO room_messages
                (id, room_id, sender_kind, sender_user_id, sender_backend_name,
                 content, agent_turn_id, in_reply_to_message_id, created_at)
            VALUES (?, ?, 'user', ?, '', ?, NULL, NULL, ?)
            """,
            (msg_id, room_id, user["id"], content, now),
        )
    return {"ok": True, "id": msg_id, "created_at": now}


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> None:
    log.info("starting router on %s:%s; data=%s", ROUTER_BIND_HOST, ROUTER_PORT, STACK_ROOT)
    uvicorn.run(app, host=ROUTER_BIND_HOST, port=ROUTER_PORT, log_level="info")


if __name__ == "__main__":
    main()
