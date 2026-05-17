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
    "sidebar.new_agent": "+ New agent",
    "sidebar.new_agent_remaining": "+ New agent ({n} left)",
    "sidebar.max_agents_reached": "Max {n} agents per backend",
    "sidebar.agent_rename": "Rename agent",
    "sidebar.agent_edit_model": "Edit model override",
    "sidebar.agent_delete": "Delete agent",
    "sidebar.agent_actions": "Agent actions",
    "agent.create_title": "Create a new agent",
    "agent.create_backend": "Backend",
    "agent.create_name": "Name",
    "agent.create_model": "Model (optional)",
    "agent.create_model_hint": "Leave blank to use backend default.",
    "agent.create_submit": "Create",
    "agent.create_cancel": "Cancel",
    "agent.create_failed": "Create failed: ",
    "agent.rename_prompt": "New name for this agent:",
    "agent.edit_model_prompt": "Model override (leave blank to clear):",
    "agent.delete_confirm": "Delete agent \"{name}\"?\n\nThis will also delete {n} conversation(s) and stop its runner.",
    "agent.delete_failed": "Delete failed: ",
    "agent.no_agents_hint": "No agents yet for this backend.",
    "agent.ordinal_badge": "#{n}",

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
    "settings.idle_title": "Idle release per backend",
    "settings.idle_hint": "Containers are stopped after this many seconds of inactivity (60 – 21600). Saved per backend, per user.",
    "settings.idle_unit": "seconds",
    "settings.idle_save": "Save",
    "settings.idle_saved": "Saved",
    "settings.idle_save_failed": "Save failed: ",
    "settings.idle_disable": "Disable timeout",
    "settings.idle_disabled_note": "(never auto-stops)",
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
    "sidebar.rename_chat": "Rename chat",
    "chat.rename_prompt": "New name for this chat:",
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
    "sidebar.new_agent": "+ 新建 Agent",
    "sidebar.new_agent_remaining": "+ 新建 Agent（还剩 {n} 个名额）",
    "sidebar.max_agents_reached": "每个后端最多 {n} 个 Agent",
    "sidebar.agent_rename": "重命名 Agent",
    "sidebar.agent_edit_model": "修改模型覆盖",
    "sidebar.agent_delete": "删除 Agent",
    "sidebar.agent_actions": "Agent 操作",
    "agent.create_title": "新建 Agent",
    "agent.create_backend": "后端",
    "agent.create_name": "名称",
    "agent.create_model": "模型（可选）",
    "agent.create_model_hint": "留空使用后端默认。",
    "agent.create_submit": "创建",
    "agent.create_cancel": "取消",
    "agent.create_failed": "创建失败：",
    "agent.rename_prompt": "新的 Agent 名称：",
    "agent.edit_model_prompt": "模型覆盖（留空清除）：",
    "agent.delete_confirm": "删除 Agent “{name}”？\n\n这将同时删除 {n} 条对话并停止它的运行容器。",
    "agent.delete_failed": "删除失败：",
    "agent.no_agents_hint": "此后端尚未创建任何 Agent。",
    "agent.ordinal_badge": "#{n}",

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
    "settings.idle_title": "各后端 idle 释放时间",
    "settings.idle_hint": "容器在指定秒数未活动后会被回收（60 – 21600）。按 backend 单独保存。",
    "settings.idle_unit": "秒",
    "settings.idle_save": "保存",
    "settings.idle_saved": "已保存",
    "settings.idle_save_failed": "保存失败：",
    "settings.idle_disable": "关闭超时",
    "settings.idle_disabled_note": "（不会自动停止）",
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
    "sidebar.rename_chat": "重命名会话",
    "chat.rename_prompt": "输入新的会话名称：",
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
    renderIdleSection();
  }
}

// ============================================================
// State + helpers
// ============================================================

