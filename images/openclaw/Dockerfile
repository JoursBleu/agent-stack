FROM openclaw/openclaw:latest

# Add a sane chromium + CJK fonts on top of the upstream image so
# OpenClaw's `browser` plugin can launch a working desktop browser.
USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        ca-certificates \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libxkbcommon0 \
        libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libasound2 libpango-1.0-0 libcairo2 libcups2 \
        sudo openssh-client \
 && rm -rf /var/lib/apt/lists/*

# Allow the `node` user to run apt-get etc. inside running container
# (handy for skill installs). Drop this line if you don't need it.
RUN echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
 && chmod 0440 /etc/sudoers.d/node

# Optional: a chromium wrapper that routes browser traffic through an
# HTTP proxy (set CHROMIUM_PROXY=<url> at run time, e.g. http://127.0.0.1:1081)
# and clears stale SingletonLock files. If you don't need a proxy, you can
# delete this COPY and the next two lines, and OpenClaw will use /usr/bin/chromium
# directly.
COPY chromium-proxied /usr/local/bin/chromium-proxied
RUN chmod +x /usr/local/bin/chromium-proxied
ENV PATH=/usr/local/bin:$PATH

USER node
HEALTHCHECK --interval=3m --timeout=10s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:17567/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
