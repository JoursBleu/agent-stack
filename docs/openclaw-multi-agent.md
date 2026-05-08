# OpenClaw 在 agent-stack 里的形态

> 现状记录于 2026-05-07。所有结论既来自 `/app/docs/`（OpenClaw 自带文档），也对照过 `/app/dist/` 实际编译出的 JS。

## 一句话摘要

我们 seed 出来的一个 OpenClaw 容器里跑 N 个**顶层 agent**，对外通过
`model: "openclaw/<agentId>"` 选 agent，按 OpenAI `user` 字段做 session 黏滞。
"agent" 之间默认互不知道对方存在，没有原生的 A→B 调用通道。

---

## 1. agent vs sub-agent

文档原文（`/app/docs/concepts/multi-agent.md`、`/app/docs/automation/tasks.md`）：

- **agent（顶层 / persona）**
  - 在 `agents.list[]` 声明
  - 可通过 `model: "openclaw/<id>"` 直接路由
  - `/v1/models` 会列出来
  - 每个 agent 拥有独立 workspace、独立 `agentDir`、独立 sessions
- **sub-agent（执行拓扑）**
  - 由父 agent 在自己一次 run 中调用 `sessions_spawn` 工具临时拉起
  - **不会**出现在 `/v1/models`
  - 父子复用 / 继承上下文，做 fan-out（同时跑多个网页抓取等）
  - 在 `tasks` ledger 里 runtime=`subagent`

> 原话："Sub-agents remain internal execution topology. They do not appear as
> pseudo-models." —— `/app/docs/gateway/openai-http-api.md`

---

## 2. agent 之间的隔离边界（看代码确认）

来自 `/app/dist/agent-scope-*.js` 的 `resolveAgentWorkspaceDir` 和
`resolveAgentDir`：

| 资源 | 实际路径 | 默认是否共享 |
|---|---|---|
| Workspace（`AGENTS.md` / `SOUL.md` / `MEMORY.md` / `memory/` / `skills/`） | default agent → `~/.openclaw/workspace`<br>其他 → `~/.openclaw/workspace-<id>` | ❌ 各自独立 |
| `agentDir`（OAuth、API key、模型注册） | `~/.openclaw/agents/<id>/agent` | ❌ 各自独立，**严禁复用**（auth/session 冲突） |
| Sessions（对话历史） | `~/.openclaw/agents/<id>/sessions/` | ❌ 各自独立 |
| Skills baseline | `agents.defaults.skills` | ✅ 显式共享 |
| QMD transcript memory | `memorySearch.qmd.extraCollections` | 默认不共享，可显式开（只读） |

### 但是！容器层并不隔离

OpenClaw 自己的提醒（`/app/docs/concepts/agent-workspace.md`）：

> the workspace is the **default cwd**, not a hard sandbox. Tools resolve
> relative paths against the workspace, but **absolute paths can still reach
> elsewhere on the host** unless sandboxing is enabled.

我们当前一个容器跑多 agent 的形态意味着：

- 同一 node 进程、同一 uid（root / node）、同一文件系统
- 任何 agent 的 bash / file-read 工具都能用绝对路径读取另一 agent 的
  workspace、agentDir、auth-profiles.json、sessions
- 整个 `openclaw.json`（含 secret refs）也是共享的

**所以"fully isolated persona"是**身份/记忆**层的隔离，不是**进程/FS**层的隔离。**

要真隔离的话三档：

1. 软约束：开 `agents.defaults.sandbox` + `workspaceAccess != "rw"`
2. 中等：每 agent 一个容器（router 把 backend key 从 `openclaw` 细化成
   `openclaw:<agentId>`，复用现有 spawn/auth 逻辑）—— 推荐路径
3. 强：每 agent 一个 user / userns-remap / pod-per-agent

---

## 3. 当前 seed 配置

- `seeds/openclaw-home/openclaw.json` 声明 `agents.list = [main, researcher, coder]`
- 没显式配 `agents.list[].workspace` 或 `agents.defaults.workspace`
- 容器里实际目录（按代码默认规则）：
  - `main` → `~/.openclaw/workspace`（default agent 没有 `-id` 后缀）
  - `researcher` → `~/.openclaw/workspace-researcher`
  - `coder` → `~/.openclaw/workspace-coder`
  - 各自 agentDir → `~/.openclaw/agents/{main,researcher,coder}/agent`

---

## 4. 已知未做：agent 之间互相调用

OpenClaw 没原生 A→B channel；要做需要 router 层注入工具：

- 路径 A（A 把 B 当 tool，B 不知情）：router 暴露内部
  `/internal/agent-call`，OpenClaw seed 注册一个 stub 工具指过去，结果回 A
- 路径 B（A、B 像群聊互发，双向可见）：DB 改 chat ↔ agent N:N，UI 加群聊视图

待用户决定哪种。