const State = {
  user: null,
  backends: [],
  models: [],            // [{id, root, display_name, running}]
  runners: {},          // keyed by agent_id when present, else legacy backend
  chats: [],
  activeChatId: null,
  authMode: "login",
  progressES: null,
  convES: null,
  convESChatId: null,
  expandedBackends: new Set(),
  agents: [],            // [{id, user_id, backend, name, model, ordinal, running, runner, ...}]
  expandedAgents: new Set(),
  maxAgentsPerBackend: 3,
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
// Client-side chat router
// ============================================================
//
// Each chat owns a permalink of the form `/<user-slug>/<backend>/chat_<seq>`,
// where `seq` is the 1-based rank of the chat within (user, backend) ordered
// by creation time (assigned server-side). nginx is configured with
// `try_files $uri /index.html` so any non-API path serves the SPA, which then
// resolves the path here.

function chatUrlFor(chat) {
  if (!chat) return "/";
  const slug = State.user && State.user.slug;
  if (!slug || !chat.backend || !chat.seq) return "/";
  return `/${encodeURIComponent(slug)}/${encodeURIComponent(chat.backend)}/chat_${chat.seq}`;
}

function syncChatUrl(chat) {
  const url = chatUrlFor(chat);
  if (!url) return;
  if (window.location.pathname === url) return;
  try { history.pushState({ chatId: chat ? chat.id : null }, "", url); } catch {}
}

function parseChatPath(pathname) {
  // Match /<slug>/<backend>/chat_<seq>
  const m = pathname.match(/^\/([^/]+)\/([^/]+)\/chat_(\d+)\/?$/);
  if (!m) return null;
  return {
    slug:    decodeURIComponent(m[1]),
    backend: decodeURIComponent(m[2]),
    seq:     parseInt(m[3], 10),
  };
}

async function routeFromLocation() {
  const parsed = parseChatPath(window.location.pathname);
  if (!parsed) return false;
  // Only honor URLs that match the signed-in user's slug; if a different
  // slug is in the URL we ignore it and fall back to the default chat.
  if (!State.user || parsed.slug !== State.user.slug) return false;
  let chat = State.chats.find(c =>
    c.backend === parsed.backend && c.seq === parsed.seq
  );
  if (!chat) {
    // Not in our cached list — try resolving via the by-slug endpoint.
    // This handles deep links to a chat that for some reason isn't in
    // `State.chats` yet (e.g. fresh tab, but chat list trimmed elsewhere).
    try {
      const r = await api(
        "GET",
        `/api/conversations/by-slug/${encodeURIComponent(parsed.backend)}/${parsed.seq}`,
      );
      const c = r.conversation;
      if (c) {
        chat = {
          id: c.id, backend: c.backend, model: c.model,
          agentId: c.agent_id || "",
          seq: c.seq || parsed.seq,
          title: c.title || "",
          messages: (r.messages || []).map(m => ({ id: m.id, role: m.role, content: m.content })),
          messageCount: (r.messages || []).length,
          updated_at: c.updated_at * 1000,
          loaded: true,
        };
        State.chats.unshift(chat);
        State.expandedBackends.add(chat.backend);
        if (chat.agentId) State.expandedAgents.add(chat.agentId);
      }
    } catch {}
  }
  if (!chat) return false;
  await selectChat(chat.id, { pushUrl: false });
  return true;
}

function installChatRouter() {
  if (window.__agstackRouterInstalled) return;
  window.__agstackRouterInstalled = true;
  window.addEventListener("popstate", () => { routeFromLocation(); });
}

// ============================================================
// App lifecycle
// ============================================================

async function enterApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-display").textContent = State.user.email;
  $("#admin-btn").classList.toggle("hidden", State.user.role !== "admin");
  await loadAgents();
  await loadChats();
  await refreshBackends();
  await refreshRunners();
  applyI18n();
  installChatRouter();
  const routed = await routeFromLocation();
  if (!routed && State.chats.length > 0) selectChat(State.chats[0].id);
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
  // keep agents in sync with the runner table (running flag, host_port, etc.)
  await loadAgents();
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
  // index: agents by backend; chats by agentId
  const agentsByBackend = {};
  for (const a of State.agents) (agentsByBackend[a.backend] = agentsByBackend[a.backend] || []).push(a);
  for (const k of Object.keys(agentsByBackend)) agentsByBackend[k].sort((x, y) => x.ordinal - y.ordinal);
  const chatsByAgent = {};
  for (const c of State.chats) (chatsByAgent[c.agentId] = chatsByAgent[c.agentId] || []).push(c);
  const max = State.maxAgentsPerBackend || 3;

  for (const b of State.backends) {
    const disabled = !!b.disabled;
    const bAgents = agentsByBackend[b.name] || [];
    const anyRunning = bAgents.some(a => a.running);
    const expanded = State.expandedBackends.has(b.name);
    const group = document.createElement("div");
    group.className = "backend-group" + (anyRunning ? " running" : "") + (disabled ? " disabled" : "");

    const remaining = Math.max(0, max - bAgents.length);
    const newAgentHtml = (disabled || remaining === 0) ? "" :
      `<div class="agent-create-row" data-backend="${escapeHtml(b.name)}">
         <div class="title">${escapeHtml(t("sidebar.new_agent_remaining", {n: remaining}))}</div>
       </div>`;

    group.innerHTML = `
      <div class="backend-head" data-toggle="${escapeHtml(b.name)}">
        <span class="caret">${expanded ? "▾" : "▸"}</span>
        <span class="dot ${anyRunning ? "on" : "off"}"></span>
        <span class="name">${escapeHtml(b.display_name || b.name)}</span>
        <span class="status">${escapeHtml(disabled ? t("sidebar.coming_soon") : (anyRunning ? t("chat.running") : t("chat.idle")))}</span>
      </div>
      ${expanded ? `
        <div class="backend-body">
          ${disabled ? `<div class="sb-empty">${escapeHtml(t("sidebar.coming_soon_hint"))}</div>` : ""}
          ${(!disabled && bAgents.length === 0) ? `<div class="sb-empty">${escapeHtml(t("agent.no_agents_hint"))}</div>` : ""}
          ${bAgents.map(a => renderAgentBlock(a, chatsByAgent[a.id] || [], b)).join("")}
          ${newAgentHtml}
        </div>
      ` : ""}
    `;
    root.appendChild(group);
  }

  wireSidebarEvents(root);
}

