## HKUDS nanobot — buildable image for agent-stack
##
## Upstream: https://github.com/HKUDS/nanobot (Apache 2.0)
## We do not depend on a published image. Build locally:
##
##   cd images/nanobot
##   docker build -t agstack/nanobot-hkuds:0.1.5.post3 \
##       --build-arg NANOBOT_REF=v0.1.5.post3 .
##
## The agent-stack router expects the resulting image tag to match
## `image:` in backends.json (default: agstack/nanobot-hkuds:0.1.5.post3).

FROM ghcr.io/astral-sh/uv:0.5.7-python3.12-bookworm-slim

ARG NANOBOT_REPO=https://github.com/HKUDS/nanobot.git
ARG NANOBOT_REF=v0.1.5.post3

# System deps:
#   - bubblewrap: nanobot's `sandbox: bwrap` mode requires it
#   - nodejs: nanobot bundles a small TS bridge ("bridge/") that runs
#     under node 20 for a few of its tools
#   - git/curl/ca-certificates/openssh-client: source fetch + tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg git bubblewrap openssh-client && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get purge -y gnupg && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pull HKUDS nanobot at the pinned ref. We use git rather than a PyPI
# wheel because HKUDS ships the bridge/ TS sidecar as part of the repo
# (`npm run build` below), which the wheel-only install would miss.
RUN git config --global advice.detachedHead false && \
    git clone --depth 1 --branch "${NANOBOT_REF}" "${NANOBOT_REPO}" /tmp/nanobot && \
    cp -a /tmp/nanobot/. /app/ && \
    rm -rf /tmp/nanobot /app/.git

# Python install: package + optional [api] extra (FastAPI server). We
# install in two passes (touch __init__.py then real install) so the
# package metadata is present before we layer the bridge build on top.
RUN mkdir -p nanobot bridge && touch nanobot/__init__.py && \
    uv pip install --system --no-cache . && \
    uv pip install --system --no-cache ".[api]"

# Build the TS bridge sidecar.
WORKDIR /app/bridge
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ && \
    git config --global url."https://github.com/".insteadOf git@github.com: && \
    npm install && npm run build

WORKDIR /app

# Run as uid:gid 1000:1000; agent-stack chown's the per-user mount to
# this uid before docker run.
RUN useradd -m -u 1000 -s /bin/bash nanobot && \
    mkdir -p /home/nanobot/.nanobot && \
    chown -R nanobot:nanobot /home/nanobot /app

# Entrypoint just defers to `nanobot <cmd>` so backends.json can pass
# `cmd: ["serve"]`.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

USER nanobot
ENV HOME=/home/nanobot

# nanobot serve binds 0.0.0.0:8900 (api.host/port set in seeds config.json).
EXPOSE 8900

ENTRYPOINT ["entrypoint.sh"]
CMD ["status"]
