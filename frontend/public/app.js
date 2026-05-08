// agent-stack frontend (ChatGPT-style)
//
// Single-file vanilla JS app:
//   - login / signup
//   - sidebar lists chats + running agents
//   - settings modal (theme + language); per-backend "Backend settings" drawer
//   - i18n: en (default) + zh

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// i18n
// ============================================================

const I18N = {
  en: {
    "auth.login": "Sign in",
    "auth.signup": "Sign up",
    "auth.email_ph": "Email",
    "auth.name_ph": "Name (optional)",
    "auth.password_ph": "Password (\u2265 8 chars)",
    "auth.invite_ph": "Invite code (if required)",
    "auth.submit_login": "Sign in",
    "auth.submit_signup": "Create account",

    "sidebar.new_chat": "New chat",
    "sidebar.pick_backend": "Pick a backend",
    "sidebar.chat_history": "Conversations",
    "sidebar.running_agents": "Running agents",
    "sidebar.settings": "Settings",
    "sidebar.logout": "Sign out",
    "sidebar.admin": "Users",
    "sidebar.no_runners": "No agents running",
    "sidebar.new_chat_default_title": "New chat",
    "sidebar.no_backends": "No backends configured",
    "sidebar.no_chats": "No conversations yet — pick an agent above",
    "sidebar.agents_label": "Agents",
    "sidebar.start_chat_with": "Start a new chat with {agent}",
    "sidebar.coming_soon": "coming soon",
    "sidebar.coming_soon_hint": "This backend isn't deployed yet.",

    "chat.empty_title": "Select a conversation or start a new one",
    "chat.composer_ph": "Send a message\u2026",
    "chat.composer_hint": "Enter to send \u00b7 Shift+Enter for newline",
    "chat.send": "Send",
    "chat.starting": "Starting\u2026",
    "chat.starting_backend": "Starting {backend}\u2026",
    "chat.message_count": "{n} messages",
    "chat.delete_confirm": "Delete this conversation?",
    "chat.create_failed": "Failed to create conversation: ",
    "chat.load_failed": "Load failed: ",
    "chat.request_failed": "Request failed: ",
    "chat.resend": "Resend (regenerate reply)",
    "chat.releases_in": "releases in {t}",
    "chat.confirm_stop_runner": "Stop {backend} now?",
    "chat.running": "running",
    "chat.idle": "idle",

    "settings.title": "Settings",
    "settings.theme": "Theme",
    "settings.theme_auto": "Follow system",
    "settings.theme_light": "Light",
    "settings.theme_dark": "Dark",
    "settings.language": "Language",
    "settings.api_keys_title": "Backend API keys",
    "settings.api_keys_hint": "Leave a field empty to use the shared default key. Saving a key restarts your runner so the new value takes effect on the next chat.",
    "settings.api_keys_placeholder_unset": "using shared default",
    "settings.api_keys_placeholder_set": "override saved (enter a new value to replace, or clear to remove)",
    "settings.api_keys_save": "Save",
    "settings.api_keys_clear": "Clear",
    "settings.api_keys_saved": "Saved.",
    "settings.api_keys_cleared": "Cleared.",
    "settings.api_keys_failed": "Failed: ",
    "settings.api_keys_for_backend": "For {backend}",
    "settings.api_keys_global_label": "Global (applies to all backends)",
    "settings.api_keys_backend_label": "Override for {backend}",
    "settings.api_keys_source_shared": "using admin-shared default",
    "settings.api_keys_source_global": "using your global override",
    "settings.api_keys_source_backend": "using your backend-specific override",
    "settings.api_keys_source_unset": "no value yet — set one below",
    "settings.api_keys_required_hint": "Admin has not shared a default for this variable. Set a value (global or per-backend) before chatting.",
    "settings.api_keys_admin_share_on": "✓ shared with users",
    "settings.api_keys_admin_share_off": "✗ private (each user sets their own)",
    "settings.api_keys_admin_toggle": "Share my Global value with other users",
    "settings.api_keys_admin_no_value": "Cannot share: save a Global value first.",
    "settings.api_keys_group_upstream": "Upstream LLM connection",
    "settings.api_keys_group_upstream_hint": "OpenAI-compatible base URL + API key + model id. All three apply together.",
    "settings.api_keys_field_base_url": "Base URL",
    "settings.api_keys_field_api_key": "API key",
    "settings.api_keys_field_model": "Model",
    "chat.config_required_title": "Configure your upstream LLM",
    "chat.config_required_msg": "Before starting a chat with {backend}, set Base URL, API key, and Model in Settings → Backend API keys (each user keeps their own values; admin can optionally share a default).",
    "chat.config_required_open": "Open settings",
    "chat.config_required_cancel": "Cancel",
    "settings.api_keys_save_row": "Save",
    "settings.api_keys_clear_row": "Clear all",
    "settings.api_keys_unchanged": "(unchanged)",
    "settings.api_keys_used_by": "Used by: {backends}",
    "settings.api_keys_per_backend_enable": "Use a different value for {backend}",
    "settings.api_keys_save": "Save",
    "settings.api_keys_clear": "Clear",

    "backend_settings.title": "Backend settings",
    "backend_settings.status": "Status",
    "backend_settings.idle_label": "Idle release (seconds)",
    "backend_settings.start": "Start",
    "backend_settings.restart": "Restart",
    "backend_settings.stop_now": "Stop now",
    "sidebar.pause": "Pause",
    "sidebar.start": "Start",
    "sidebar.delete_chat": "Delete chat",
    "backend_settings.save_idle": "Save idle",
    "backend_settings.action_failed": "Action failed: ",

    "admin.title": "User management",
    "admin.col_email": "Email",
    "admin.col_name": "Name",
    "admin.col_created": "Created",
    "admin.col_actions": "Actions",
    "admin.you_label": "(you)",
    "admin.admin_locked": "The admin account is permanent and cannot be deleted.",
    "admin.reset_pw": "Reset password",
    "admin.delete": "Delete",
    "admin.create_btn": "Create user",
    "admin.ph_email": "Email",
    "admin.ph_name": "Name (optional)",
    "admin.ph_password": "Initial password \u2265 6",
    "admin.confirm_delete": "Delete this user? Their conversations and running containers will be cleaned up.",
    "admin.ask_new_pw": "New password (\u2265 6 chars):",
    "admin.pw_too_short": "Password must be at least 6 characters.",
    "admin.pw_done": "Password reset.",
    "admin.load_failed": "Load failed: ",
    "admin.action_failed": "Action failed: ",

    "common.seconds": "{n}s",
    "common.minutes": "{n}m",
    "common.hours":   "{n}h",
  },
  zh: {
    "auth.login": "登录",
    "auth.signup": "注册",
    "auth.email_ph": "邮箱",
    "auth.name_ph": "昵称（可选）",
    "auth.password_ph": "密码（≥ 8 字符）",
    "auth.invite_ph": "邀请码（如启用）",
    "auth.submit_login": "登录",
    "auth.submit_signup": "注册并登录",

    "sidebar.new_chat": "新建对话",
    "sidebar.pick_backend": "选择后端",
    "sidebar.chat_history": "对话历史",
    "sidebar.running_agents": "运行中的 Agent",
    "sidebar.settings": "设置",
    "sidebar.logout": "退出",
    "sidebar.admin": "用户管理",
    "sidebar.no_runners": "暂无运行中的 agent",
    "sidebar.new_chat_default_title": "新对话",
    "sidebar.no_backends": "尚未配置任何后端",
    "sidebar.no_chats": "暂无对话——选上面一个 agent 开始",
    "sidebar.agents_label": "Agent列表",
    "sidebar.start_chat_with": "与 {agent} 开启新对话",
    "sidebar.coming_soon": "即将上线",
    "sidebar.coming_soon_hint": "该后端尚未部署。",

    "chat.empty_title": "选择或新建一个对话",
    "chat.composer_ph": "输入消息…",
    "chat.composer_hint": "Enter 发送 · Shift+Enter 换行",
    "chat.send": "发送",
    "chat.starting": "正在启动…",
    "chat.starting_backend": "正在启动 {backend}…",
    "chat.message_count": "{n} 条消息",
    "chat.delete_confirm": "删除这个对话？",
    "chat.create_failed": "创建对话失败：",
    "chat.load_failed": "加载失败：",
    "chat.request_failed": "请求失败：",
    "chat.releases_in": "{t} 后释放",
    "chat.confirm_stop_runner": "立即停止 {backend}？",
    "chat.running": "运行中",
    "chat.idle": "未启动",

    "settings.title": "设置",
    "settings.theme": "主题",
    "settings.theme_auto": "跟随系统",
    "settings.theme_light": "浅色",
    "settings.theme_dark": "深色",
    "settings.language": "语言",
    "settings.api_keys_title": "后端 API 密钥",
    "settings.api_keys_hint": "留空表示使用共享默认 key。保存后会重启你的 runner，新 key 在下次对话生效。",
    "settings.api_keys_placeholder_unset": "使用共享默认 key",
    "settings.api_keys_placeholder_set": "已保存自定义 key（输入新值替换，或留空清除）",
    "settings.api_keys_save": "保存",
    "settings.api_keys_clear": "清除",
    "settings.api_keys_saved": "已保存。",
    "settings.api_keys_cleared": "已清除。",
    "settings.api_keys_failed": "失败：",
    "settings.api_keys_for_backend": "用于 {backend}",
    "settings.api_keys_global_label": "全局（应用到所有后端）",
    "settings.api_keys_backend_label": "针对 {backend} 的覆盖",
    "settings.api_keys_source_shared": "正在使用管理员共享的默认值",
    "settings.api_keys_source_global": "正在使用你的全局覆盖",
    "settings.api_keys_source_backend": "正在使用你的后端级覆盖",
    "settings.api_keys_source_unset": "尚未设置——请在下方填写",
    "settings.api_keys_required_hint": "管理员未共享该变量的默认值，请先在全局或后端栏填值，再开始对话。",
    "settings.api_keys_admin_share_on": "✓ 已共享给所有用户",
    "settings.api_keys_admin_share_off": "✗ 私有（每个用户自行填写）",
    "settings.api_keys_admin_toggle": "把我的「全局」值共享给其他用户",
    "settings.api_keys_admin_no_value": "无法共享：请先在「全局」一栏保存一个值。",
    "settings.api_keys_group_upstream": "上游 LLM 连接",
    "settings.api_keys_group_upstream_hint": "OpenAI 兼容的 Base URL + API key + Model ID，三项一起使用。",
    "settings.api_keys_field_base_url": "Base URL",
    "settings.api_keys_field_api_key": "API key",
    "settings.api_keys_field_model": "Model",
    "chat.config_required_title": "请先配置上游 LLM",
    "chat.config_required_msg": "在和 {backend} 开新对话前，请在「设置 → Backend API keys」里填好 Base URL、API key 和 Model（每个用户独立保存；管理员也可以选择共享默认值）。",
    "chat.config_required_open": "打开设置",
    "chat.config_required_cancel": "取消",
    "settings.api_keys_save_row": "保存",
    "settings.api_keys_clear_row": "全部清除",
    "settings.api_keys_unchanged": "（不修改）",
    "settings.api_keys_used_by": "应用于：{backends}",
    "settings.api_keys_per_backend_enable": "为 {backend} 单独配置",

    "backend_settings.title": "后端设置",
    "backend_settings.status": "状态",
    "backend_settings.idle_label": "idle 释放（秒）",
    "backend_settings.start": "启动",
    "backend_settings.restart": "重启",
    "backend_settings.stop_now": "立即停止",
    "sidebar.pause": "暂停",
    "sidebar.start": "启动",
    "sidebar.delete_chat": "删除会话",
    "backend_settings.save_idle": "保存 idle",
    "backend_settings.action_failed": "操作失败：",

    "admin.title": "用户管理",
    "admin.col_email": "邮箱",
    "admin.col_name": "名称",
    "admin.col_created": "创建于",
    "admin.col_actions": "操作",
    "admin.you_label": "(你)",
    "admin.admin_locked": "admin 账号永久存在，无法删除。",
    "admin.reset_pw": "改密",
    "admin.delete": "删除",
    "admin.create_btn": "创建用户",
    "admin.ph_email": "邮箱",
    "admin.ph_name": "名称（可选）",
    "admin.ph_password": "初始密码 ≥ 6",
    "admin.confirm_delete": "删除该用户？其所有对话和运行中容器都将被清理。",
    "admin.ask_new_pw": "新密码（≥ 6 位）：",
    "admin.pw_too_short": "密码至少 6 位。",
    "admin.pw_done": "已重置密码。",
    "admin.load_failed": "加载失败：",
    "admin.action_failed": "操作失败：",

    "common.seconds": "{n}秒",
    "common.minutes": "{n}分",
    "common.hours":   "{n}时",
  },
};

