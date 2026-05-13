# nanobot (HKUDS) image overlay

agent-stack ships with [HKUDS/nanobot](https://github.com/HKUDS/nanobot) (MIT) as the third built-in backend, alongside OpenClaw and Hermes Agent. There is no published image, so this directory contains the `Dockerfile` you build locally before `docker compose up`.

## Build

```bash
cd images/nanobot
docker build -t agstack/nanobot-hkuds:0.1.5.post3 \
    --build-arg NANOBOT_REF=v0.1.5.post3 .
```

The tag must match `image:` in [`backends.json`](../../backends.json) (default `agstack/nanobot-hkuds:0.1.5.post3`). To pin a different upstream commit:

```bash
docker build -t agstack/nanobot-hkuds:dev \
    --build-arg NANOBOT_REF=main .
```

…then update `backends.json` accordingly.

## What's inside

- Python 3.12 + `uv` (from `ghcr.io/astral-sh/uv` slim base)
- HKUDS nanobot at `${NANOBOT_REF}`, installed with the `[api]` extra (FastAPI server)
- The bundled TS `bridge/` sidecar built with Node 20
- `bubblewrap` for nanobot's `sandbox: bwrap` mode
- A non-root `nanobot` user (uid:gid 1000:1000) so the per-user mount is owned correctly when agent-stack `chown`s it before `docker run`

## Why not `pip install nanobot[api]`?

Two reasons:

1. The `bridge/` TS sidecar is shipped in the git tree, not in the Python wheel. A pure-pip install gives you an unusable nanobot.
2. We pin to a specific tag so `docker build` is reproducible across machines.

See [docs/nanobot-integration.md](../../docs/nanobot-integration.md) for the per-user runtime contract (config templating, model rewriting, sandbox notes).
