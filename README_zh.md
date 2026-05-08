# agent-stack

> 多租户、多后端的 agent 运行时；对外暴露统一的 OpenAI 兼容 HTTP 接口，背
> 后聚合多个真实 agent runtime（OpenClaw、Hermes Agent…）。

> [English README](./README.md)

替代 "OpenWebUI + 一堆 sidecar 容器" 的轻量方案：一个 router、一份小型
SPA、按需 docker spawn 出来的 per-user agent 容器、闲置自动回收，对话历史
存在云端。

## 特性

- **每 `(用户, 后端)` 一个 docker 容器** —— 同一用户同一后端只会有一个
  runner，按需冷启。
- **空闲回收** —— 闲置超过用户可配的阈值后 `docker stop` + `rm`（真正
  销毁，不是 pause）。
- **冷启进度可视化** —— `/api/runners/<backend>/progress` SSE，前端渲染
  成进度条。
- **OpenAI 兼容** —— `POST /v1/chat/completions` 按 `model` 字段路由到
  对应 runner。
- **云端对话** —— 聊天和消息存在 router 的 sqlite 里；换设备登录历史还在。
- **上游 LLM key 三层模型** —— admin 在网页里保存的全局值（可一键共享给所有用户）+ 用户全局覆盖 + 用户对单个 backend 的覆盖，切换不需要重启 router。Router 不再从 `.env` / 进程 env 读上游凭证。
- **JWT cookie 认证**，可选邀请码注册和 bootstrap admin。
- **单 admin 不变量** —— 系统始终有且只有一个 admin（即 bootstrap 出来的那个）。UI/API 不允许创建第二个 admin，也不允许把唯一的 admin 删除/降级。
- **前端零构建** —— 原生 JS + nginx。

## 架构

```
浏览器
  └── frontend (nginx :18000)
        ├── 静态 SPA（登录、按 backend 分组的对话侧栏、聊天面板）
        └── 反代 /auth /api /v1 到 router
                                         │
                                         ▼
                              router (FastAPI :18080)
                              ├── users / runners / conversations / messages（sqlite）
                              ├── docker.from_env() 启停 backend 容器
                              ├── idle reaper（每 30s 一轮）
                              └── /v1 OpenAI 代理 → 按 `model` 路由
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  ▼                                              ▼
       openclaw-with-chromium                            nousresearch/hermes
       agstack-openclaw-<slug>                          agstack-hermes-<slug>
                  │                                              │
                  └────────────► OpenAI 兼容上游 LLM ◄───────────┘
                                  (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL，
                                   admin 在网页里维护；
                                   每个用户可自行覆盖)
```

## 目录结构

```
agent-stack/
  router/                    FastAPI 服务
  frontend/                  纯静态 SPA + nginx
  seeds/                     用户首启时拷贝到 per-user 家目录的种子配置
    openclaw-home/openclaw.json
    hermes-home/{config.yaml,.env}
  images/openclaw/           可选的 OpenClaw + Chromium 薄镜像层
  backends.json              backend 注册表
  docker-compose.yml
  .env.example
  docs/                      详细文档
```

## 快速上手

需要：Linux + Docker 24+，端口 `18000`、`18080` 空闲。Router 通过本机
`docker.sock` 启 backend 容器。

```bash
git clone https://github.com/JoursBleu/agent-stack.git
cd agent-stack

cp .env.example .env
# 编辑 .env：HOST_STACK_ROOT、JWT_SECRET、BOOTSTRAP_ADMIN_*
# router 不再从 .env 读 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL；它们由 bootstrap admin
# 首次登录后在网页 Settings → Backend API keys 里保存（见下方"配置上游 key"）

DATA=$(grep ^HOST_STACK_ROOT .env | cut -d= -f2)
mkdir -p "$DATA"
cp backends.json "$DATA"/
cp -r seeds "$DATA"/

# 准备 OpenClaw 镜像（见下面"OpenClaw 镜像"）
docker pull openclaw/openclaw:latest
# 或者 build 本仓库自带的 Chromium 加层：
#   cd images/openclaw && docker build -t openclaw-with-chromium:latest .

docker compose up -d --build
docker compose logs -f agent-stack-router
```

打开 `http://<host>:18000/`，用 bootstrap admin 登录。signup 在
`ALLOW_SIGNUP=true` 时也能用，但**注册出来的永远只能是普通 user**——系
统里始终只有一个 admin（即 bootstrap 出来的那个）。

### 配置上游 LLM key（首次聊天前必做）

router 不会从 `.env` 读上游凭证。bootstrap admin 登录后：

1. 点左下角 **齿轮图标** → *Backend API keys*。
2. 在 `LLM_BASE_URL` 卡片的 **全局** 一行填上 OpenAI 兼容的 base URL
   （比如 `https://api.openai.com/v1`），保存。
3. 在 `LLM_API_KEY` 卡片的 **全局** 一行填 key，保存。
4. 在 `LLM_MODEL` 卡片的 **全局** 一行填上游 model id（例如
   `gpt-5-mini`、`qwen3-72b-instruct`），保存。这就是 hermes / openclaw
   实际传给上游 `/v1/chat/completions` 的 `model` 字段。
5.（可选）打开三张卡片上的 **「把我的『全局』值共享给其他用户」** 开关，
   非 admin 用户不再需要自己填。开关关闭时，每个普通用户都必须自己在
   Settings 里填值。

等价 REST（admin 自己的 cookie）：