function getLang() {
  try { return localStorage.getItem("ags.lang") || "en"; } catch { return "en"; }
}
function setLang(l) {
  try { localStorage.setItem("ags.lang", l); } catch {}
  document.documentElement.setAttribute("lang", l === "zh" ? "zh-CN" : "en");
  applyI18n();
}
function t(key, params) {
  const dict = I18N[getLang()] || I18N.en;
  let s = dict[key] ?? I18N.en[key] ?? key;
  if (params) for (const k in params) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), params[k]);
  return s;
}
function applyI18n() {
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  $$("[data-i18n-placeholder]").forEach(el => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"))); });
  $$("[data-i18n-title]").forEach(el => { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
  // dynamic re-renders that depend on language
  if (State.activeChatId) {
    const chat = State.chats.find(c => c.id === State.activeChatId);
    if (chat) {
      $("#chat-title").textContent = chat.title || t("sidebar.new_chat_default_title");
      $("#chat-meta").textContent = `${chat.model || chat.backend} \u00b7 ${t("chat.message_count", {n: chat.messages.length})}`;
    }
  } else {
    $("#chat-title").textContent = t("chat.empty_title");
  }
  renderChatList();
  renderRunners();
  // refresh auth submit text
  const submit = $("#auth-submit");
  if (submit) submit.textContent = State.authMode === "signup" ? t("auth.submit_signup") : t("auth.submit_login");
  // Re-render imperatively-built sections that contain translated text.
  const settingsModal = document.getElementById("app-settings-modal");
  if (settingsModal && !settingsModal.classList.contains("hidden")) {
    renderApiKeysSection();
  }
}

// ============================================================
// State + helpers
// ============================================================

const State = {
  user: null,
  backends: [],
  models: [],            // [{id, root, display_name, running}]
  runners: {},
  chats: [],
  activeChatId: null,
  authMode: "login",
  progressES: null,
  expandedBackends: new Set(),
};

async function api(method, path, body) {
  const opts = { method, credentials: "include", headers: {} };
  if (body !== undefined) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function fmtDuration(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return t("common.seconds", {n: s});
  if (s < 3600) return t("common.minutes", {n: Math.floor(s / 60)});
  return t("common.hours", {n: Math.floor(s / 3600)});
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// Theme
// ============================================================

function getTheme() { try { return localStorage.getItem("ags.theme") || "auto"; } catch { return "auto"; } }
function applyTheme(th) {
  if (th === "light" || th === "dark") document.documentElement.setAttribute("data-theme", th);
  else document.documentElement.removeAttribute("data-theme");
}
function setTheme(th) {
  try { localStorage.setItem("ags.theme", th); } catch {}
  applyTheme(th);
}
applyTheme(getTheme());

// ============================================================
// Auth view
// ============================================================

function showAuth(mode = "login") {
  State.authMode = mode;
  $("#auth-view").classList.remove("hidden");
  $("#app-view").classList.add("hidden");
  $$(".auth-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === mode));
  $$(".signup-only").forEach(el => el.classList.toggle("hidden", mode !== "signup"));
  $("#auth-submit").textContent = mode === "signup" ? t("auth.submit_signup") : t("auth.submit_login");
  $("#auth-error").textContent = "";
}

$$(".auth-tab").forEach(b => b.addEventListener("click", () => showAuth(b.dataset.tab)));

$("#auth-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#auth-error").textContent = "";
  const email    = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const name     = $("#auth-name").value.trim() || null;
  const invite   = $("#auth-invite").value.trim() || null;
  try {
    const r = State.authMode === "login"
      ? await api("POST", "/auth/login",  { email, password })
      : await api("POST", "/auth/signup", { email, password, name, invite_code: invite });
    State.user = r.user;
    await enterApp();
  } catch (e) { $("#auth-error").textContent = e.message; }
});

// ============================================================
// App lifecycle
// ============================================================

async function enterApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-display").textContent = State.user.email;
  $("#admin-btn").classList.toggle("hidden", State.user.role !== "admin");
  await loadChats();
  await refreshBackends();
  await refreshRunners();
  applyI18n();
  if (State.chats.length > 0) selectChat(State.chats[0].id);
  setInterval(refreshRunners, 5000);
}

$("#logout-btn").addEventListener("click", async () => {
  await api("POST", "/auth/logout").catch(() => {});
  State.user = null;
  showAuth("login");
});

// ============================================================
// Backends + runners
// ============================================================

async function refreshBackends() {
  const r = await api("GET", "/api/backends");
  State.backends = r.backends || [];
  // auto-expand every backend group so the per-backend "+ New chat" entry is
  // visible without an extra click on first load
  for (const b of State.backends) State.expandedBackends.add(b.name);
  await refreshModels();
  renderSidebar();
}

async function refreshModels() {
  try {
    const r = await api("GET", "/v1/models");
    State.models = (r.data || []).map(m => ({
      id: m.id,
      root: m.root || m.id,
      display_name: m.display_name || m.id,
      running: !!m.running,
    }));
  } catch { State.models = []; }
}

async function refreshRunners() {
  try {
    const r = await api("GET", "/api/runners");
    const map = {};
    (r.runners || []).forEach(rn => { map[rn.backend] = rn; });
    State.runners = map;
    renderSidebar();
  } catch {}
}

function renderSidebar() {
  const root = $("#backends-list");
  if (!root) return;
  root.innerHTML = "";
  if (!State.backends || State.backends.length === 0) {
    root.innerHTML = `<div class="sb-empty">${escapeHtml(t("sidebar.no_backends"))}</div>`;
    return;
  }
  // group chats by backend
  const chatsByBackend = {};
  for (const c of State.chats) {
    if (!chatsByBackend[c.backend]) chatsByBackend[c.backend] = [];
    chatsByBackend[c.backend].push(c);
  }
  for (const b of State.backends) {
    const runner  = State.runners[b.name];
    const running = !!runner;
    // collect agent variants for this backend (excluding the bare backend root id,
    // which duplicates the group header)
    const variants = (State.models || [])
      .filter(m => m.root === b.name && m.id !== b.name)
      .map(m => m.id);
    if (variants.length === 0) variants.push(b.name);

    const chats = (chatsByBackend[b.name] || []).sort((a, b2) => b2.updated_at - a.updated_at);

    const expanded = State.expandedBackends.has(b.name);
    const disabled = !!b.disabled;
    const group = document.createElement("div");
    group.className = "backend-group" + (running ? " running" : "") + (disabled ? " disabled" : "");
    group.innerHTML = `
      <div class="backend-head" data-toggle="${escapeHtml(b.name)}">
        <span class="caret">${expanded ? "▾" : "▸"}</span>
        <span class="dot ${running ? "on" : "off"}"></span>
        <span class="name">${escapeHtml(b.display_name || b.name)}</span>
        <span class="status">${escapeHtml(disabled ? t("sidebar.coming_soon") : (running ? t("chat.running") : t("chat.idle")))}</span>
        <span class="actions">
          ${(running && !disabled) ? `<button class="stop" data-backend="${escapeHtml(b.name)}" title="${escapeHtml(t("sidebar.pause"))}">×</button>` : ""}
          ${(!running && !disabled) ? `<button class="start" data-backend="${escapeHtml(b.name)}" title="${escapeHtml(t("sidebar.start"))}">▶</button>` : ""}
        </span>
      </div>
      ${expanded ? `
        <div class="backend-body">
          <div class="chats-block">
            ${disabled
              ? `<div class="sb-empty">${escapeHtml(t("sidebar.coming_soon_hint"))}</div>`
              : (variants.length > 1
                ? variants.map(modelId => {
                    const label = modelId === b.name
                      ? (b.display_name || b.name)
                      : modelId.split("/").slice(1).join("/");
                    return `<div class="chat-row new-chat-row" data-backend="${escapeHtml(b.name)}" data-model="${escapeHtml(modelId)}" title="${escapeHtml(t("sidebar.start_chat_with", {agent: label}))}">
                      <div class="title">+ ${escapeHtml(t("sidebar.new_chat"))} · ${escapeHtml(label)}</div>
                    </div>`;
                  }).join("")
                : `<div class="chat-row new-chat-row" data-backend="${escapeHtml(b.name)}" data-model="${escapeHtml(variants[0])}">
                    <div class="title">+ ${escapeHtml(t("sidebar.new_chat"))}</div>
                  </div>`)}
            ${chats.map(c => {
              const isActive = c.id === State.activeChatId;
              return `<div class="chat-row${isActive ? " active" : ""}" data-id="${escapeHtml(c.id)}">
                <div class="title">${escapeHtml(c.title || t("sidebar.new_chat_default_title"))}</div>
                <button class="chat-del" data-id="${escapeHtml(c.id)}" title="${escapeHtml(t("sidebar.delete_chat"))}">×</button>
              </div>`;
            }).join("")}
          </div>
          ${(running && !disabled) ? `<div class="releases-meta">${escapeHtml(t("chat.releases_in", {t: fmtDuration(runner.stops_in_seconds)}))}</div>` : ""}
        </div>
      ` : ""}
    `;
    root.appendChild(group);
  }
  // wire events
  root.querySelectorAll(".backend-head").forEach(h => {
    h.addEventListener("click", (ev) => {
      if (ev.target.closest(".actions")) return;
      const name = h.dataset.toggle;
      if (State.expandedBackends.has(name)) State.expandedBackends.delete(name);
      else State.expandedBackends.add(name);
      renderSidebar();
    });
  });
  root.querySelectorAll(".backend-head .stop").forEach(b => {
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const name = b.dataset.backend;
      if (!confirm(t("chat.confirm_stop_runner", {backend: name}))) return;
      try { await api("DELETE", `/api/runners/${name}`); }
      catch (e) { alert(e.message); return; }
      await refreshRunners();
    });
  });
  root.querySelectorAll(".backend-head .start").forEach(b => {
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const name = b.dataset.backend;
      try { await api("POST", `/api/runners/${name}/start`); }
      catch (e) { alert(e.message); return; }
      await refreshRunners();
    });
  });
  root.querySelectorAll(".agent-row").forEach(el => {
    el.addEventListener("click", () => {
      const backend = State.backends.find(x => x.name === el.dataset.backend);
      if (!backend) return;
      createChat(backend, el.dataset.model);
    });
  });
  root.querySelectorAll(".chat-row").forEach(row => {
    row.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("chat-del")) return;
      // "+ New chat" rows have no data-id; route to createChat instead
      if (row.classList.contains("new-chat-row")) {
        const backend = State.backends.find(x => x.name === row.dataset.backend);
        if (backend) createChat(backend, row.dataset.model);
        return;
      }
      selectChat(row.dataset.id);
    });
  });
  root.querySelectorAll(".chat-del").forEach(b => {
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = b.dataset.id;
      if (!confirm(t("chat.delete_confirm"))) return;
      try { await api("DELETE", `/api/conversations/${id}`); }
      catch (e) { alert(e.message); return; }
      State.chats = State.chats.filter(c => c.id !== id);
      if (State.activeChatId === id) {
        State.activeChatId = null;
        $("#messages").innerHTML = "";
        $("#chat-title").textContent = t("chat.empty_title");
        $("#chat-meta").textContent = "";
        $("#composer-input").disabled = true;
        $("#composer-send").disabled = true;
      }
      renderSidebar();
    });
  });
}