function renderAgentBlock(agent, chats, backend) {
  chats = chats.slice().sort((a, b) => b.updated_at - a.updated_at);
  const expanded = State.expandedAgents.has(agent.id) || chats.some(c => c.id === State.activeChatId);
  const runner = agent.runner;
  const newChatLabel = t("sidebar.new_chat");
  const stopBtn = agent.running ? `<button class="agent-stop" data-agent="${escapeHtml(agent.id)}" title="${escapeHtml(t("sidebar.pause"))}" aria-label="${escapeHtml(t("sidebar.pause"))}">⏸</button>` : "";
  const startBtn = (!agent.running && !backend.disabled) ? `<button class="agent-start" data-agent="${escapeHtml(agent.id)}" title="${escapeHtml(t("sidebar.start"))}">▶</button>` : "";
  return `
    <div class="agent-group ${agent.running ? "running" : ""}">
      <div class="agent-head" data-agent-toggle="${escapeHtml(agent.id)}">
        <span class="caret">${expanded ? "▾" : "▸"}</span>
        <span class="dot ${agent.running ? "on" : "off"}"></span>
        <span class="name">${escapeHtml(agent.name)}</span>
        <span class="ordinal" title="${escapeHtml(t("agent.ordinal_badge", {n: agent.ordinal}))}">${escapeHtml(t("agent.ordinal_badge", {n: agent.ordinal}))}</span>
        <span class="agent-actions">
          ${startBtn}${stopBtn}
          <button class="agent-rename" data-agent="${escapeHtml(agent.id)}" title="${escapeHtml(t("sidebar.agent_rename"))}">✎</button>
          <button class="agent-edit-model" data-agent="${escapeHtml(agent.id)}" title="${escapeHtml(t("sidebar.agent_edit_model"))}">⚙</button>
          <button class="agent-del" data-agent="${escapeHtml(agent.id)}" data-name="${escapeHtml(agent.name)}" data-count="${chats.length}" title="${escapeHtml(t("sidebar.agent_delete"))}">×</button>
        </span>
      </div>
      ${expanded ? `
        <div class="agent-body">
          <div class="chats-block">
            <div class="chat-row new-chat-row" data-agent="${escapeHtml(agent.id)}">
              <div class="title">+ ${escapeHtml(newChatLabel)}</div>
            </div>
            ${chats.map(c => {
              const isActive = c.id === State.activeChatId;
              return `<div class="chat-row${isActive ? " active" : ""}" data-id="${escapeHtml(c.id)}">
                <div class="title">${escapeHtml(c.title || t("sidebar.new_chat_default_title"))}</div>
                <button class="chat-rename" data-id="${escapeHtml(c.id)}" title="${escapeHtml(t("sidebar.rename_chat"))}">✎</button>
                <button class="chat-del" data-id="${escapeHtml(c.id)}" title="${escapeHtml(t("sidebar.delete_chat"))}">×</button>
              </div>`;
            }).join("")}
          </div>
          ${(agent.running && runner && typeof runner.stops_in_seconds === "number") ? `<div class="releases-meta">${escapeHtml(t("chat.releases_in", {t: fmtDuration(runner.stops_in_seconds)}))}</div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function wireSidebarEvents(root) {
  root.querySelectorAll(".backend-head").forEach(h => {
    h.addEventListener("click", (ev) => {
      const name = h.dataset.toggle;
      if (State.expandedBackends.has(name)) State.expandedBackends.delete(name);
      else State.expandedBackends.add(name);
      renderSidebar();
    });
  });
  root.querySelectorAll(".agent-head").forEach(h => {
    h.addEventListener("click", (ev) => {
      if (ev.target.closest(".agent-actions")) return;
      const id = h.dataset.agentToggle;
      if (State.expandedAgents.has(id)) State.expandedAgents.delete(id);
      else State.expandedAgents.add(id);
      renderSidebar();
    });
  });
  root.querySelectorAll(".agent-create-row").forEach(el => {
    el.addEventListener("click", () => promptCreateAgent(el.dataset.backend));
  });
  root.querySelectorAll(".agent-start").forEach(b => {
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const agent = State.agents.find(a => a.id === b.dataset.agent);
      if (!agent) return;
      try { await api("POST", `/api/agents/${agent.id}/start`); }
      catch (e) { alert(e.message); return; }
      await refreshRunners();
    });
  });
  root.querySelectorAll(".agent-stop").forEach(b => {
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const agent = State.agents.find(a => a.id === b.dataset.agent);
      if (!agent) return;
      if (!confirm(t("chat.confirm_stop_runner", {backend: agent.name}))) return;
      try { await api("DELETE", `/api/agents/${agent.id}/runner`); }
      catch (e) { alert(e.message); return; }
      await refreshRunners();
    });
  });
  root.querySelectorAll(".agent-rename").forEach(b => {
    b.addEventListener("click", (ev) => { ev.stopPropagation(); promptRenameAgent(b.dataset.agent); });
  });
  root.querySelectorAll(".agent-edit-model").forEach(b => {
    b.addEventListener("click", (ev) => { ev.stopPropagation(); promptEditAgentModel(b.dataset.agent); });
  });
  root.querySelectorAll(".agent-del").forEach(b => {
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      confirmDeleteAgent(b.dataset.agent, b.dataset.name, parseInt(b.dataset.count || "0", 10));
    });
  });
  root.querySelectorAll(".chat-row").forEach(row => {
    row.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("chat-del") || ev.target.classList.contains("chat-rename")) return;
      if (row.classList.contains("new-chat-row")) {
        const agentId = row.dataset.agent;
        const agent = State.agents.find(a => a.id === agentId);
        if (agent) createChatForAgent(agent);
        return;
      }
      selectChat(row.dataset.id, { pushUrl: true });
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
        try { history.pushState({}, "", "/"); } catch {}
      }
      renderSidebar();
    });
  });
  root.querySelectorAll(".chat-rename").forEach(b => {
    b.addEventListener("click", (ev) => { ev.stopPropagation(); promptRenameChat(b.dataset.id); });
  });
}

// --- Agent CRUD UI ------------------------------------------------------

async function promptCreateAgent(backendName) {
  const backend = State.backends.find(b => b.name === backendName);
  if (!backend) return;
  if (!(await ensureUpstreamConfigured(backendName))) return;
  const name = (prompt(`${t("agent.create_title")} (${backend.display_name || backend.name})\n\n${t("agent.create_name")}:`, "") || "").trim();
  if (!name) return;
  const modelRaw = prompt(`${t("agent.create_model")} (${t("agent.create_model_hint")})`, "");
  if (modelRaw === null) return;
  const model = (modelRaw || "").trim();
  let r;
  try {
    r = await api("POST", "/api/agents", { backend: backend.name, name, model });
  } catch (e) { alert(t("agent.create_failed") + e.message); return; }
  await loadAgents();
  State.expandedBackends.add(backend.name);
  if (r && r.agent && r.agent.id) State.expandedAgents.add(r.agent.id);
  renderSidebar();
}

async function promptRenameAgent(agentId) {
  const agent = State.agents.find(a => a.id === agentId);
  if (!agent) return;
  const name = (prompt(t("agent.rename_prompt"), agent.name) || "").trim();
  if (!name || name === agent.name) return;
  try { await api("PATCH", `/api/agents/${agentId}`, { name }); }
  catch (e) { alert(e.message); return; }
  await loadAgents();
  renderSidebar();
}

async function promptEditAgentModel(agentId) {
  const agent = State.agents.find(a => a.id === agentId);
  if (!agent) return;
  const v = prompt(t("agent.edit_model_prompt"), agent.model || "");
  if (v === null) return;
  try { await api("PATCH", `/api/agents/${agentId}`, { model: v.trim() }); }
  catch (e) { alert(e.message); return; }
  await loadAgents();
  renderSidebar();
}

async function confirmDeleteAgent(agentId, name, chatCount) {
  if (!confirm(t("agent.delete_confirm", {name, n: chatCount}))) return;
  try { await api("DELETE", `/api/agents/${agentId}`); }
  catch (e) { alert(t("agent.delete_failed") + e.message); return; }
  // drop affected chats from local cache
  State.chats = State.chats.filter(c => c.agentId !== agentId);
  if (State.activeChatId && !State.chats.find(c => c.id === State.activeChatId)) {
    State.activeChatId = null;
    $("#messages").innerHTML = "";
    $("#chat-title").textContent = t("chat.empty_title");
    $("#chat-meta").textContent = "";
    $("#composer-input").disabled = true;
    $("#composer-send").disabled = true;
    try { history.pushState({}, "", "/"); } catch {}
  }
  State.expandedAgents.delete(agentId);
  await loadAgents();
  renderSidebar();
}

async function createChatForAgent(agent) {
  if (!(await ensureUpstreamConfigured(agent.backend))) return;
  let r;
  try { r = await api("POST", "/api/conversations", { agent_id: agent.id }); }
  catch (e) { alert(t("chat.create_failed") + e.message); return; }
  const c = r.conversation;
  State.chats.unshift({
    id: c.id, backend: c.backend, model: c.model,
    agentId: c.agent_id || agent.id,
    seq: c.seq || null,
    title: c.title || "",
    messages: [],
    messageCount: 0,
    updated_at: c.updated_at * 1000,
    loaded: true,
  });
  State.expandedAgents.add(agent.id);
  selectChat(c.id, { pushUrl: false });
}

async function promptRenameChat(id) {
  const chat = State.chats.find(c => c.id === id);
  if (!chat) return;
  const current = chat.title || t("sidebar.new_chat_default_title");
  const next = window.prompt(t("chat.rename_prompt"), current);
  if (next === null) return;
  const title = next.trim();
  if (!title || title === chat.title) return;
  try {
    const r = await api("PATCH", `/api/conversations/${id}`, { title });
    chat.title = r.conversation.title || title;
    chat.updated_at = (r.conversation.updated_at || Date.now() / 1000) * 1000;
  } catch (e) { alert(e.message); return; }
  if (State.activeChatId === id) {
    $("#chat-title").textContent = chat.title || t("sidebar.new_chat_default_title");
  }
  renderSidebar();
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
      agentId: c.agent_id || "",
      seq: c.seq || null,
      title: c.title || "",
      messages: [],
      messageCount: c.message_count || 0,
      updated_at: c.updated_at * 1000,
      loaded: false,
    }));
    // auto-expand any backend / agent that has at least one chat
    for (const c of State.chats) {
      State.expandedBackends.add(c.backend);
      if (c.agentId) State.expandedAgents.add(c.agentId);
    }
  } catch { State.chats = []; }
}

async function loadAgents() {
  try {
    const r = await api("GET", "/api/agents");
    State.agents = (r.agents || []).map(a => ({
      id: a.id, backend: a.backend, name: a.name, model: a.model || "",
      ordinal: a.ordinal, running: !!a.running,
      runner: a.runner || null,
      created_at: a.created_at, updated_at: a.updated_at,
    }));
    if (typeof r.max_per_backend === "number") State.maxAgentsPerBackend = r.max_per_backend;
  } catch { State.agents = []; }
}


function closeConvStream() {
  if (State.convES) {
    try { State.convES.close(); } catch {}
  }
  State.convES = null;
  State.convESChatId = null;
}

function openConvStream(chatId) {
  if (State.convESChatId === chatId && State.convES) return;
  closeConvStream();
  if (!chatId) return;
  try {
    const es = new EventSource(`/api/conversations/${chatId}/stream`, { withCredentials: true });
    State.convES = es;
    State.convESChatId = chatId;
    es.onmessage = (ev) => {
      let data; try { data = JSON.parse(ev.data); } catch { return; }
      handleConvEvent(chatId, data);
    };
    es.onerror = () => {
      // Browser auto-reconnects EventSource by default; we only clear state if
      // the user has already switched chats.
      if (State.convESChatId !== State.activeChatId) closeConvStream();
    };
  } catch (e) {
    console.warn("conv stream open failed", e);
  }
}

function handleConvEvent(chatId, ev) {
  if (!ev || !ev.kind) return;
  const chat = State.chats.find(c => c.id === chatId);
  if (!chat) return;
  if (ev.kind === "message") {
    const p = ev.payload || {};
    if (!p.id) return;
    // Skip messages our own POST flow has already inserted (echo of /messages).
    if ((chat.messages || []).some(m => m.id === p.id)) return;
    // The user/assistant happy path is driven entirely by sendCurrent() /
    // requestAssistant(); the SSE echo would otherwise duplicate them because
    // userMsg.id is only assigned AFTER the POST returns, so the id-based
    // dedup above won't catch this race. Only system/error pushes from the
    // runner-side callback are interesting to inject here.
    if (p.role !== "system" && p.role !== "error") return;
    chat.messages = chat.messages || [];
    chat.messages.push({ id: p.id, role: p.role || "system", content: p.content || "" });
    chat.messageCount = chat.messages.length;
    if (chat.id === State.activeChatId) {
      renderMessages(chat);
      $("#chat-meta").textContent = `${chat.model || chat.backend} \u00b7 ${t("chat.message_count", {n: chat.messages.length})}`;
    } else {
      renderChatList();
    }
  } else if (ev.kind === "runner_status") {
    // A runner came up or went down for this agent — refresh runners so the
    // sidebar badge updates promptly without waiting for the next poll.
    try { refreshRunners(); } catch {}
  }
}

async function selectChat(id, opts) {
  State.activeChatId = id;
  const chat = State.chats.find(c => c.id === id);
  renderChatList();
  // Always (re)open the per-conversation SSE stream for the new active chat.
  openConvStream(id);
  if (!chat) { $("#model-picker").classList.add("hidden"); return; }
  if (opts && opts.pushUrl === true) syncChatUrl(chat);
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
  $("#chat-title").title = t("sidebar.rename_chat");
  $("#chat-title").style.cursor = "pointer";
  $("#chat-title").onclick = () => promptRenameChat(chat.id);
  $("#chat-meta").textContent = `${chat.model || chat.backend} \u00b7 ${t("chat.message_count", {n: chat.messages.length})}`;
  renderMessages(chat);
  $("#composer-input").disabled = false;
  $("#composer-send").disabled = false;
  $("#model-picker").classList.add("hidden");
  $("#composer-input").focus();
}

function renderMessages(chat) {
  // Only the currently-active chat owns the message pane. Streaming replies on
  // background chats must NOT touch the DOM, otherwise switching away from a
  // chat while its reply is still arriving makes the visible chat flicker as
  // the other chat's deltas keep overwriting #messages.
  if (!chat || chat.id !== State.activeChatId) {
    // Still bump the sidebar so the user can see the other chat advance.
    renderChatList();
    return;
  }
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
  // Legacy entry: create or reuse the ordinal=1 agent for this backend,
  // then start a chat under it.
  if (!(await ensureUpstreamConfigured(backend.name))) return;
  let r;
  try {
    r = await api("POST", "/api/conversations", { backend: backend.name, model: modelId || backend.name });
  } catch (e) { alert(t("chat.create_failed") + e.message); return; }
  const c = r.conversation;
  State.chats.unshift({
    id: c.id, backend: c.backend, model: c.model,
    agentId: c.agent_id || "",
    seq: c.seq || null,
    title: c.title || "",
    messages: [],
    messageCount: 0,
    updated_at: c.updated_at * 1000,
    loaded: true,
  });
  if (c.agent_id) State.expandedAgents.add(c.agent_id);
  // Refresh agent list so the newly-auto-created ordinal=1 agent appears.
  loadAgents().then(renderSidebar);
  selectChat(c.id, { pushUrl: false });
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
  renderIdleSection();
}

async function renderIdleSection() {
  const wrap = $("#setting-idle-list");
  if (!wrap) return;
  let backends;
  try {
    const r = await api("GET", "/api/backends");
    backends = r.backends || [];
  } catch (e) {
    wrap.innerHTML = `<div class="setting-row"><span>${escapeHtml(e.message)}</span></div>`;
    return;
  }
  if (!backends.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = backends.map(b => {
    const disabled = !b.idle_seconds || b.idle_seconds <= 0;
    const displayVal = disabled ? (b.default_idle_seconds || 600) : b.idle_seconds;
    return `
    <div class="setting-row idle-row" data-backend="${escapeHtml(b.name)}">
      <label>${escapeHtml(b.display_name || b.name)}</label>
      <span class="idle-controls">
        <input type="number" min="60" max="21600" step="60"
               class="idle-modal-input"
               value="${displayVal}"
               ${disabled ? "disabled" : ""}
               data-default="${b.default_idle_seconds}" />
        <span class="setting-hint">${escapeHtml(t("settings.idle_unit"))}</span>
        <label class="idle-disable-toggle">
          <input type="checkbox" class="idle-modal-disable" ${disabled ? "checked" : ""} />
          <span>${escapeHtml(t("settings.idle_disable"))}</span>
        </label>
        <button class="idle-modal-save" data-backend="${escapeHtml(b.name)}">${escapeHtml(t("settings.idle_save"))}</button>
        <span class="idle-modal-status" aria-live="polite">${disabled ? escapeHtml(t("settings.idle_disabled_note")) : ""}</span>
      </span>
    </div>
  `;}).join("");
  wrap.querySelectorAll(".idle-modal-disable").forEach(cb => {
    cb.addEventListener("change", () => {
      const row = cb.closest(".idle-row");
      const input = row.querySelector(".idle-modal-input");
      input.disabled = cb.checked;
    });
  });
  wrap.querySelectorAll(".idle-modal-save").forEach(btn => {
    btn.addEventListener("click", async () => {
      const backend = btn.dataset.backend;
      const row = wrap.querySelector(`.idle-row[data-backend="${backend}"]`);
      const input = row.querySelector(".idle-modal-input");
      const status = row.querySelector(".idle-modal-status");
      const disable = row.querySelector(".idle-modal-disable").checked;
      let v;
      if (disable) {
        v = 0;
      } else {
        v = Math.max(60, Math.min(21600, parseInt(input.value, 10) || 0));
        input.value = v;
      }
      btn.disabled = true;
      status.textContent = "…";
      try {
        await api("PUT", `/api/runners/${backend}/idle`, { idle_seconds: v });
        status.textContent = disable
          ? t("settings.idle_disabled_note")
          : t("settings.idle_saved");
        if (!disable) setTimeout(() => { status.textContent = ""; }, 2000);
      } catch (e) {
        status.textContent = t("settings.idle_save_failed") + e.message;
      } finally {
        btn.disabled = false;
      }
    });
  });
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


/* =====================================================================
 * Rooms (multi-user/agent chat)
 * ===================================================================== */

const Rooms = {
  list: [],
  current: null,        // {id,title,owner_user_id,paused,members:[],is_owner}
  messages: [],
  membersOpen: false,
  sse: null,
  lastSeenId: null,
  pollTimer: null,
};

async function roomsRefreshList() {
  const r = await api("GET", "/api/rooms");
  Rooms.list = r.rooms || [];
  roomsRenderList();
}

function roomsRenderList() {
  const el = $("#rooms-list");
  if (!Rooms.list.length) {
    el.innerHTML = '<div class="rooms-empty" style="padding:16px;font-size:13px">No rooms yet.</div>';
    return;
  }
  el.innerHTML = Rooms.list.map(r => {
    const active = Rooms.current && Rooms.current.id === r.id ? " active" : "";
    return `<div class="rooms-list-item${active}" data-id="${r.id}">
      <div class="r-title">${escapeHtml(r.title)}</div>
      <div class="r-meta">${r.member_count} member(s)${r.paused ? " · paused" : ""}</div>
    </div>`;
  }).join("");
  el.querySelectorAll(".rooms-list-item").forEach(div => {
    div.addEventListener("click", () => roomsOpen(div.dataset.id));
  });
}

async function roomsOpen(id) {
  roomsCloseSse();
  Rooms.messages = [];
  Rooms.lastSeenId = null;
  const r = await api("GET", `/api/rooms/${id}`);
  Rooms.current = { ...r.room, members: r.members, is_owner: r.is_owner, my_role: r.my_role, is_moderator: r.is_moderator };
  $("#rooms-detail-empty").classList.add("hidden");
  $("#rooms-discover-view")?.classList.add("hidden");
  $("#rooms-detail").classList.remove("hidden");
  roomsRenderHeader();
  await roomsLoadMessages();
  roomsRenderMessages();
  roomsRenderList();
  roomsOpenSse();
}

function roomsRenderHeader() {
  const r = Rooms.current;
  $("#rooms-detail-title").textContent = r.title;
  const approved = r.members.filter(m => m.status === "approved");
  const pending  = r.members.filter(m => m.status === "pending");
  const visLabel = r.visibility === "public" ? "🌐 public" : "🔒 private";
  $("#rooms-detail-meta").textContent =
    `${approved.length} member(s)` +
    (pending.length ? ` · ${pending.length} pending` : "") +
    ` · ${visLabel}` +
    (r.paused ? " · paused" : "") +
    (r.is_owner ? " · you own" : (r.my_role === "admin" ? " · admin" : ""));
  $("#rooms-pause-btn").textContent = r.paused ? "Resume" : "Pause";
  $("#rooms-pause-btn").classList.toggle("hidden", !r.is_owner);
  $("#rooms-leave-btn").classList.toggle("hidden", !r.is_owner);
  const visBtn = $("#rooms-visibility-btn");
  if (visBtn) {
    visBtn.textContent = r.visibility === "public" ? "Make private" : "Make public";
    visBtn.classList.toggle("hidden", !r.is_owner);
  }
  roomsRenderMembers();
}

function roomsRenderMembers() {
  const panel = $("#rooms-members-panel");
  const r = Rooms.current;
  const isOwner = !!r.is_owner;
  const isMod = !!r.is_moderator;
  panel.innerHTML = `
    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <strong>Members</strong>
      <div style="display:flex;gap:6px;">
        <button class="btn-ghost" id="rooms-add-self-btn" style="font-size:11px;padding:3px 8px;">Add my agent…</button>
      </div>
    </div>
    ${r.members.map(m => {
      const slug = m.user_slug || m.user_id.slice(0, 6);
      const isOwnerRow = m.kind === "user" && m.user_id === r.owner_user_id;
      const roleBadge = isOwnerRow
        ? '<span class="badge owner">owner</span>'
        : (m.role === "admin" ? '<span class="badge admin">admin</span>' : "");
      const label = m.kind === "runner"
        ? `${escapeHtml(slug)}/<span class="badge runner">${escapeHtml(m.backend_name)}</span> · mode=${m.mode}`
        : `${escapeHtml(slug)} ${roleBadge}`;
      const statusBadge = m.status === "pending"  ? '<span class="badge pending">pending</span>'
                       : m.status === "rejected" ? '<span class="badge rejected">rejected</span>'
                       : '';
      let actions = "";
      if (isMod && m.status === "pending") {
        actions = `<button class="btn-primary" data-act="approve" data-uid="${m.user_id}" data-kind="${m.kind}" data-bn="${escapeHtml(m.backend_name)}">Approve</button>
                   <button class="btn-ghost"   data-act="reject"  data-uid="${m.user_id}" data-kind="${m.kind}" data-bn="${escapeHtml(m.backend_name)}">Reject</button>`;
      } else if (isMod && m.status === "approved" && !isOwnerRow) {
        const promoteBtn = (isOwner && m.kind === "user" && m.role === "member")
          ? `<button class="btn-ghost" data-act="promote" data-uid="${m.user_id}" title="Promote to admin">Promote</button>` : "";
        const demoteBtn = (isOwner && m.kind === "user" && m.role === "admin")
          ? `<button class="btn-ghost" data-act="demote" data-uid="${m.user_id}" title="Demote to member">Demote</button>` : "";
        actions = `${promoteBtn}${demoteBtn}<button class="btn-ghost" data-act="remove" data-uid="${m.user_id}" data-kind="${m.kind}" data-bn="${escapeHtml(m.backend_name)}">Remove</button>`;
      }
      return `<div class="rooms-member-row">
        <div class="member-info">${label} ${statusBadge}</div>
        <div class="member-actions">${actions}</div>
      </div>`;
    }).join("")}
  `;
  panel.querySelector("#rooms-add-self-btn").addEventListener("click", roomsAddSelfDialog);
  panel.querySelectorAll("button[data-act]").forEach(b => {
    b.addEventListener("click", async () => {
      const act = b.dataset.act;
      try {
        if (act === "promote") {
          await api("POST", `/api/rooms/${r.id}/members/promote?member_user_id=${encodeURIComponent(b.dataset.uid)}`);
        } else if (act === "demote") {
          await api("POST", `/api/rooms/${r.id}/members/demote?member_user_id=${encodeURIComponent(b.dataset.uid)}`);
        } else {
          const params = new URLSearchParams({
            member_user_id: b.dataset.uid,
            member_kind: b.dataset.kind,
            backend_name: b.dataset.bn,
          });
          if (act === "approve") await api("POST", `/api/rooms/${r.id}/members/approve?${params}`);
          else if (act === "reject") await api("POST", `/api/rooms/${r.id}/members/reject?${params}`);
          else if (act === "remove") await api("DELETE", `/api/rooms/${r.id}/members?${params}`);
        }
        await roomsReloadCurrent();
      } catch (e) { alert(e.message); }
    });
  });
}

async function roomsAddSelfDialog() {
  // Two-row picker: row 1 = who (myself / each available backend runner),
  // row 2 = mode (passive / active, only when a runner is picked).
  const r = Rooms.current;
  const meRow = r.members.find(m => m.kind === "user" && m.user_id === State.user.id);
  const canJoinSelf = !meRow;
  let backends = [];
  try {
    const bs = await api("GET", "/api/backends");
    for (const b of (bs.backends || bs)) {
      const name = b.name || b;
      const exists = r.members.find(m => m.kind === "runner" && m.backend_name === name && m.user_id === State.user.id);
      if (!exists) backends.push(name);
    }
  } catch {}
  if (!canJoinSelf && !backends.length) {
    alert("Nothing to add — you and all your runners are already in this room.");
    return;
  }
  await showAddMemberModal(r.id, { canJoinSelf, backends });
}

function showAddMemberModal(roomId, { canJoinSelf, backends }) {
  return new Promise((resolve) => {
    // Build DOM
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.id = "rooms-add-modal";
    const subjectChips = [];
    if (canJoinSelf) subjectChips.push({ id: "__self__", label: "Myself (user)", icon: "👤" });
    for (const name of backends) subjectChips.push({ id: name, label: name, icon: "🤖" });

    let pickedSubject = subjectChips[0]?.id || null;
    let pickedMode = "passive";

    overlay.innerHTML = `
      <div class="modal-card modal-card--sm">
        <div class="modal-header">
          <h2>Add to this room</h2>
          <button type="button" data-act="close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="add-row">
            <div class="add-row-label">Who</div>
            <div class="chip-group" data-group="subject"></div>
          </div>
          <div class="add-row" data-row="mode">
            <div class="add-row-label">Mode</div>
            <div class="chip-group" data-group="mode">
              <button type="button" class="chip" data-val="passive" data-tip="Only speaks when @mentioned or directly addressed.">
                <span class="chip-title">Passive</span>
                <span class="chip-sub">only when asked</span>
              </button>
              <button type="button" class="chip" data-val="active" data-tip="Chimes in freely when it thinks it can help.">
                <span class="chip-title">Active</span>
                <span class="chip-sub">chimes in freely</span>
              </button>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" data-act="close">Cancel</button>
            <button type="button" class="btn-primary" data-act="ok">Add</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const subjectBox = overlay.querySelector('[data-group="subject"]');
    for (const s of subjectChips) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.val = s.id;
      btn.innerHTML = `<span class="chip-title">${s.icon} ${escapeHtml(s.label)}</span>`;
      subjectBox.appendChild(btn);
    }

    const modeRow = overlay.querySelector('[data-row="mode"]');
    function syncSelection() {
      overlay.querySelectorAll('[data-group="subject"] .chip').forEach(c => {
        c.classList.toggle("active", c.dataset.val === pickedSubject);
      });
      overlay.querySelectorAll('[data-group="mode"] .chip').forEach(c => {
        c.classList.toggle("active", c.dataset.val === pickedMode);
      });
      // hide mode row when "myself" is picked
      const isSelf = pickedSubject === "__self__";
      modeRow.style.display = isSelf ? "none" : "";
    }
    syncSelection();

    function close(result) {
      overlay.remove();
      resolve(result || null);
    }

    overlay.addEventListener("click", async (ev) => {
      const t = ev.target.closest("[data-act], .chip");
      if (!t) {
        if (ev.target === overlay) close(null);
        return;
      }
      if (t.classList.contains("chip")) {
        const group = t.parentElement.dataset.group;
        if (group === "subject") pickedSubject = t.dataset.val;
        else if (group === "mode") pickedMode = t.dataset.val;
        syncSelection();
        return;
      }
      const act = t.dataset.act;
      if (act === "close") { close(null); return; }
      if (act === "ok") {
        if (!pickedSubject) { close(null); return; }
        try {
          const isSelf = pickedSubject === "__self__";
          await api("POST", `/api/rooms/${roomId}/join`, {
            kind: isSelf ? "user" : "runner",
            backend_name: isSelf ? "" : pickedSubject,
            mode: isSelf ? "passive" : pickedMode,
          });
          close({ ok: true });
          await roomsReloadCurrent();
        } catch (e) {
          alert(e.message);
        }
      }
    });
    document.addEventListener("keydown", function onKey(ev) {
      if (!document.body.contains(overlay)) { document.removeEventListener("keydown", onKey); return; }
      if (ev.key === "Escape") { close(null); document.removeEventListener("keydown", onKey); }
    });
  });
}

