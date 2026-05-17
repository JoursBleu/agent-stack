# Agent → Router callback

Per-agent runner containers can push messages and status events back into
their own conversation via an internal callback endpoint. This is what
powers heartbeat updates, async progress reporting, and any "agent talks
to user without waiting for a new prompt" pattern.

## Contract

For every runner the router starts via `ensure_for_agent`, the container
gets three environment variables injected:

| env var                         | meaning                                              |
| ------------------------------- | ---------------------------------------------------- |
| `AGENT_STACK_AGENT_ID`          | this runner's agent id (path param below)            |
| `AGENT_STACK_RUNNER_API_KEY`    | bearer token; only valid for this agent              |
| `AGENT_STACK_CALLBACK_URL`      | base URL of the router from inside the container     |

The default `AGENT_STACK_CALLBACK_URL` is `http://172.17.0.1:18080`
(the docker0 bridge gateway → host). It can be overridden globally with
the `AGENT_STACK_CALLBACK_URL` env on the router.

### Endpoints

- `GET  $AGENT_STACK_CALLBACK_URL/healthz` — unauthenticated liveness.
- `POST $AGENT_STACK_CALLBACK_URL/api/internal/agents/{agent_id}/event`

  Headers:
  - `Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY`
  - `Content-Type: application/json`

  Body:
  ```json
  {"role": "system", "content": "any markdown text"}
  ```
  Allowed roles: `system`, `assistant`, `error`. `agent_id` in the URL
  must match the bearer's agent.

  Response: `{"message_id": "...", "conversation_id": "...", "created_at": <ts>}`.
  The message is appended to the agent's active conversation and pushed
  to all open SSE subscribers immediately.

## Networking requirement

The router must be reachable from per-agent runner containers, which run
on the default docker bridge. The router compose service uses
`network_mode: host`, so binding `0.0.0.0` listens on both the loopback
(used by the frontend reverse proxy) and the docker0 gateway address
(used by runners). This is the default since the bind-host fix.

If you need to restrict exposure, set `ROUTER_BIND_HOST=172.17.0.1` in
`.env` — runners can still reach it, but the frontend will need to use
`172.17.0.1` (not `127.0.0.1`) for its upstream. `127.0.0.1` alone makes
the callback path unreachable from any container.

## Agent awareness

Each runner home is seeded from `seeds/<backend>-home/`. The seeds
include `AGENTS.md` and `skills/agent-stack-callback/SKILL.md`, which
document the contract to the agent itself so it knows when to call back
(e.g. for heartbeats, partial progress, post-tool reflections) instead
of waiting for the next user message.

`templated_files` in `backends.json` controls which files are re-rendered
on every fresh runner creation. To roll out updated docs to *already
running* user homes, re-copy from `seeds/` manually.

## Quick test from a runner

```bash
docker exec agstack-<backend>-<user> sh -lc '
  curl -sS $AGENT_STACK_CALLBACK_URL/healthz
  curl -sS -X POST "$AGENT_STACK_CALLBACK_URL/api/internal/agents/$AGENT_STACK_AGENT_ID/event" \
    -H "Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY" \
    -H "content-type: application/json" \
    -d "{\"role\":\"system\",\"content\":\"hello from runner\"}"
'
```