// Backwards-compat shims so existing call sites still work.
function renderRunners() { renderSidebar(); }
function renderChatList() { renderSidebar(); }

async function onRunnerAction(ev) {
  const backend = ev.currentTarget.dataset.backend;
  const action  = ev.currentTarget.dataset.action;
  if (action === "stop") {
    if (!confirm(t("chat.confirm_stop_runner", {backend}))) return;
    await api("DELETE", `/api/runners/${backend}`);
    await refreshRunners();
  } else if (action === "config") {
    showBackendSettings();
  }
}

// ============================================================
// Chat list
// ============================================================

async function loadChats() {
  try {
    const r = await api("GET", "/api/conversations");
    State.chats = (r.conversations || []).map(c => ({
      id: c.id, backend: c.backend, model: c.model,
      title: c.title || "",
      messages: [],
      messageCount: c.message_count || 0,
      updated_at: c.updated_at * 1000,
      loaded: false,
    }));
    // auto-expand any backend that has at least one chat
    for (const c of State.chats) State.expandedBackends.add(c.backend);
  } catch { State.chats = []; }
}

async function selectChat(id) {
  State.activeChatId = id;
  const chat = State.chats.find(c => c.id === id);
  renderChatList();
  if (!chat) { $("#model-picker").classList.add("hidden"); return; }
  if (!chat.loaded) {
    try {
      const r = await api("GET", `/api/conversations/${id}`);
      chat.messages = (r.messages || []).map(m => ({ id: m.id, role: m.role, content: m.content }));
      chat.title = r.conversation.title || chat.title;
      chat.loaded = true;
      chat.messageCount = chat.messages.length;
    } catch (e) {
      chat.messages = [{ role: "error", content: t("chat.load_failed") + e.message }];
    }
  }
  $("#chat-title").textContent = chat.title || t("sidebar.new_chat_default_title");
  $("#chat-meta").textContent = `${chat.model || chat.backend} \u00b7 ${t("chat.message_count", {n: chat.messages.length})}`;
  renderMessages(chat);
  $("#composer-input").disabled = false;
  $("#composer-send").disabled = false;
  $("#model-picker").classList.add("hidden");
  $("#composer-input").focus();
}

