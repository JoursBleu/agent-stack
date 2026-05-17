# agent-stack-callback

Push messages and events from inside this runner container back into the
agent's own conversation in the agent-stack UI. The agent-stack router
injects three environment variables on container start:

| Variable | Meaning |
| -------- | ------- |
| `AGENT_STACK_AGENT_ID` | The agent id this container was started for. |
| `AGENT_STACK_RUNNER_API_KEY` | Shared secret authenticating this runner. Treat as a bearer token. |
| `AGENT_STACK_CALLBACK_URL` | Base URL of the router as reachable from inside the container (default `http://172.17.0.1:18080`). |

## Endpoint

```
POST $AGENT_STACK_CALLBACK_URL/api/internal/agents/$AGENT_STACK_AGENT_ID/event
Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY
Content-Type: application/json
```

Body schema:

```json
{
  "conversation_id": "optional; defaults to the agent's most-recent conversation",
  "role": "system",
  "kind": "message",
  "content": "string shown in the chat",
  "persist": true,
  "payload": { "any": "extra json broadcast to SSE subscribers" }
}
```

- `role` is one of `user|assistant|system|error`. Default `system`.
- `kind="message"` with `persist=true` (default) inserts a row into the
  conversation and broadcasts a live SSE `message` event. Use
  `persist=false` for transient toasts/indicators that should not survive
  reload.
- Any other `kind` (e.g. `progress`, `tool_log`) just broadcasts to SSE
  subscribers without touching the DB.

## Examples

### Cron heartbeat from inside the container

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_STACK_CALLBACK_URL:?}"
: "${AGENT_STACK_AGENT_ID:?}"
: "${AGENT_STACK_RUNNER_API_KEY:?}"

curl -sS -X POST \
  "$AGENT_STACK_CALLBACK_URL/api/internal/agents/$AGENT_STACK_AGENT_ID/event" \
  -H "Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg msg "heartbeat at $(date -Is)" \
        '{role:"system", content:$msg}')"
```

Schedule inside the container:

```cron
*/5 * * * * /usr/local/bin/agent-stack-heartbeat.sh >> /tmp/heartbeat.log 2>&1
```

### Streaming progress from a long-running background job (python)

```python
import os, json, urllib.request

def notify(content, kind="message", role="system", persist=True, **extra):
    url = f'{os.environ["AGENT_STACK_CALLBACK_URL"]}/api/internal/agents/{os.environ["AGENT_STACK_AGENT_ID"]}/event'
    body = json.dumps({
        "role": role, "kind": kind, "content": content,
        "persist": persist, "payload": extra,
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "authorization": f'Bearer {os.environ["AGENT_STACK_RUNNER_API_KEY"]}',
        "content-type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())

notify("build started")
# ... do work ...
notify("build finished: 0 errors, 2 warnings")
```

## Notes

- Conversation auto-resolves to the most-recently-active one for this
  agent if `conversation_id` is omitted. If the agent has no
  conversations yet, the call returns HTTP 409.
- The `AGENT_STACK_RUNNER_API_KEY` is rotated every time the runner is
  restarted; cache it only for the lifetime of the container process.
- Default `AGENT_STACK_CALLBACK_URL=http://172.17.0.1:18080` is the
  docker bridge gateway on Linux. On Mac/Windows the router admin sets
  this env var (e.g. `http://host.docker.internal:18080`).
- Events are best-effort: persisted messages always show on reload, but
  transient (`persist=false`) events are dropped if no tab is connected.