async function roomsReloadCurrent() {
  if (!Rooms.current) return;
  const r = await api("GET", `/api/rooms/${Rooms.current.id}`);
  Rooms.current = { ...r.room, members: r.members, is_owner: r.is_owner, my_role: r.my_role, is_moderator: r.is_moderator };
  roomsRenderHeader();
  await roomsRefreshList();
}

async function roomsLoadMessages() {
  const r = await api("GET", `/api/rooms/${Rooms.current.id}/messages?limit=200`);
  Rooms.messages = r.messages || [];
  if (Rooms.messages.length) Rooms.lastSeenId = Rooms.messages[Rooms.messages.length - 1].id;
}

function roomsRenderMessages() {
  const el = $("#rooms-messages");
  el.innerHTML = Rooms.messages.map(m => {
    const isSelf = m.sender_kind === "user" && m.sender_user_id === State.user.id;
    const cls = isSelf ? "self" : (m.sender_kind === "runner" ? "runner" : "user");
    const slug = m.sender_user_slug || m.sender_user_id.slice(0,6);
    const from = m.sender_kind === "runner" ? `${escapeHtml(slug)}/${escapeHtml(m.sender_backend_name)}` : escapeHtml(slug);
    return `<div class="rmsg ${cls}"><div class="rmsg-from">${from}</div><div class="rmsg-content">${escapeHtml(m.content)}</div></div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

function roomsAppendMessage(m) {
  if (Rooms.messages.find(x => x.id === m.id)) return;
  Rooms.messages.push(m);
  Rooms.lastSeenId = m.id;
  roomsRenderMessages();
}

function roomsOpenSse() {
  roomsCloseSse();
  if (!Rooms.current) return;
  try {
    const es = new EventSource(`/api/rooms/${Rooms.current.id}/stream`, { withCredentials: true });
    es.onmessage = (ev) => {
      let data; try { data = JSON.parse(ev.data); } catch { return; }
      if (data.kind === "message") roomsAppendMessage(data.payload);
      else if (data.kind === "member") roomsReloadCurrent().catch(() => {});
    };
    es.onerror = () => {
      // fall back to polling
      es.close();
      Rooms.sse = null;
      roomsStartPolling();
    };
    Rooms.sse = es;
    if (Rooms.pollTimer) { clearInterval(Rooms.pollTimer); Rooms.pollTimer = null; }
  } catch {
    roomsStartPolling();
  }
}

function roomsStartPolling() {
  if (Rooms.pollTimer) return;
  Rooms.pollTimer = setInterval(async () => {
    if (!Rooms.current) return;
    try {
      const q = Rooms.lastSeenId ? `?after_id=${Rooms.lastSeenId}` : "";
      const r = await api("GET", `/api/rooms/${Rooms.current.id}/messages${q}`);
      for (const m of r.messages || []) roomsAppendMessage(m);
    } catch {}
  }, 3000);
}

function roomsCloseSse() {
  if (Rooms.sse) { try { Rooms.sse.close(); } catch {} Rooms.sse = null; }
  if (Rooms.pollTimer) { clearInterval(Rooms.pollTimer); Rooms.pollTimer = null; }
}

function openRoomsModal() {
  $("#rooms-modal").classList.remove("hidden");
  roomsRefreshList().catch(e => alert(e.message));
}
function closeRoomsModal() {
  $("#rooms-modal").classList.add("hidden");
  roomsCloseSse();
}

$("#rooms-btn").addEventListener("click", openRoomsModal);
$("#rooms-close").addEventListener("click", closeRoomsModal);
$("#rooms-modal").addEventListener("click", (ev) => {
  if (ev.target.id === "rooms-modal") closeRoomsModal();
});

$("#rooms-new-btn").addEventListener("click", async () => {
  const choice = await showCreateRoomModal();
  if (!choice) return;
  try {
    const r = await api("POST", "/api/rooms", { title: choice.title, visibility: choice.visibility });
    await roomsRefreshList();
    await roomsOpen(r.room.id);
  } catch (e) { alert(e.message); }
});

function showCreateRoomModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.innerHTML = `
      <div class="modal-card modal-card--sm">
        <div class="modal-header">
          <h2>New room</h2>
          <button type="button" data-act="close">×</button>
        </div>
        <div class="modal-body">
          <div class="add-row">
            <div class="add-row-label">Name</div>
            <input type="text" id="cr-title" class="api-key-input" placeholder="room name" />
          </div>
          <div class="add-row">
            <div class="add-row-label">Visibility</div>
            <div class="chip-group" data-group="vis">
              <button type="button" class="chip active" data-val="private">
                <span class="chip-title">🔒 Private</span>
                <span class="chip-sub">invite-only by link</span>
              </button>
              <button type="button" class="chip" data-val="public">
                <span class="chip-title">🌐 Public</span>
                <span class="chip-sub">discoverable; anyone can request</span>
              </button>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" data-act="close">Cancel</button>
            <button type="button" class="btn-primary" data-act="ok">Create</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    let vis = "private";
    overlay.querySelector("#cr-title").focus();
    overlay.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-act], .chip");
      if (!t) { if (ev.target === overlay) { overlay.remove(); resolve(null); } return; }
      if (t.classList.contains("chip")) {
        vis = t.dataset.val;
        overlay.querySelectorAll('[data-group="vis"] .chip').forEach(c => c.classList.toggle("active", c.dataset.val === vis));
        return;
      }
      if (t.dataset.act === "close") { overlay.remove(); resolve(null); return; }
      if (t.dataset.act === "ok") {
        const title = (overlay.querySelector("#cr-title").value || "").trim();
        if (!title) { overlay.querySelector("#cr-title").focus(); return; }
        overlay.remove();
        resolve({ title, visibility: vis });
      }
    });
    document.addEventListener("keydown", function onKey(ev) {
      if (!document.body.contains(overlay)) { document.removeEventListener("keydown", onKey); return; }
      if (ev.key === "Escape") { overlay.remove(); resolve(null); document.removeEventListener("keydown", onKey); }
      if (ev.key === "Enter" && ev.target.id === "cr-title") {
        overlay.querySelector('[data-act="ok"]').click();
      }
    });
  });
}