function renderMessages(chat) {
  const root = $("#messages");
  root.innerHTML = "";
  const backendDef = State.backends.find(b => b.name === chat.backend);
  const backendLabel = (backendDef?.display_name || chat.backend || "Agent").trim();
  const userLabel = (State.user?.name || State.user?.email || "User").trim();
  // index of the LAST user message — only that one gets a resend button by
  // default to keep the chat clean (matches ChatGPT-style edit-and-resubmit).
  let lastUserIdx = -1;
  chat.messages.forEach((m, i) => { if (m.role === "user") lastUserIdx = i; });
  for (let i = 0; i < chat.messages.length; i++) {
    const m = chat.messages[i];
    const el = document.createElement("div");
    el.className = "msg " + m.role;
    if (m.role === "assistant") el.dataset.backend = chat.backend || "";
    const av = document.createElement("div");
    av.className = "avatar";
    if (m.role === "user") {
      av.textContent = userLabel;
      av.classList.add("avatar-text");
      av.title = userLabel;
    } else if (m.role === "error") {
      av.textContent = "!";
    } else {
      av.textContent = backendLabel;
      av.classList.add("avatar-text");
      av.title = backendLabel;
    }
    const body = document.createElement("div");
    body.className = "body";
    if (m.role === "assistant" && !m.content) {
      el.classList.add("pending");
      body.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    } else {
      // Some backends (Hermes) prefix replies with "\n\n"; with pre-wrap that
      // shows as blank lines pushing the text below the pill. Trim leading
      // whitespace on assistant messages for display only.
      body.textContent = (m.role === "assistant") ? m.content.replace(/^\s+/, "") : m.content;
    }
    el.appendChild(av);
    el.appendChild(body);
    if (m.role === "user" && i === lastUserIdx) {
      const tools = document.createElement("div");
      tools.className = "msg-tools";
      const btn = document.createElement("button");
      btn.className = "msg-resend";
      btn.title = t("chat.resend");
      btn.textContent = "↻";
      btn.addEventListener("click", () => resendFromUserMessage(chat, i));
      tools.appendChild(btn);
      el.appendChild(tools);
    }
    root.appendChild(el);
  }
  // scroll wrap
  const wrap = $("#messages-wrap");
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

async function resendFromUserMessage(chat, idx) {
  const userMsg = chat.messages[idx];
  if (!userMsg || userMsg.role !== "user") return;
  // truncate locally to keep just up to and including this user message
  chat.messages = chat.messages.slice(0, idx + 1);
  renderMessages(chat);
  // best-effort server-side truncate (only works if we know the message id)
  if (userMsg.id) {
    try { await api("DELETE", `/api/conversations/${chat.id}/messages/after/${userMsg.id}`); }
    catch (e) { console.warn("server-side truncate failed", e); }
  }
  await requestAssistant(chat);
}

// ============================================================
// New chat
// ============================================================

// (Old top-of-sidebar "+ New chat" button removed — each backend now exposes
// its own "+ New chat" / agent picker inside its expandable group.)

function renderModelPicker() {
  const opts = $("#model-options");
  opts.innerHTML = "";
  for (const b of State.backends) {
    const running = !!State.runners[b.name];
    // collect agent variants whose `root` matches this backend, excluding the
    // bare backend id itself (e.g. "openclaw") since picking that means "default"
    // and we surface that as one of the sub-rows.
    const variants = State.models
      .filter(m => m.root === b.name && m.id !== b.name)
      .map(m => m.id);
    if (variants.length === 0) variants.push(b.name);

    // backend group header
    const grp = document.createElement("div");
    grp.className = "picker-title";
    grp.style.marginTop = "8px";
    grp.textContent = (b.display_name || b.name) + " " + (running ? "(" + t("chat.running") + ")" : "(" + t("chat.idle") + ")");
    opts.appendChild(grp);

    for (const modelId of variants) {
      const label = modelId === b.name ? (b.display_name || b.name) : modelId.split("/").slice(1).join("/");
      const el = document.createElement("div");
      el.className = "model-option";
      el.innerHTML = `<span>${escapeHtml(label)}</span><span class="badge ${running ? "running" : ""}">${escapeHtml(modelId)}</span>`;
      el.addEventListener("click", () => createChat(b, modelId));
      opts.appendChild(el);
    }
  }
}

function showConfigRequiredModal(backendName) {
  return new Promise((resolve) => {
    const modal  = document.getElementById("config-required-modal");
    const msgEl  = document.getElementById("config-required-msg");
    const okBtn  = document.getElementById("config-required-open");
    const noBtn  = document.getElementById("config-required-cancel");
    const xBtn   = document.getElementById("config-required-close");
    if (!modal || !msgEl || !okBtn || !noBtn || !xBtn) {
      // Fallback if HTML wasn't refreshed.
      resolve(confirm(t("chat.config_required_msg", { backend: backendName })));
      return;
    }
    msgEl.textContent = t("chat.config_required_msg", { backend: backendName });
    let done = false;
    const close = (val) => {
      if (done) return;
      done = true;
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      noBtn.removeEventListener("click", onNo);
      xBtn.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onOk = () => close(true);
    const onNo = () => close(false);
    const onBackdrop = (e) => { if (e.target === modal) close(false); };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    okBtn.addEventListener("click", onOk);
    noBtn.addEventListener("click", onNo);
    xBtn.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    modal.classList.remove("hidden");
    setTimeout(() => okBtn.focus(), 30);
  });
}

async function ensureUpstreamConfigured(backendName) {
  // Pre-flight: don't let a user start a new chat (or send the first
  // message after a hard reload) when LLM_BASE_URL / LLM_API_KEY /
  // LLM_MODEL still resolve to "unset" for this backend. Either the
  // admin hasn't shared a default and the user hasn't filled their own,
  // or one of three is missing. Returns true if config is OK.
  const REQUIRED = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"];
  let info;
  try {
    info = await api("GET", "/api/me/env-overrides");
  } catch (_) {
    return true;  // if env-overrides API itself failed, fall through and let spawn surface the real error
  }
  const eff = (info.effective || {})[backendName] || {};
  const missing = REQUIRED.filter((v) => {
    // var not declared user_overridable_env on this backend → not relevant
    if (!(v in eff)) return false;
    return (eff[v].source === "unset");
  });
  if (missing.length === 0) return true;
  // In-app modal (replaces the native confirm() which looked awful on mobile and zh).
  const open = await showConfigRequiredModal(backendName);
  if (open) {
    await openAppSettings();
    // Focus the first empty input in the upstream group so the user can
    // start typing right away.
    setTimeout(() => {
      const wrap = document.getElementById("setting-api-keys");
      if (!wrap) return;
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = wrap.querySelector('.api-key-input[data-backend=""]');
      if (first) first.focus();
    }, 50);
  }
  return false;
}

async function createChat(backend, modelId) {
  if (!(await ensureUpstreamConfigured(backend.name))) return;
  let r;
  try {
    r = await api("POST", "/api/conversations", { backend: backend.name, model: modelId || backend.name });
  } catch (e) { alert(t("chat.create_failed") + e.message); return; }
  const c = r.conversation;
  State.chats.unshift({
    id: c.id, backend: c.backend, model: c.model,
    title: c.title || "",
    messages: [],
    messageCount: 0,
    updated_at: c.updated_at * 1000,
    loaded: true,
  });
  selectChat(c.id);
}

// ============================================================
// Composer / sending
// ============================================================

const composerInput = $("#composer-input");

function autoGrowComposer() {
  composerInput.style.height = "auto";
  composerInput.style.height = Math.min(composerInput.scrollHeight, 240) + "px";
}
composerInput.addEventListener("input", autoGrowComposer);

$("#composer").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  await sendCurrent();
});

