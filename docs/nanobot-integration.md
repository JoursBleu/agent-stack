# nanobot (HKUDS) 集成

> 2026-05-13 落地。涉及 commit `e1d2211`。

agent-stack 接入 [HKUDS/nanobot](https://github.com/HKUDS/nanobot)（Python，MIT）作为第三个内置 backend，和 [OpenClaw](./openclaw-multi-agent.md) / [Hermes Agent](./hermes-integration.md) 并列。和前两个不同的是 nanobot 没有发布镜像，需要本地 build——见 [`images/nanobot/`](../images/nanobot/)。

本文记录 router ↔ nanobot 的交互模型、容器生命周期、踩过的坑、以及为它新加的 `forward_model_env` 机制。

## 整体形态

```
                     ┌────────────────────────────────┐
   browser ─/v1/...─►│  agent-stack-router (FastAPI)  │
                     │   - /v1/{path:path} OpenAI 代理 │
                     │   - 按 model 字段路由到 backend │
                     │   - forward_model_env 重写      │
                     └──────────────┬─────────────────┘
                                    │ docker run
                                    ▼
                     ┌────────────────────────────────┐
                     │ agstack-nanobot-<u>            │
                     │   nanobot serve  (port 8900)   │
                     │   ~/.nanobot/config.json       │
                     │     ├── providers.custom       │
                     │     ├── agents.defaults.model  │
                     │     └── api.host=0.0.0.0       │
                     └──────────────┬─────────────────┘
                                    │ OpenAI-compatible
                                    ▼
                          上游 LLM（LLM_BASE_URL/KEY/MODEL）
```

## 镜像 / 启动参数

| 字段 | 值 |
|---|---|
| image | `agstack/nanobot-hkuds:0.1.5.post3`（本地 build） |
| internal port | `8900`（nanobot 默认） |
| host port | router 动态分配（`19000+`） |
| `cmd` | `["serve"]` |
| `user` | `nanobot`（uid:gid `1000:1000`） |
| `mount_target` | `/home/nanobot/.nanobot` |
| `seed_subdir` | `seeds/nanobot-home/` |
| `templated_files` | `["config.json"]` |
| `extra_networks` | `["amd-bridge-standalone_default"]`（按需） |
| `forward_model_env` | `"LLM_MODEL"`（**关键**，见下文） |
| `default_idle_seconds` | `1800`（HKUDS nanobot 冷启动比 hermes/openclaw 慢，给宽点） |

`extra_networks` 是给那些"上游 LLM endpoint 跑在另一个 docker 网络里"的部署用的——参考 hermes-integration.md 的同名小节。

## 容器生命周期

和 hermes / openclaw 完全一致——见 [router/app.py](../router/app.py) 里的 `Manager.ensure / idle reaper / stop`，没有 nanobot 特定逻辑。第一次发 `/v1/chat/completions` 时按需起，30s 一次的 reaper 看到 `last_active > default_idle_seconds` 就 `docker stop` + `docker rm`。

## seed 配置（[`seeds/nanobot-home/config.json`](../seeds/nanobot-home/config.json)）

最小可用配置：

```json
{
  "providers": {
    "custom": {
      "apiKey": "${LLM_API_KEY}",
      "apiBase": "${LLM_BASE_URL}"
    }
  },
  "agents": {
    "defaults": {
      "provider": "custom",
      "model": "${LLM_MODEL}",
      "sandbox": "bwrap",
      "restrictToWorkspace": true
    }
  },
  "api": {
    "host": "0.0.0.0",
    "port": 8900
  }
}
```

router 在每次 `ensure()` 时把 `${LLM_BASE_URL}` / `${LLM_API_KEY}` / `${LLM_MODEL}` 替换成"该用户当前生效的值"再写进 `~/.nanobot/config.json`，然后才 `docker run`。`templated_files: ["config.json"]` 让用户改完 web UI 里的 LLM_* 后，老 runner 一回收，新 runner 起来就拿到新值。

## 关键坑：`forward_model_env`

**症状**：连完上游一切看似正常，第一条消息被 nanobot 拒掉：

```json
{"error": {"message": "Only configured model 'gpt-4.1-mini' is available",
           "type": "invalid_request_error", "code": 400}}
```

**原因**：HKUDS nanobot 的 OpenAI-compat API server 严格校验请求体的 `model` 字段——只接受它自己 config 里 `agents.defaults.model` 的那一个值。Hermes / OpenClaw 都不在意 client 发什么 model id（它们只看自己 config 里的 default agent / model），nanobot 偏要校验。

router 默认转发 client 给的 `model`（一般是 `nanobot/main`）→ 永远 400。

**解决**：在 `Backend` 上新增一个可选字段 `forward_model_env`：

```jsonc
// backends.json
{
  "name": "nanobot",
  "user_overridable_env": ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"],
  "forward_model_env": "LLM_MODEL"
}
```

router 在 `/v1/{path}` 代理路径里，如果命中的 backend 设了 `forward_model_env`，就把 payload 的 `model` 字段改写成"该用户当前生效的 `LLM_MODEL`"再发给 upstream，并重算 Content-Length。同时把房间分发路径里的 `_runner_chat_completion` 也加上同一段重写。

详见 [`router/app.py`](../router/app.py) 的 `v1_proxy` 和 `_runner_chat_completion`。

## 已知坑（HKUDS 侧）

### 1. `config.json` 里千万别写 `_comment` 字段

nanobot 顶层 config schema 是 pydantic `BaseModel`，**默认 `extra="forbid"`**——任何顶层未声明字段（哪怕是 `_comment`、`_note`）都会让整个 config 被静默拒绝。失败时它不报错，而是 fallback 到默认 config（`provider="auto"`、`model="anthropic/claude-opus-4-5"`、`providers={}`），然后第一次推理时报：

```
RuntimeError: No API key configured for provider 'None'.
```

注释只能放在隔壁 README，不要混进 config。

### 2. `agents.defaults.provider="custom"` 必须填齐 `providers.custom.{apiKey, apiBase}`

按 nanobot 的 provider 解析顺序，custom provider 没有 fallback 到 env var——必须 config 里就有。我们的 seed 用 `${LLM_API_KEY}` `${LLM_BASE_URL}` 占位符让 router 在 `_ensure_user_home` 时填进去。

### 3. `nanobot serve` 默认只 listen `127.0.0.1:8900`

容器外要能访问必须显式 `api.host: "0.0.0.0"`。否则 router 起完容器、port 也映射好了，curl 一通全 connection refused。

### 4. camelCase / snake_case 都接受

`apiKey` / `api_key` 等价；`apiBase` / `api_base` 等价。我们 seed 里统一用 camelCase（HKUDS 自家文档示例风格）。

### 5. nanobot 不接受 `max_completion_tokens`，只认 `max_tokens`

如果上游是 OpenAI gpt-5.x（reasoning models）会拒掉 `max_tokens`，要求 `max_completion_tokens`——这种组合 nanobot 没适配。可用的上游模型例子：`gpt-4.1-mini`、`gpt-4o`、`Claude-Sonnet-4` 等接受 `max_tokens` 的模型。

## 已知未做

- HKUDS nanobot 自带 `sessions.create` / `sessions.delete` 工具，目前我们没暴露给 router——每个用户的 nanobot 容器只有一个 `api:default` session。
- 没用上 nanobot 的 MCP 客户端能力（它能挂多个 MCP server）。
- nanobot 自己有 `sandbox: bwrap` + `restrictToWorkspace: true`，不像 OpenClaw 还提供 multi-agent；不需要拆 agent 维度的子目录隔离。
