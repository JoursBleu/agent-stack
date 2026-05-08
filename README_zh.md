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

# 1. 配置 .env。JWT_SECRET 和 BOOTSTRAP_ADMIN_PASSWORD 仍是 CHANGE_ME 占位时
#    router 会拒绝启动。
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" .env
$EDITOR .env  # 改 BOOTSTRAP_ADMIN_EMAIL / _PASSWORD；HOST_STACK_ROOT 必须
              # 是绝对路径（默认 /var/lib/agent-stack）

# 2. 创建数据目录。只需要 mkdir；backends.json 和 seeds/ 由 docker compose
#    从仓库直接 bind-mount 进 router 容器，所以 git pull 之后无需手动 cp。
DATA=$(grep ^HOST_STACK_ROOT .env | cut -d= -f2)
sudo mkdir -p "$DATA" && sudo chown $USER "$DATA"

# 3. 拉 OpenClaw 后端镜像。docker compose 只 build router/frontend，**不会**
#    自动拉后端镜像，第一次必须手动拉。
docker pull ghcr.io/openclaw/openclaw:latest
# 或 build 本仓库带桌面 Chromium 的加层：
#   cd images/openclaw && docker build -t openclaw-with-chromium:latest .

# 4. 启动 router + frontend。
docker compose up -d --build
docker compose logs -f router

# 5. Smoke check：应输出 {"ok":true}
curl -fsS http://127.0.0.1:18080/healthz
```

> **同机多 checkout？** `docker-compose.yml` 顶层固定了
> `name: ${COMPOSE_PROJECT_NAME:-agent-stack}`，因此**默认情况下不管
> checkout 在哪个目录，都属于同一个 compose project**，在 checkout B
> 跑 `compose up` 会静默地把 checkout A 的容器按 B 的配置重建。要
> 同机并排跑第二份实例，**必须**在 checkout B 的 `.env` 里设一个不
> 同的 project name，例如 `COMPOSE_PROJECT_NAME=agent-stack-staging`；
> 同时 `HOST_STACK_ROOT` 必须是不同的绝对路径，`ROUTER_PORT` /
> `FRONTEND_PORT` / `BACKEND_PORT_START..END` 不能重叠。仅靠目录改名
> 是不够的 —— 两个都叫 `agent-stack/` 的克隆会冲突。

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

### 升级

```bash
cd agent-stack
git pull
docker compose up -d --build
```

`backends.json` 和 `seeds/` 是从 git checkout 直接 bind-mount 进容器
的，所以 `git pull` 之后立刻生效，不需要再手动 cp。已经在跑的 per-user
容器会继续用之前渲染好的 seed；新拉起的容器（停掉旧的或被 reaper
回收以后）会用新 seed。`$HOST_STACK_ROOT/users/` 下的用户状态和
`$HOST_STACK_ROOT/router.db` 在 rebuild 时不会丢。


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

## 添加新 backend

1. 在 `seeds/<seed_subdir>/` 下放该 backend 的 per-user 模板（`${ENV_VAR}`
   占位会在 `ensure()` 时按 router env / 用户 override 渲染，前提是该
   文件列在 `templated_files` 里）。
2. 在 `backends.json` 里加 backend 条目（schema 见英文 README）。
3. **重启 `agent-stack-router`** 让它重读 `backends.json`：router 不会
   热加载 `backends.json`，`image` / `extra_networks` / `extra_env` /
   `templated_files` 都是启动时读一次。改完跑
   `docker compose restart agent-stack-router`，新 backend 才会出现在
   `/api/backends` 和 SPA 模型选择器里。

### Sidecar 示例：backend 调同机的 LLM proxy 容器

如果 `LLM_BASE_URL` 指向同 docker host 的另一个容器（比如
`openai-compat-proxy`，挂在自己的 bridge 网络上），spawn 出来的
per-user runner 必须加入那张网络。`network_mode: host` 只用在
router/frontend，**不影响 backend runner**。

```jsonc
// backends.json
{
  "name": "openclaw",
  "image": "ghcr.io/openclaw/openclaw:latest",
  "extra_networks": ["my-llm-proxy_default"],
  "extra_env": {
    "LLM_BASE_URL": "http://openai-compat-proxy:8080/v1"
  }
}
```

router 会把 runner 接进 `my-llm-proxy_default`，runner 内
`getent hosts openai-compat-proxy` 才能解析。**不配 `extra_networks`
时所有 runner 都落在默认 `bridge` 网络，sidecar 名字解析不到，只有公网
endpoint 能用。**

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


## 调上游模型清单

seed 文件里 `${LLM_MODEL}` 占位只声明了一个上游模型。要暴露多个：

- OpenClaw：编辑 [seeds/openclaw-home/openclaw.json](seeds/openclaw-home/openclaw.json)
  的 `models.providers.upstream.models[]`。
- Hermes：[seeds/hermes-home/config.yaml](seeds/hermes-home/config.yaml)
  里每个 sub-component（vision/web_extract/compression/...）都是一个
  `${LLM_MODEL}`，可分别替换成任意字面 id 或别的 env 占位。

改完 `git pull && docker compose up -d` 推到 router 容器，但**已经在
跑的 per-user runner 仍用旧 seed**。要让它生效，停掉这个 runner 让它
重 spawn（见下节）。

## 配置变更后回收 runner

在 UI 里改 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` 立即写 DB，
但已经在跑的容器是用旧值渲染的 seed 启动的。router 只在新建 runner
时才重新渲染 `templated_files`，所以要主动回收：