composerInput.addEventListener("keydown", (ev) => {
  // Ignore Enter while an IME (e.g. Chinese pinyin) is composing — that
  // Enter is being used to commit the candidate, not submit the message.
  if (ev.isComposing || ev.keyCode === 229) return;
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    sendCurrent();
  }
});

async function sendCurrent() {
  const chat = State.chats.find(c => c.id === State.activeChatId);
  if (!chat) return;
  const text = composerInput.value.trim();
  if (!text) return;
  composerInput.value = "";
  autoGrowComposer();

  const userMsg = { role: "user", content: text };
  chat.messages.push(userMsg);
  if (!chat.title) chat.title = text.slice(0, 60);
  chat.updated_at = Date.now();
  renderMessages(chat);
  renderChatList();

  try {
    const r = await api("POST", `/api/conversations/${chat.id}/messages`, { role: "user", content: text });
    if (r?.message?.id) userMsg.id = r.message.id;
  } catch (e) { console.warn("persist user msg failed", e); }

  await requestAssistant(chat);
}

async function requestAssistant(chat) {
  if (!State.runners[chat.backend]) startProgress(chat.backend);

  const placeholder = { role: "assistant", content: "" };
  chat.messages.push(placeholder);
  renderMessages(chat);

  try {
    const res = await fetch("/v1/chat/completions", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: chat.model,
        stream: true,
        // OpenClaw derives a stable session key from `user`; for backends that
        // ignore it this is harmless (it's a standard OpenAI field).
        user: "agstack-" + chat.id,
        messages: chat.messages.slice(0, -1)
          .filter(m => m.role !== "error")
          .map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new Error(`${res.status} ${detail}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { placeholder.content += delta; renderMessages(chat); }
        } catch {}
      }
    }
    refreshRunners();
    if (placeholder.content) {
      try {
        const r = await api("POST", `/api/conversations/${chat.id}/messages`, { role: "assistant", content: placeholder.content });
        if (r?.message?.id) placeholder.id = r.message.id;
      } catch (e) { console.warn("persist assistant msg failed", e); }
    }
  } catch (e) {
    chat.messages.push({ role: "error", content: t("chat.request_failed") + e.message });
    renderMessages(chat);
  } finally {
    stopProgress();
  }
}

// ============================================================
// Progress SSE
// ============================================================

function startProgress(backend) {
  stopProgress();
  // Progress bar UI was removed — keep the SSE alive only for refreshRunners()
  // side-effect on ready/error so the sidebar dot flips quickly.
  const es = new EventSource(`/api/runners/${backend}/progress`);
  State.progressES = es;
  es.onmessage = (ev) => {
    try {
      const e = JSON.parse(ev.data);
      if (e.stage === "ready" || e.stage === "error") {
        stopProgress();
        refreshRunners();
      }
    } catch {}
  };
  es.onerror = () => stopProgress();
}

function stopProgress() {
  if (State.progressES) { State.progressES.close(); State.progressES = null; }
}

// ============================================================
// Backend settings drawer (per-backend lifecycle)
// ============================================================

$("#settings-close").addEventListener("click", () => $("#settings-panel").classList.add("hidden"));

function showBackendSettings() {
  $("#settings-panel").classList.remove("hidden");
  const root = $("#settings-body");
  root.innerHTML = "";
  for (const b of State.backends) {
    const running = !!State.runners[b.name];
    const card = document.createElement("div");
    card.className = "backend-card";
    card.innerHTML = `
      <h3>${escapeHtml(b.display_name || b.name)}</h3>
      <div class="row">
        <span>${escapeHtml(t("backend_settings.status"))}</span>
        <span>${running ? "🟢 " + escapeHtml(t("chat.running")) : "⚪ " + escapeHtml(t("chat.idle"))}</span>
      </div>
      <div class="row">
        <span>${escapeHtml(t("backend_settings.idle_label"))}</span>
        <span><input type="number" min="60" max="21600" value="${b.idle_seconds}" data-backend="${b.name}" class="idle-input" /></span>
      </div>
      <div class="row">
        <button class="primary" data-action="start"     data-backend="${b.name}">${escapeHtml(running ? t("backend_settings.restart") : t("backend_settings.start"))}</button>
        <button class="danger"  data-action="stop"      data-backend="${b.name}" ${running ? "" : "disabled"}>${escapeHtml(t("backend_settings.stop_now"))}</button>
        <button                 data-action="save-idle" data-backend="${b.name}">${escapeHtml(t("backend_settings.save_idle"))}</button>
      </div>`;
    root.appendChild(card);
  }
  root.querySelectorAll("button").forEach(b => b.addEventListener("click", onBackendSettingsAction));
}

async function onBackendSettingsAction(ev) {
  const backend = ev.currentTarget.dataset.backend;
  const action  = ev.currentTarget.dataset.action;
  try {
    if (action === "start") {
      startProgress(backend);
      await api("POST", `/api/runners/${backend}/start`);
    } else if (action === "stop") {
      await api("DELETE", `/api/runners/${backend}`);
    } else if (action === "save-idle") {
      const v = parseInt(document.querySelector(`.idle-input[data-backend="${backend}"]`).value, 10);
      await api("PUT", `/api/runners/${backend}/idle`, { idle_seconds: v });
    }
    await refreshBackends();
    await refreshRunners();
    showBackendSettings();
  } catch (e) { alert(t("backend_settings.action_failed") + e.message); }
}

// ============================================================
// App settings modal (theme + language)
// ============================================================

function openAppSettings() {
  $("#setting-theme").value = getTheme();
  $("#setting-lang").value  = getLang();
  $("#app-settings-modal").classList.remove("hidden");
  renderApiKeysSection();
}
function closeAppSettings() {
  $("#app-settings-modal").classList.add("hidden");
}

async function renderApiKeysSection() {
  const wrap = $("#setting-api-keys");
  if (!wrap) return;
  let info;
  try {
    info = await api("GET", "/api/me/env-overrides");
  } catch (e) {
    wrap.innerHTML = `<div class="setting-row api-key-row"><span class="api-key-status">${escapeHtml(t("settings.api_keys_failed") + e.message)}</span></div>`;
    return;
  }
  const vars = info.vars || [];
  if (vars.length === 0) { wrap.innerHTML = ""; return; }
  const overrides = info.overrides || {};
  const effective = info.effective || {};
  const isAdmin = (State.user && State.user.role === "admin");
  let adminInfo = null;
  if (isAdmin) {
    try { adminInfo = await api("GET", "/api/admin/shared-env"); } catch {}
  }

  // Group related env vars so Base URL + API key appear together as one
  // "upstream connection" card instead of two disconnected cards.
  const GROUP_DEFS = [
    {
      id: "upstream",
      titleKey: "settings.api_keys_group_upstream",
      hintKey: "settings.api_keys_group_upstream_hint",
      members: [
        { env: "LLM_BASE_URL", labelKey: "settings.api_keys_field_base_url", type: "text" },
        { env: "LLM_API_KEY",  labelKey: "settings.api_keys_field_api_key",  type: "password" },
        { env: "LLM_MODEL",    labelKey: "settings.api_keys_field_model",    type: "text" },
      ],
    },
  ];
  const seen = new Set();
  const groups = [];
  for (const g of GROUP_DEFS) {
    const members = g.members.filter(m => vars.includes(m.env));
    if (members.length === 0) continue;
    members.forEach(m => seen.add(m.env));
    groups.push({ id: g.id, titleKey: g.titleKey, hintKey: g.hintKey, members });
  }
  for (const env of vars) {
    if (seen.has(env)) continue;
    groups.push({ id: env, titleKey: null, hintKey: null,
                  members: [{ env, labelKey: null, type: "password" }] });
  }

  const sourceLabel = (s) => {
    switch (s) {
      case "shared":  return t("settings.api_keys_source_shared");
      case "global":  return t("settings.api_keys_source_global");
      case "backend": return t("settings.api_keys_source_backend");
      default:        return t("settings.api_keys_source_unset");
    }
  };

  // For a group, "all backends that allow at least one of its members"
  const groupBackends = (g) => {
    const out = [];
    const seenB = new Set();
    for (const m of g.members) {
      for (const bn of (info.backends && info.backends[m.env]) || []) {
        if (!seenB.has(bn)) { seenB.add(bn); out.push(bn); }
      }
    }
    return out;
  };

  const blocks = groups.map((g) => {
    const backendsForGroup = groupBackends(g);
    const sharedNow = g.members.every(m => !!(info.admin_shared && info.admin_shared[m.env]));
    const sharedAny = g.members.some(m => !!(info.admin_shared && info.admin_shared[m.env]));
    const sharedPresent = g.members.every(m => !!(info.admin_shared_present && info.admin_shared_present[m.env]));
    const adminCanShare = isAdmin && (adminInfo
      ? g.members.every(m => !!(adminInfo.admin_has_value && adminInfo.admin_has_value[m.env]))
      : sharedPresent);

    const groupTitle = g.titleKey
      ? `<strong>${escapeHtml(t(g.titleKey))}</strong>`
      : `<code>${escapeHtml(g.members[0].env)}</code>`;
    const groupHint = g.hintKey
      ? `<span class="setting-hint">${escapeHtml(t(g.hintKey))}</span>`
      : "";
    const usedBy = backendsForGroup.length
      ? `<div class="setting-hint">${escapeHtml(t("settings.api_keys_used_by", { backends: backendsForGroup.map(bn => {
          const bd = (State.backends || []).find(b => b.name === bn);
          return (bd && bd.display_name) || bn;
        }).join(", ") }))}</div>`
      : "";

    const adminLine = isAdmin ? `
      <div class="setting-hint api-key-admin-line">
        <label>
          <input type="checkbox" data-action="admin-share-toggle" data-group="${escapeHtml(g.id)}" ${sharedNow ? "checked" : ""} ${adminCanShare ? "" : "disabled"} />
          ${escapeHtml(t("settings.api_keys_admin_toggle"))}
        </label>
        <span class="api-key-share-status">${sharedNow
          ? escapeHtml(t("settings.api_keys_admin_share_on"))
          : escapeHtml(t("settings.api_keys_admin_share_off"))}${adminCanShare ? "" : " · " + escapeHtml(t("settings.api_keys_admin_no_value"))}</span>
      </div>` : (sharedAny
        ? `<div class="setting-hint">${escapeHtml(t("settings.api_keys_admin_share_on"))}</div>`
        : `<div class="setting-hint api-key-warn">${escapeHtml(t("settings.api_keys_required_hint"))}</div>`);

    // Render one scope row (global or one backend) listing every member field.
    // For per-backend rows, the body is collapsed behind a checkbox unless
    // the user already has at least one override saved for that backend.
    const scopeRow = (backend, scopeLabel, opts) => {
      opts = opts || {};
      const fields = g.members.map((m) => {
        const bMasked = (overrides[backend] || {})[m.env] || "";
        const eff = backend === ""
          ? { source: bMasked ? "global" : "unset", masked: bMasked }
          : ((effective[backend] || {})[m.env] || { source: "unset", masked: "" });
        const fieldLabel = m.labelKey ? t(m.labelKey) : m.env;
        return `
          <div class="api-key-field">
            <label class="api-key-field-label">
              <span class="api-key-field-name">${escapeHtml(fieldLabel)}</span>
              <span class="setting-hint">${escapeHtml(sourceLabel(eff.source))}${eff.masked ? " · " : ""}${eff.masked ? `<code>${escapeHtml(eff.masked)}</code>` : ""}</span>
            </label>
            <input type="${m.type}" class="api-key-input"
                   data-env="${escapeHtml(m.env)}"
                   data-backend="${escapeHtml(backend)}"
                   data-group="${escapeHtml(g.id)}"
                   placeholder="${escapeHtml(bMasked ? t("settings.api_keys_unchanged") : t("settings.api_keys_placeholder_unset"))}"
                   autocomplete="new-password" />
          </div>`;
      }).join("");
      const hasAny = g.members.some(m => !!((overrides[backend] || {})[m.env]));

      const collapsible = !!opts.collapsible;
      const expanded = collapsible ? hasAny : true;
      const bodyHiddenAttr = (collapsible && !expanded) ? " hidden" : "";

      const header = collapsible ? `
          <label class="api-key-scope-header">
            <input type="checkbox"
                   data-action="toggle-scope"
                   data-group="${escapeHtml(g.id)}"
                   data-backend="${escapeHtml(backend)}"
                   ${expanded ? "checked" : ""} />
            <strong>${escapeHtml(scopeLabel)}</strong>
          </label>` : `
          <div class="api-key-scope-label">
            <strong>${escapeHtml(scopeLabel)}</strong>
          </div>`;

      return `
        <div class="api-key-scope-row${collapsible ? " collapsible" : ""}">
          ${header}
          <div class="api-key-scope-body"${bodyHiddenAttr}>
            <div class="api-key-fields">${fields}</div>
            <div class="api-key-actions">
              <button class="primary" data-action="save-api-key-group" data-group="${escapeHtml(g.id)}" data-backend="${escapeHtml(backend)}">${escapeHtml(t("settings.api_keys_save_row"))}</button>
              <button class="danger"  data-action="clear-api-key-group" data-group="${escapeHtml(g.id)}" data-backend="${escapeHtml(backend)}" ${hasAny ? "" : "disabled"}>${escapeHtml(t("settings.api_keys_clear_row"))}</button>
            </div>
            <div class="api-key-status" data-group-status="${escapeHtml(g.id)}::${escapeHtml(backend)}"></div>
          </div>
        </div>`;
    };

    const globalRow  = scopeRow("", t("settings.api_keys_global_label"));
    const backendRows = backendsForGroup.map(bn => {
      const bd = (State.backends || []).find(b => b.name === bn) || { display_name: bn };
      return scopeRow(bn, t("settings.api_keys_per_backend_enable", { backend: bd.display_name || bn }), { collapsible: true });
    }).join("");

    return `
      <div class="setting-row api-key-row" data-group="${escapeHtml(g.id)}">
        <div class="api-key-header">${groupTitle} ${groupHint}</div>
        ${usedBy}
        ${adminLine}
        ${globalRow}
        ${backendRows}
      </div>`;
  });

  wrap.innerHTML = blocks.join("");
  // Stash members map so handlers know what envs each group covers
  wrap._groups = Object.fromEntries(groups.map(g => [g.id, g.members.map(m => m.env)]));
  wrap.querySelectorAll('button[data-action="save-api-key-group"]').forEach((btn) => {
    btn.addEventListener("click", onSaveApiKeyGroup);
  });
  wrap.querySelectorAll('button[data-action="clear-api-key-group"]').forEach((btn) => {
    btn.addEventListener("click", onClearApiKeyGroup);
  });
  wrap.querySelectorAll('input[data-action="admin-share-toggle"]').forEach((cb) => {
    cb.addEventListener("change", onAdminShareToggle);
  });
  wrap.querySelectorAll('input[data-action="toggle-scope"]').forEach((cb) => {
    cb.addEventListener("change", (ev) => {
      const row = ev.currentTarget.closest(".api-key-scope-row");
      const body = row && row.querySelector(".api-key-scope-body");
      if (body) body.hidden = !ev.currentTarget.checked;
    });
  });
}

async function onSaveApiKeyGroup(ev) {
  const wrap = $("#setting-api-keys");
  const groupId = ev.currentTarget.dataset.group;
  const backend = ev.currentTarget.dataset.backend || "";
  const envs    = (wrap && wrap._groups && wrap._groups[groupId]) || [];
  const status  = document.querySelector(`[data-group-status="${groupId}::${backend}"]`);
  if (status) status.textContent = "";
  const dirty = [];
  for (const env of envs) {
    const inp = document.querySelector(`.api-key-input[data-env="${env}"][data-backend="${backend}"]`);
    const v = (inp?.value || "").trim();
    if (v) dirty.push({ env, value: v });
  }
  if (dirty.length === 0) {
    if (status) status.textContent = t("settings.api_keys_failed") + "(empty)";
    return;
  }
  try {
    for (const { env, value } of dirty) {
      await api("PUT", `/api/me/env-overrides/${encodeURIComponent(env)}`, { value, backend });
    }
    if (status) status.textContent = t("settings.api_keys_saved");
    await renderApiKeysSection();
    await refreshRunners();
  } catch (e) {
    if (status) status.textContent = t("settings.api_keys_failed") + e.message;
  }
}

async function onClearApiKeyGroup(ev) {
  const wrap = $("#setting-api-keys");
  const groupId = ev.currentTarget.dataset.group;
  const backend = ev.currentTarget.dataset.backend || "";
  const envs    = (wrap && wrap._groups && wrap._groups[groupId]) || [];
  const status  = document.querySelector(`[data-group-status="${groupId}::${backend}"]`);
  if (status) status.textContent = "";
  try {
    for (const env of envs) {
      const url = `/api/me/env-overrides/${encodeURIComponent(env)}` +
                  (backend ? `?backend=${encodeURIComponent(backend)}` : "");
      try { await api("DELETE", url); } catch (_) { /* ignore 404 if nothing to clear */ }
    }
    if (status) status.textContent = t("settings.api_keys_cleared");
    await renderApiKeysSection();
    await refreshRunners();
  } catch (e) {
    if (status) status.textContent = t("settings.api_keys_failed") + e.message;
  }
}

async function onAdminShareToggle(ev) {
  const wrap = $("#setting-api-keys");
  const groupId = ev.currentTarget.dataset.group;
  const envs = (wrap && wrap._groups && wrap._groups[groupId]) || [];
  const shared = !!ev.currentTarget.checked;
  try {
    for (const env of envs) {
      await api("PUT", `/api/admin/shared-env/${encodeURIComponent(env)}`, { shared });
    }
    await renderApiKeysSection();
    await refreshRunners();
  } catch (e) {
    alert(t("settings.api_keys_failed") + e.message);
    ev.currentTarget.checked = !shared;
  }
}
$("#settings-btn").addEventListener("click", openAppSettings);
$("#app-settings-close").addEventListener("click", closeAppSettings);
$("#app-settings-modal").addEventListener("click", (ev) => {
  if (ev.target.id === "app-settings-modal") closeAppSettings();
});
$("#setting-theme").addEventListener("change", (ev) => setTheme(ev.target.value));
$("#setting-lang").addEventListener("change",  (ev) => setLang(ev.target.value));

// ============================================================
// Admin
// ============================================================

async function openAdminModal() {
  $("#admin-modal").classList.remove("hidden");
  $("#admin-create-error").textContent = "";
  await refreshAdminUsers();
}
function closeAdminModal() { $("#admin-modal").classList.add("hidden"); }

async function refreshAdminUsers() {
  let users;
  try { users = (await api("GET", "/api/admin/users")).users; }
  catch (e) { $("#admin-create-error").textContent = t("admin.load_failed") + e.message; return; }
  const tbody = $("#admin-users-tbody");
  tbody.innerHTML = "";
  for (const u of users) {
    const tr = document.createElement("tr");
    const isSelf = State.user && u.id === State.user.id;
    const isAdminRow = u.role === "admin";
    const deleteDisabled = isSelf || isAdminRow;
    const deleteTitle = isAdminRow ? t("admin.admin_locked") : "";
    tr.innerHTML = `
      <td>${escapeHtml(u.email)}${isSelf ? ` <span style="color:var(--text-faint);font-size:11px">${escapeHtml(t("admin.you_label"))}</span>` : ""}</td>
      <td>${escapeHtml(u.name || "")}</td>
      <td style="color:var(--text-muted)">${fmtDate(u.created_at)}</td>
      <td>
        <button data-act="passwd" data-id="${u.id}">${escapeHtml(t("admin.reset_pw"))}</button>
        <button data-act="delete" data-id="${u.id}" class="danger" ${deleteDisabled ? "disabled" : ""} title="${escapeHtml(deleteTitle)}">${escapeHtml(t("admin.delete"))}</button>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button").forEach(b => b.addEventListener("click", onAdminUserAction));
}

async function onAdminUserAction(ev) {
  const btn = ev.currentTarget;
  const id  = btn.dataset.id;
  const act = btn.dataset.act;
  try {
    if (act === "passwd") {
      const pw = prompt(t("admin.ask_new_pw"));
      if (!pw) return;
      if (pw.length < 6) { alert(t("admin.pw_too_short")); return; }
      await api("PATCH", `/api/admin/users/${id}`, { password: pw });
      alert(t("admin.pw_done"));
    } else if (act === "delete") {
      if (!confirm(t("admin.confirm_delete"))) return;
      await api("DELETE", `/api/admin/users/${id}`);
    }
    await refreshAdminUsers();
  } catch (e) { alert(t("admin.action_failed") + e.message); }
}

$("#admin-btn").addEventListener("click", openAdminModal);
$("#admin-close").addEventListener("click", closeAdminModal);
$("#admin-modal").addEventListener("click", (ev) => {
  if (ev.target.id === "admin-modal") closeAdminModal();
});

$("#admin-create-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget;
  $("#admin-create-error").textContent = "";
  const body = {
    email: f.email.value.trim(),
    name:  f.name.value.trim() || null,
    password: f.password.value,
    role: "user",  // invariant: only one admin (the bootstrap one); UI only creates regular users
  };
  try {
    await api("POST", "/api/admin/users", body);
    f.reset();
    await refreshAdminUsers();
  } catch (e) { $("#admin-create-error").textContent = e.message; }
});

// ============================================================
// Bootstrap
// ============================================================

// Apply i18n at load (auth view is shown before app view)
applyI18n();

(async function bootstrap() {
  try {
    const r = await api("GET", "/auth/me");
    State.user = r.user;
    await enterApp();
  } catch {
    showAuth("login");
  }
})();
