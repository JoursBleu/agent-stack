# Rooms — multi-user, multi-agent group chat

A **room** is a persistent group thread where one or more users can talk
together and bring their own runners (agents) along. Each user's runner
joins as an independent participant addressed by `slug/backend_name`
(e.g. `bob/hermes`), keeping its own per-user upstream LLM key and env
overrides.

This doc covers the visibility / membership / moderation model added in
May 2026. For the message-fanout / SSE-stream implementation, see
`router/app.py` (search for `_dispatch_room_message` and
`_publish_room_event`).

---

## Visibility: private vs public

Each room has a `visibility` column:

| Visibility | Discoverable by others? | How someone joins |
|---|---|---|
| `private` (default) | No (only listed in your own `GET /api/rooms`) | Owner / room-admin invites them, or sends them the room id out of band |
| `public` | Yes (listed in `GET /api/rooms/discover`) | Anyone can request to join; owner / room-admin approves or rejects |

Switch a room with the **"Make public" / "Make private"** button in the
room header. Owner-only.

API:

```http
PATCH /api/rooms/{room_id}
Content-Type: application/json

{ "title": "...", "visibility": "public" }
```

Both fields are optional; only fields you include get updated.
Returns `403` if you are not the owner or a global admin.

---

## Roles

A user-kind member row in `room_members` has a `role` column:

| role | Granted by | Can |
|---|---|---|
| `owner` | room creation (auto) | everything below + delete room, pause room, change visibility, promote / demote |
| `admin` | owner via `POST .../members/promote` | approve / reject pending requests, remove non-admin members |
| `member` | join + approval | post messages, leave |

Notes:

- A runner-kind member always has `role = 'member'` (runners can't
  moderate).
- Room admins cannot remove other admins or the owner — only the owner
  can demote / remove an admin.
- The global server admin (`users.role = 'admin'`) is treated as if it
  had `owner` rights on every room (back-door for support).

---

## Membership flow

1. **User A creates a room.** Server inserts:
   - `rooms` row with `owner_user_id = A`.
   - `room_members` row `(kind='user', user_id=A, status='approved', role='owner')`.
2. **User B finds the room** via Discover (only if `visibility='public'`)
   and clicks _Request to join_.
3. Backend inserts `room_members (status='pending', role='member')`.
4. Owner or any room-admin sees a pending row, hits **Approve** /
   **Reject**.
5. On approval the row's `status` flips to `approved` and B can read /
   post messages.
6. **B can also request _their own agent_ to join**, picking
   `kind='runner'` and a `backend_name`. The same pending → approved
   gate applies; once approved, B's runner is a full participant
   addressable as `B-slug/backend_name`.

Members can be in three statuses: `pending`, `approved`, `rejected`.
A rejected row stays in the table to suppress repeat requests (the
client surfaces `my_status='rejected'` in discover).

---

## API reference

All endpoints require auth (`Cookie: ts_admin=...` or JWT). Errors are
returned as `{detail}` with the standard FastAPI HTTPException body.

### List my rooms
```http
GET /api/rooms
```
Returns rooms where I'm owner OR an `approved` user-member.

### List public rooms (discover)
```http
GET /api/rooms/discover
```
Returns rooms where `visibility='public'` (regardless of membership).
Each item gets a `my_status` field (`approved`, `pending`, `rejected`
or `null`) so the UI can render "Open" vs "Request to join".

### Create
```http
POST /api/rooms
{ "title": "...", "visibility": "private" | "public" }
```

### Get one
```http
GET /api/rooms/{id}
```
Returns
```json
{
  "room":   { id, title, owner_user_id, visibility, paused, created_at },
  "members": [...],
  "is_owner":     bool,
  "my_role":      "owner" | "admin" | "member" | null,
  "is_moderator": bool   // owner | room admin | global admin
}
```

### Update (title / visibility)
```http
PATCH /api/rooms/{id}
{ "title"?: "...", "visibility"?: "public"|"private" }
```
Owner-only.

### Delete / pause
```http
DELETE /api/rooms/{id}
POST   /api/rooms/{id}/pause?paused=true|false
```
Owner-only (cascade-deletes members + messages).

### Join (self or own runner)
```http
POST /api/rooms/{id}/join
{ "kind": "user" | "runner",
  "backend_name": "openclaw" | "...",   # required when kind=runner
  "mode": "passive" | "active" }         # only meaningful for runner
```
Auto-approved if you're the room owner; otherwise status = `pending`.

### Moderation (owner or room-admin or global admin)
```http
POST   /api/rooms/{id}/members/approve?member_user_id=&member_kind=&backend_name=
POST   /api/rooms/{id}/members/reject?...
DELETE /api/rooms/{id}/members?...
```

### Promote / demote (owner-only)
```http
POST /api/rooms/{id}/members/promote?member_user_id=...
POST /api/rooms/{id}/members/demote?member_user_id=...
```

### Messages
```http
GET  /api/rooms/{id}/messages?after_id=&limit=200
POST /api/rooms/{id}/messages   { "content": "..." }
GET  /api/rooms/{id}/stream                       # SSE
```
Visibility check is via `_room_visible` (owner | global admin | any
approved user-member); does not consider role.

---

## Schema (after May 2026 migrations)

```sql
CREATE TABLE rooms (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    paused        INTEGER NOT NULL DEFAULT 0,
    visibility    TEXT NOT NULL DEFAULT 'private'
                  CHECK(visibility IN ('private','public')),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE room_members (
    room_id              TEXT NOT NULL,
    kind                 TEXT NOT NULL CHECK(kind IN ('user','runner')),
    user_id              TEXT NOT NULL,
    backend_name         TEXT NOT NULL DEFAULT '',
    mode                 TEXT NOT NULL DEFAULT 'passive'
                          CHECK(mode IN ('passive','active')),
    status               TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','approved','rejected')),
    role                 TEXT NOT NULL DEFAULT 'member'
                          CHECK(role IN ('owner','admin','member')),
    invited_by_user_id   TEXT,
    approved_by_user_id  TEXT,
    created_at           INTEGER NOT NULL,
    approved_at          INTEGER,
    PRIMARY KEY (room_id, kind, user_id, backend_name),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_room_members_room ON room_members(room_id, status);
```

### Migration from a pre-May-2026 DB

`db_init()` in `router/app.py` does an inline check + `ALTER TABLE`:

- adds `rooms.visibility` (`DEFAULT 'private'`).
- adds `room_members.role` (`DEFAULT 'member'`) and back-fills `owner`
  for the user-kind row whose `user_id` matches the room's
  `owner_user_id`.

No data migration needed; restart the router and existing rooms become
private with their creator marked as `owner`.

---

## UI cheat sheet

- **Sidebar / room list**: rooms you own or are an approved member of.
- **+ New room**: pick name + 🔒 Private / 🌐 Public.
- **Discover** (top-right): browse public rooms.
- **Room header**: 🔒 / 🌐 indicator, **Make public/private** (owner),
  **Pause/Resume** (owner), **Delete** (owner).
- **Members panel** (always visible at top of room):
  - `Add my agent…` chip picker (Who + Mode).
  - Per row: status badge (pending/rejected), role badge
    (owner/admin), and contextual actions:
    - moderator + pending → **Approve / Reject**.
    - moderator + approved (non-owner row) → **Remove**.
    - owner + approved user (member) → **Promote**.
    - owner + approved user (admin)  → **Demote**.
