# Agent runtime notes

You are running inside an **agent-stack** runner container. A few things you should know about your environment:

## Pushing messages back to the user's chat (heartbeat / async results)

The router injects three env vars on container start:

- `AGENT_STACK_AGENT_ID` — your agent id
- `AGENT_STACK_RUNNER_API_KEY` — bearer token authenticating you
- `AGENT_STACK_CALLBACK_URL` — router base URL (typically `http://172.17.0.1:18080`)

Use them to **POST a message into the user's currently-open conversation** at any time, even when the user is not actively prompting you. This is how you should:

- Report progress during a long-running task (`role:"system"`, `kind:"progress"`).
- Send a periodic heartbeat from a background loop or cron so the user knows you are still alive.
- Surface async results (a build finished, a download completed, a watcher triggered) without waiting for the user to ask.

Endpoint:

```
POST $AGENT_STACK_CALLBACK_URL/api/internal/agents/$AGENT_STACK_AGENT_ID/event
Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY
Content-Type: application/json

{
  "role": "system",          // user|assistant|system|error
  "kind": "message",          // "message" persists+broadcasts; any other kind broadcasts only
  "content": "...text shown in the chat...",
  "persist": true,            // false = ephemeral toast that vanishes on reload
  "conversation_id": null,    // omit -> agent's most-recent conversation
  "payload": {}               // arbitrary JSON forwarded to the SSE listener
}
```

One-liner (shell tool):

```bash
curl -sS -X POST "$AGENT_STACK_CALLBACK_URL/api/internal/agents/$AGENT_STACK_AGENT_ID/event" \
  -H "Authorization: Bearer $AGENT_STACK_RUNNER_API_KEY" \
  -H "content-type: application/json" \
  -d '{"role":"system","content":"heartbeat"}'
```

If the agent has never had a conversation yet, the call returns HTTP 409 — that is normal, just wait until the user sends their first message.

For longer recipes and a Python helper, read `skills/agent-stack-callback/SKILL.md` in this same home directory.

## When to call it (rules of thumb)

- **Do call** before starting work that will take more than ~30s — emit a `"working on X..."` line so the user sees you are not stuck.
- **Do call** when a background task you spawned earlier finishes (build, download, scrape, scheduled job).
- **Do** schedule a 5-minute heartbeat for any standalone long job you set up (cron, `while sleep 300`, etc.), with `kind:"progress"` and `persist:false`.
- **Do not** spam the chat with one event per loop iteration — coalesce.
- **Do not** use it as a substitute for your normal reply channel; if the user is currently waiting on your reply, just answer.