```bash
BASE=http://127.0.0.1:18000
curl -s -X DELETE -b $JAR $BASE/api/runners/openclaw
curl -s -X POST   -b $JAR $BASE/api/runners/openclaw/start
```

或等 idle reaper（`DEFAULT_IDLE_SECONDS`，默认 600s）回收。

## 排错

| 现象 | 多半的原因 | 怎么看 |
|---|---|---|
| `pull access denied for openclaw/openclaw` | 走错 registry，应在 GHCR | `docker pull ghcr.io/openclaw/openclaw:latest` |
| spawn 几秒后报 `runner not ready: Connection refused` | 后端容器启动失败（seed 字段不匹配镜像版本 / 镜像没拉 / OOM 等） | `docker logs agstack-<backend>-<user-slug>` |
| spawn 成功，但 `/v1/chat/completions` 返回 404/400 | `${LLM_MODEL}` 不是上游真支持的 id | `curl -H 'Authorization: Bearer $LLM_API_KEY' $LLM_BASE_URL/models` 后到 *Settings → Backend API keys* 改值 |
| 多 checkout 互相覆盖容器 | 两个 checkout 的 compose project name 撞了 | 在第二个 checkout 的 `.env` 里加 `COMPOSE_PROJECT_NAME=agent-stack-<别名>` |
| router 启动报 `JWT_SECRET looks like the placeholder` | `.env` 还是 `CHANGE_ME_TO_RANDOM_HEX` | `sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" .env` |
| 第一次 `POST /api/runners/<backend>/start` 90s 后报 `runner not ready` | `docker compose up` 不会自动 pull backend 镜像（不是 compose service），首次 1-2 GB 镜像拉取超过 `BACKEND_STARTUP_TIMEOUT` | `docker pull` 把 `backends.json` 里所有 image 先拉一遍；或者 `.env` 里设 `BACKEND_PREPULL_AT_STARTUP=true` 让 router 启动时预拉 |
| Backend runner 跑起来了但访问不到 `LLM_BASE_URL` | runner 默认在 `bridge` 网络，同机 sidecar 容器只在用户自定义网络里能按容器名解析 | 把 sidecar 的 docker network 名加到 `backends.json` 的 `extra_networks`（见上面 sidecar 示例），重启 router |
| backend 容器已经退出，SPA 还显示 running | 状态由 idle reaper 刷新（`REAPER_INTERVAL_SECONDS`，默认 30s） | 等 ≤30s，或 `curl -X DELETE /api/runners/<backend>` 强制清掉 |

## 备份 vs 重置

`router.db` 是 sqlite + WAL，运行时盘上还有 `router.db-wal` /
`router.db-shm` 两个文件存放未 checkpoint 的事务。**不要**只拷
`router.db`：要么 `docker compose stop agent-stack-router` 之后再拷，
要么用：

```bash
sqlite3 "$HOST_STACK_ROOT/router.db" ".backup /tmp/router-$(date +%F).db"
```

完全清掉用下面的"卸载 / 重置"。

## 卸载 / 重置

```bash
cd agent-stack
docker compose down                 # 停 router + frontend
# router 动态拉起的 per-user 后端容器不在 compose 里，单独清掉：
docker ps -a --filter name=agstack- --format '{{.Names}}' | xargs -r docker rm -f
# 抹掉所有持久化状态（用户、DB、per-user home）—— 不可逆
sudo rm -rf "$(grep ^HOST_STACK_ROOT .env | cut -d= -f2)"
# 视情况清掉 router/frontend 镜像：
docker image rm agent-stack-router:latest agent-stack-frontend:latest
```