```bash
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"value":"https://api.openai.com/v1","backend":""}' \
     http://<host>:18000/api/me/env-overrides/LLM_BASE_URL
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"value":"sk-...","backend":""}' \
     http://<host>:18000/api/me/env-overrides/LLM_API_KEY
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"value":"gpt-5-mini","backend":""}' \
     http://<host>:18000/api/me/env-overrides/LLM_MODEL
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"shared":true}' \
     http://<host>:18000/api/admin/shared-env/LLM_BASE_URL
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"shared":true}' \
     http://<host>:18000/api/admin/shared-env/LLM_API_KEY
curl -s -X PUT -b /tmp/admin.jar -H 'Content-Type: application/json' \
     -d '{"shared":true}' \
     http://<host>:18000/api/admin/shared-env/LLM_MODEL
```

之后新建对话 → 选 backend → 第一条消息触发冷启（前端有进度条）→
后续消息复用热运行的 runner。

## 上游 LLM key —— admin 共享默认 + 用户级 / backend 级覆盖

每个 spawn 出来的 agent 容器都需要一个 OpenAI 兼容的上游
（`LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`）。对于每一组
`(用户, backend, 变量)`，router 按下面的优先级解析（**任何一项变化都
不需要重启 router**）：

1. **该用户对该 backend 的覆盖**（在设置里只针对一个 backend 填的值）。
2. **该用户的全局覆盖**（设置里"Global"那一栏，对所有 backend 生效）。
3. **admin 共享的默认值** —— 某个 admin 用户在自己的 *全局* 一栏里保存的值，
   **当且仅当** 这个变量的 "share with users" 开关被打开。Router **不会**
   再从 `.env` / 进程 env 里读上游 LLM 凭证，admin 直接在网页 Settings
   里维护共享值。
4. 否则该次 spawn 直接 `422` 拒绝，提示用户先在设置里填好。

由此得到的策略：

- **admin 共享开**：所有用户默认走 admin 在自己「全局」一栏里保存的值；任何用户都可以为自己
  覆盖（全局或仅某个 backend）。
- **admin 共享关**：每个用户都**必须**自己填值。
- 用户**不能把自己的值共享给别人** —— 只有 admin 能共享，且共享的就是 admin 自己「全局」那一栏的值。
- 一个用户可以保留一个全局默认值，**同时**给某一个 backend 单独配另一
  个上游（比如某个 backend 想用更强的账号）。

API：`/api/me/env-overrides`、`/api/admin/shared-env`。前端在"设置 →
Backend API keys"里，每个变量一张卡，列出"全局" + 所有用到该变量的
backend，并显示当前生效来源。

详情：[docs/per-user-env-overrides.md](docs/per-user-env-overrides.md)。

## OpenClaw 镜像

`backends.json[openclaw].image` 默认是 `openclaw-with-chromium:latest`。
你有两种方式来准备它。

### 方式 A —— 直接用上游 OpenClaw 镜像

如果不需要在容器内开真实浏览器，把 backend 改成上游 tag：

```jsonc
// backends.json
{ "image": "openclaw/openclaw:latest" }
```

```bash
docker pull openclaw/openclaw:latest
```

镜像 tag 和 build 矩阵见 [openclaw/openclaw](https://github.com/openclaw/openclaw)。

### 方式 B —— 用本仓库自带的 Chromium 加层

如果要让 OpenClaw 的 `browser` 插件驱动真实桌面 Chromium：

```bash
cd images/openclaw
docker build -t openclaw-with-chromium:latest .
```

加层只额外装了 `chromium`、CJK + emoji 字体、Chromium 依赖的运行时库、
`node` 用户的 `sudo`，以及一个可选的 `chromium-proxied` shell 包装脚本
（在设置了 `CHROMIUM_PROXY` 时把浏览器流量走 HTTP 代理）。**没有改任
何 OpenClaw 自己的代码。**

裁剪/调整说明见 [images/openclaw/README.md](images/openclaw/README.md)。

## 配置参考

主要 env 见 `.env.example`；`backends.json` schema 和 API 列表见
[英文 README](./README.md#configuration)。

## 文档

- [docs/hermes-integration.md](docs/hermes-integration.md) —— Hermes
  session 模型、CSRF/Origin 处理、容器生命周期、排错
- [docs/openclaw-multi-agent.md](docs/openclaw-multi-agent.md) ——
  OpenClaw 多 agent 在 agent-stack 里的形态
- [docs/per-user-env-overrides.md](docs/per-user-env-overrides.md) ——
  用户级 backend env 覆盖（含上游 LLM key）
- [images/openclaw/README.md](images/openclaw/README.md) —— 怎么 build
  / 裁剪 OpenClaw + Chromium 加层

## 安全须知

- 每个 runner 的 API key 是 `(user, backend)` 维度随机生成的，只在
  server 端持有，注入到容器 env，浏览器永远看不到。
- Router 通过 `docker.sock` 起容器 —— 把宿主机当作信任边界。**不要**
  把 `:18080` 直接暴露到不可信网络；前端会反代它，生产部署用
  nginx/Caddy 在前面 TLS，并把 `COOKIE_SECURE` 设为 `true`。
- `seeds/*/` 里只能写 `${ENV}` 占位符，**不要**把明文密钥提交进去。
- 对话内容在 `router.db` 里**未加密**存储。
- 用户级上游 key 在 `user_env_overrides` 里**明文存储**。如果威胁模型
  要求更强保护，请加密底层卷或外挂 KMS。

## License

[MIT](./LICENSE)
