# OpenClaw image for agent-stack

`backends.json` references `openclaw-with-chromium:latest`. You have two
options to provide it.

## Option A — use the official OpenClaw image directly

If you don't need a desktop browser inside the container (no `browser`
plugin), just point `backends.json[openclaw].image` at the upstream tag:

```jsonc
{ "image": "openclaw/openclaw:latest" }
```

Then `docker pull openclaw/openclaw:latest` and you're done. See the
[OpenClaw repo](https://github.com/openclaw/openclaw) for tags.

## Option B — build the thin overlay (this directory)

If you want OpenClaw's `browser` plugin to drive a real desktop Chromium:

```bash
cd images/openclaw
docker build -t openclaw-with-chromium:latest .
```

The overlay adds: `chromium`, CJK + emoji fonts, the runtime libs Chromium
links against, `sudo` for the `node` user, and an optional `chromium-proxied`
wrapper. **No modification to OpenClaw itself.**

### Routing chromium through an HTTP proxy (optional)

Set `CHROMIUM_PROXY` (and optionally `CHROMIUM_PROXY_BYPASS`) in the
container env, and have OpenClaw launch `/usr/local/bin/chromium-proxied`
(already wired via `seeds/openclaw-home/openclaw.json`'s
`browser.executablePath`). Useful when the runner sits behind a corporate
firewall but a local HTTP proxy can reach the internet.

```bash
docker run -e CHROMIUM_PROXY=http://127.0.0.1:1081 \
           -e CHROMIUM_PROXY_BYPASS='<-loopback>;127.0.0.1;localhost;10.0.0.0/8' \
           --network host \
           openclaw-with-chromium:latest
```

If `CHROMIUM_PROXY` is empty, the wrapper falls through to a plain
`/usr/bin/chromium` (still useful for the SingletonLock cleanup).

### Trimming the overlay

- Don't need a proxy? Delete `chromium-proxied` and its `COPY` / `RUN`
  lines, and set `seeds/openclaw-home/openclaw.json` →
  `browser.executablePath` to `/usr/bin/chromium`.
- Don't need `node` to run apt inside the container? Delete the
  `/etc/sudoers.d/node` line.
- Don't need CJK glyphs? Drop `fonts-noto-cjk` and `fonts-noto-color-emoji`.
