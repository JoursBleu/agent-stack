# Hermes Agent 集成

> 2026-05-07 落地。涉及 commit `5117cb5` `0f1a280` `b6e2054` `b3f5186`。

agent-stack 接入 [`nousresearch/hermes-agent:latest`](https://github.com/NousResearch/hermes)。
本文记录 router ↔ hermes 交互模型、容器生命周期、session 复用、以及踩过的坑。

## 整体形态

```
                           ┌───────────────────────────────┐
   browser ─/v1/...─►      │  agent-stack-router (FastAPI) │
   (frontend SPA)          │   - auth/session              │
                           │   - conversations DB          │
                           │   - container manager         │
                           │   - /v1/* OpenAI proxy        │
                           └────┬──────────────────┬───────┘
                                │ http             │ docker run
                                ▼                  ▼
                  ┌─────────────────────┐   ┌─────────────────────┐
                  │ agstack-hermes-<u>  │   │ agstack-openclaw-<u>│
                  │  /v1 (api_server)   │   │  /v1 (gateway)      │
                  │  → upstream LLM-gateway  │   │  → upstream LLM-gateway  │
                  └─────────────────────┘   └─────────────────────┘
```

- 容器粒度 = `(user_id, backend)`。一个用户同 backend 永远只有 1 个容器，
  里面跑着 hermes gateway / openclaw gateway。
- 推理 LLM 不在 backend 容器里，所有真实 LLM 调用都穿过它去
  `<your-llm-base-url>`。

## 镜像 / 启动参数

| 字段 | 值 |
|---|---|
| image | `nousresearch/hermes-agent:latest` |
| internal port | `8080` |
| host port | router 动态分配（`19000+`） |
| `network_mode` | `host` 不行（hermes 自己 bind 0.0.0.0:8080 会撞 router 的 18080，已改回端口映射） |
| volumes | `/data/users/<u>/hermes-agent/data → /opt/data` |
| `extra_env` | `OPENAI_BASE_URL=<your-llm-base-url>`, `OPENAI_API_KEY=${LLM_API_KEY}`, **`GATEWAY_ALLOW_ALL_USERS=true`** |

`GATEWAY_ALLOW_ALL_USERS=true` 必须显式打开，否则 hermes 会按平台 allowlist
默认拒绝（路由层无关 user 反而被它当成"未授权用户"），症状是
`POST /v1/chat/completions → 403 Forbidden`。

## 容器生命周期

由 [`router/app.py`](../router/app.py) 里的 `Manager` 负责。

```
ensure(user, backend)        ← 用户首次发 /v1/chat/completions
    └─ docker run + 写 runners 表

idle reaper (每 30s 扫一次)   ← /api/runners 路径不算活动
    └─ last_active > 600s
        → docker stop (timeout 15s) + docker rm
        → DELETE FROM runners

stop(user, backend)          ← 用户点 ×、admin force-stop、用户改 API key
    同上
```

设计取舍：

- **idle 后真销毁容器（不是 pause）**：容器名 `agstack-<backend>-<u>` 复用，
  留着 stopped 容器 `docker run` 重名会冲突；env / extra_hosts /
  templated_files 的重渲染也只能新容器吃。
- 数据**持久**在宿主机 `/data/users/<u>/hermes-agent/data/`，新容器照样挂回去。
  hermes 的 `sessions/` `workspace/` `response_store.db` 全部留着。

## Session 模型（关键）

Hermes 自带"OpenAI-compatible session 复用"，[api_server.py](../docs/) 路径：

```python
# 优先级 1：客户端显式指定（router 现在用这个）
provided_session_id = request.headers.get("X-Hermes-Session-Id", "")

# 优先级 2：从对话首条 user message 派生
session_id = "api-" + sha256(system_prompt + first_user_message)[:16]
```

意味着：**两条对话的第一条 user 消息相同（比如都是 "hi"）→ 撞同一个
session**，sandbox / 内部历史 / response_store 全混在一起。这是 hermes 设计
给单租户 OpenWebUI 等场景准备的，对多对话 SaaS 形态是 bug。

agent-stack 的对策（`v1_proxy`）：

```python
# router 在转发到 hermes-agent 时把 OpenAI `user` 字段（前端填的
# "agstack-<conv_id>"）拆出来，写到 X-Hermes-Session-Id
if backend_def.name == "hermes-agent" and user_field:
    headers["X-Hermes-Session-Id"] = user_field
```

每个前端对话 → 唯一 hermes session：

| 前端对话 | OpenAI `user` 字段 | hermes 实际 session id |
|---|---|---|
| conv `abc123` | `agstack-abc123` | `agstack-abc123` |
| conv `def456` | `agstack-def456` | `agstack-def456` |

副作用：删除前端对话**不会**清理 hermes 容器内对应 sandbox / sessions/
session_*.json / response_store.db 行。是个 leak，目前无功能影响。

## CSRF / Origin 坑

浏览器自动带 `Origin: http://<host>:18000`；router 之前透传，hermes
api_server 的 CSRF 防护把它当跨站请求拒了 → 403。

修复（`_proxy_headers`）：剥掉浏览器特有的 header，再走代理：

```python
_BROWSER_HEADERS_TO_STRIP = {
    "origin", "referer",
    "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest",
}
```

## 流式 / 非流式

- 前端固定带 `stream: true`
- router 用 httpx 流式 send + `aiter_raw()` 透传 SSE（不 buffer 整 body）
- hermes 输出会带前导 `\n\n`，前端 `renderMessages` 在显示
  assistant 消息时 strip 前导空白（commit `b6e2054`），避免 pill 跟正文不在
  同一行。

## 上下文窗口探测

第一次请求时 hermes 会探一下 upstream LLM 的 model context length，upstream LLM 的
`/v1/models` 不返 context_length 字段，hermes 报：

```
Could not detect context length for model 'Auto' at <your-llm-base-url>
— defaulting to 128,000 tokens (probe-down).
```

只是 INFO 行，不影响功能；如果想消掉，可以在 hermes 容器
`/opt/hermes/.hermes/config.yaml` 里写死 `model.context_length: 128000`。

## 端到端验收（<host>）

- 创建对话 → POST /api/conversations 仅写 sqlite，不动容器
- 第一次 `/v1/chat/completions`
  - router `ensure()` → `docker run` hermes（≈10s 冷启）
  - 走 `X-Hermes-Session-Id=agstack-<conv>` → 命中专属 session
  - 流式 SSE 透传到前端，正常出文字
- 12 分钟无对话 → reaper 销毁容器，前端侧栏 backend 状态变 idle，▶ Start
  按钮出现
- 再发一条消息 → 重新 spawn，挂回旧 data 目录，session 状态延续

## 故障 cheatsheet

| 症状 | 排查 |
|---|---|
| `POST /v1/chat/completions 403` | check `GATEWAY_ALLOW_ALL_USERS=true`，check router 是否 strip 了 Origin |
| 两条对话答非所问、互相串内容 | 确认 router 进了 commit ≥ `b3f5186`（X-Hermes-Session-Id 已注入） |
| 前端 pill 与回复换行 | 检查前端 `renderMessages` 是否做了 `\s+` 前置 strip（commit ≥ `b6e2054`） |
| `502 Bad Gateway` | upstream LLM 上游抖动 / 真实 LLM 联不上，看 `/var/log/llm-gateway.out` on your gateway host |
| 重启 hermes 后丢历史 | 检查 `/data/users/<u>/hermes-agent/data/` 是不是被一并删了 |
