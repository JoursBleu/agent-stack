# Per-user / per-backend env overrides + admin-shared defaults

This document describes how `LLM_BASE_URL`, `LLM_API_KEY`, and any other
allow-listed environment variables are resolved when the router spawns a
runner container for `(user, backend)`.

## Resolution order

For every `(user, backend, var)` tuple where `var` is in
`backends.json[backend].user_overridable_env`, the router picks the
**first** value found in this list:

1. `user_env_overrides` row with `(user_id, backend_name=<backend>, env_var=<var>)`
   — the user's explicit override for this specific backend.
2. `user_env_overrides` row with `(user_id, backend_name='', env_var=<var>)`
   — the user's global override (applies to every backend).
3. `admin_shared_env(env_var=<var>).shared = 1` **and** some admin user
   has saved a global override for `<var>` (`user_env_overrides` row with
   `backend_name=''` and `users.role='admin'`). The most-recently-updated
   admin override wins. The router never reads these vars from process
   env / `.env` — the admin keeps the shared value in the DB by saving
   their own override.
4. Otherwise the spawn fails with `422 Unprocessable Entity`. The error
   message tells the user to set the value in
   *Settings → Backend API keys*.

The admin **cannot** force a value onto users; they can only flip the
shared toggle on/off. Users **cannot** share their own overrides with
anyone else.

## Storage

```
admin_shared_env(env_var TEXT PRIMARY KEY,
                 shared INTEGER NOT NULL DEFAULT 0,
                 updated_at INTEGER NOT NULL)

user_env_overrides(user_id TEXT NOT NULL,
                   backend_name TEXT NOT NULL DEFAULT '',  -- '' = global
                   env_var TEXT NOT NULL,
                   value TEXT NOT NULL,
                   updated_at INTEGER NOT NULL,
                   PRIMARY KEY (user_id, backend_name, env_var))
```

A migration in `db_init()` upgrades pre-v2 `user_env_overrides` (no
`backend_name`) by copying every existing row to `backend_name=''`.

## REST API

All routes require an authenticated session cookie.

### User self-service

- `GET /api/me/env-overrides`

  ```json
  {
    "vars": ["LLM_BASE_URL", "LLM_API_KEY"],
    "backends": {
      "LLM_BASE_URL": ["openclaw", "hermes"],
      "LLM_API_KEY":  ["openclaw", "hermes"]
    },
    "admin_shared":         {"LLM_BASE_URL": true,  "LLM_API_KEY": true},
    "admin_shared_present": {"LLM_BASE_URL": true,  "LLM_API_KEY": true},  // some admin has stored a value

    "overrides": {
      "":         {"LLM_BASE_URL": "ht…/v1"},
      "openclaw": {"LLM_API_KEY":  "sk-…abcd"}
    },
    "effective": {
      "openclaw": {
        "LLM_BASE_URL": {"source": "global",  "masked": "ht…/v1"},
        "LLM_API_KEY":  {"source": "backend", "masked": "sk-…abcd"}
      }
    }
  }
  ```

  `source ∈ {"backend", "global", "shared", "unset"}`.

- `PUT /api/me/env-overrides/{env_var}` body
  `{"value": "<plaintext>", "backend": "openclaw"}` — `backend` may be
  `""` for the user-global scope. Setting a value automatically stops
  every runner this user owns that uses `env_var`, so the next chat
  spawns a fresh container with the new value.

- `DELETE /api/me/env-overrides/{env_var}?backend=<name>` — removes
  one override row (omit `backend` query for the global one). Same
  auto-stop behavior.

### Admin shared toggle

- `GET  /api/admin/shared-env`
- `PUT  /api/admin/shared-env/{env_var}` body `{"shared": true}`

  Toggling `shared` stops **all** runners that use `env_var`, since the
  effective value changes for every user that has no per-user override.

## Frontend

*Settings* (gear icon, lower-left) renders one card per env var. Each
card shows:

- the var name and which backends use it;
- (admin only) a "share with users" checkbox — disabled with a hint
  when this admin has not yet saved a value in their own *Global* row
  (the router never reads upstream LLM creds from process env);
- a *Global* row (override that applies to every backend);
- one row per backend that uses this var, showing the current
  effective source (`shared` / `global` / `backend` / `unset`) plus a
  password input + Save / Clear buttons.

Saving or clearing any row triggers a refresh and stops the affected
user's runners; the next message will spawn a fresh container.