$("#rooms-visibility-btn")?.addEventListener("click", async () => {
  if (!Rooms.current || !Rooms.current.is_owner) return;
  const next = Rooms.current.visibility === "public" ? "private" : "public";
  const msg = next === "public"
    ? "Make this room public? Anyone will be able to find it in Discover and request to join."
    : "Make this room private? It will no longer appear in Discover; only people with the link can request to join.";
  if (!confirm(msg)) return;
  try {
    await api("PATCH", `/api/rooms/${Rooms.current.id}`, { visibility: next });
    await roomsReloadCurrent();
  } catch (e) { alert(e.message); }
});

$("#rooms-discover-btn")?.addEventListener("click", () => openDiscoverView());

async function openDiscoverView() {
  $("#rooms-detail-empty").classList.add("hidden");
  $("#rooms-detail").classList.add("hidden");
  const view = $("#rooms-discover-view");
  view.classList.remove("hidden");
  view.innerHTML = `<div class="rooms-empty">Loading public rooms…</div>`;
  try {
    const r = await api("GET", "/api/rooms/discover");
    const rooms = r.rooms || [];
    if (!rooms.length) {
      view.innerHTML = `<div class="rooms-empty">No public rooms yet. Create one and mark it 🌐 public to let others find it.</div>`;
      return;
    }
    view.innerHTML = `
      <div class="discover-header"><strong>Public rooms</strong></div>
      <div class="discover-list">
        ${rooms.map(rm => {
          const memberLine = rm.my_status === "approved" ? "✓ joined"
                           : rm.my_status === "pending"  ? "… pending"
                           : rm.my_status === "rejected" ? "✕ rejected"
                           : "";
          return `<div class="discover-card" data-rid="${rm.id}">
            <div class="discover-card-main">
              <div class="discover-title">${escapeHtml(rm.title)}</div>
              <div class="discover-meta">${rm.member_count} member(s) · 🌐 public ${memberLine ? "· " + memberLine : ""}</div>
            </div>
            <div class="discover-actions">
              ${rm.my_status === "approved"
                ? `<button class="btn-primary" data-act="open">Open</button>`
                : `<button class="btn-primary" data-act="join">${rm.my_status === "pending" ? "Re-add agent" : "Request to join"}</button>`}
            </div>
          </div>`;
        }).join("")}
      </div>
    `;
    view.querySelectorAll(".discover-card").forEach(card => {
      card.querySelector('[data-act="open"]')?.addEventListener("click", async () => {
        view.classList.add("hidden");
        await roomsOpen(card.dataset.rid);
        await roomsRefreshList();
      });
      card.querySelector('[data-act="join"]')?.addEventListener("click", async () => {
        const choice = await showJoinPublicRoomModal();
        if (!choice) return;
        try {
          await api("POST", `/api/rooms/${card.dataset.rid}/join`, choice);
          alert(choice.kind === "user" ? "Request sent — waiting for owner approval." : "Agent request sent — waiting for owner approval.");
          openDiscoverView();
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    view.innerHTML = `<div class="rooms-empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function showJoinPublicRoomModal() {
  // Choose: join as user, or send one of my runners. Reuse the add-member chip UI.
  let backends = [];
  try {
    const bs = await api("GET", "/api/backends");
    backends = (bs.backends || bs).map(b => b.name || b);
  } catch {}
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    let pickedSubject = "__self__";
    let pickedMode = "passive";
    overlay.innerHTML = `
      <div class="modal-card modal-card--sm">
        <div class="modal-header">
          <h2>Request to join</h2>
          <button type="button" data-act="close">×</button>
        </div>
        <div class="modal-body">
          <div class="add-row">
            <div class="add-row-label">Who</div>
            <div class="chip-group" data-group="subject"></div>
          </div>
          <div class="add-row" data-row="mode">
            <div class="add-row-label">Mode</div>
            <div class="chip-group" data-group="mode">
              <button type="button" class="chip active" data-val="passive">
                <span class="chip-title">Passive</span><span class="chip-sub">only when asked</span>
              </button>
              <button type="button" class="chip" data-val="active">
                <span class="chip-title">Active</span><span class="chip-sub">chimes in freely</span>
              </button>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" data-act="close">Cancel</button>
            <button type="button" class="btn-primary" data-act="ok">Send request</button>
          </div>
        </div>
      </div>`;
    const subj = overlay.querySelector('[data-group="subject"]');
    const me = document.createElement("button");
    me.type = "button"; me.className = "chip active";
    me.dataset.val = "__self__";
    me.innerHTML = `<span class="chip-title">👤 Myself</span>`;
    subj.appendChild(me);
    for (const n of backends) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.dataset.val = n;
      b.innerHTML = `<span class="chip-title">🤖 ${escapeHtml(n)}</span>`;
      subj.appendChild(b);
    }
    function sync() {
      overlay.querySelectorAll('[data-group="subject"] .chip').forEach(c => c.classList.toggle("active", c.dataset.val === pickedSubject));
      overlay.querySelectorAll('[data-group="mode"] .chip').forEach(c => c.classList.toggle("active", c.dataset.val === pickedMode));
      overlay.querySelector('[data-row="mode"]').style.display = pickedSubject === "__self__" ? "none" : "";
    }
    sync();
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-act], .chip");
      if (!t) { if (ev.target === overlay) { overlay.remove(); resolve(null); } return; }
      if (t.classList.contains("chip")) {
        const g = t.parentElement.dataset.group;
        if (g === "subject") pickedSubject = t.dataset.val;
        else pickedMode = t.dataset.val;
        sync(); return;
      }
      if (t.dataset.act === "close") { overlay.remove(); resolve(null); return; }
      if (t.dataset.act === "ok") {
        const isSelf = pickedSubject === "__self__";
        overlay.remove();
        resolve({ kind: isSelf ? "user" : "runner", backend_name: isSelf ? "" : pickedSubject, mode: isSelf ? "passive" : pickedMode });
      }
    });
  });
}

$("#rooms-pause-btn").addEventListener("click", async () => {
  if (!Rooms.current) return;
  const next = !Rooms.current.paused;
  try {
    await api("POST", `/api/rooms/${Rooms.current.id}/pause?paused=${next}`);
    await roomsReloadCurrent();
  } catch (e) { alert(e.message); }
});

$("#rooms-leave-btn").addEventListener("click", async () => {
  if (!Rooms.current || !Rooms.current.is_owner) return;
  if (!confirm(`Delete room "${Rooms.current.title}"? This cannot be undone.`)) return;
  try {
    await api("DELETE", `/api/rooms/${Rooms.current.id}`);
    Rooms.current = null;
    $("#rooms-detail").classList.add("hidden");
    $("#rooms-detail-empty").classList.remove("hidden");
    roomsCloseSse();
    await roomsRefreshList();
  } catch (e) { alert(e.message); }
});

$("#rooms-composer").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!Rooms.current) return;
  const ta = $("#rooms-composer-input");
  const content = ta.value.trim();
  if (!content) return;
  ta.disabled = true;
  try {
    await api("POST", `/api/rooms/${Rooms.current.id}/messages`, { content });
    ta.value = "";
  } catch (e) { alert(e.message); }
  finally { ta.disabled = false; ta.focus(); }
});

$("#rooms-composer-input").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    $("#rooms-composer").requestSubmit();
  }
});
