const API_URL = "https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api";

const STORAGE_KEYS = {
  deviceToken: "antidote.deviceToken.v4",
  deviceExpiry: "antidote.deviceExpiry.v4",
  dashboardCache: "antidote.dashboardCache.v11",
  pendingQueue: "antidote.pendingQueue.v5",
  activeEpisode: "antidote.activeEpisode.v5",
  checkinDraft: "antidote.checkinDraft.v4",
  episodeDraft: "antidote.episodeDraft.v2",
};

const state = {
  token: localStorage.getItem(STORAGE_KEYS.deviceToken) || "",
  tokenExpiry: localStorage.getItem(STORAGE_KEYS.deviceExpiry) || "",
  dashboard: readJson(STORAGE_KEYS.dashboardCache, null),
  queue: readJson(STORAGE_KEYS.pendingQueue, []),
  activeEpisode: readJson(STORAGE_KEYS.activeEpisode, null),
  isBooting: false,
};

const dom = {};
let episodeTimer = null;
let toastTimer = null;
let lastFocused = null;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const element = typeof selector === "string" ? $(selector) : selector;
  if (element) element.textContent = value ?? "";
}

function getRadioValue(form, name) {
  return form?.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setRadio(form, name, value) {
  const input = form?.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
  if (input) input.checked = true;
}

function valueOf(form, name) {
  return form?.querySelector(`[name="${name}"]`)?.value || "";
}

function setValue(form, name, value) {
  const input = form?.querySelector(`[name="${name}"]`);
  if (input) input.value = value ?? "";
}

async function request(action, payload = {}, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.useAuth !== false && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(data?.error || data || `请求失败 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function storeAuth(token, expiry) {
  state.token = token;
  state.tokenExpiry = expiry || "";
  localStorage.setItem(STORAGE_KEYS.deviceToken, token);
  localStorage.setItem(STORAGE_KEYS.deviceExpiry, expiry || "");
}

function clearAuth() {
  state.token = "";
  state.tokenExpiry = "";
  localStorage.removeItem(STORAGE_KEYS.deviceToken);
  localStorage.removeItem(STORAGE_KEYS.deviceExpiry);
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (!button.dataset.idleText) button.dataset.idleText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.idleText;
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, 2600);
}

function renderSteps(steps = []) {
  dom.actionSteps.innerHTML = steps
    .slice(0, 3)
    .map(
      (step) => `
        <li>
          <div>
            <strong>${escapeHtml(step.title)}</strong>
            <p>${escapeHtml(step.detail)}</p>
          </div>
          <span class="step-time">${escapeHtml(step.time)}</span>
        </li>
      `,
    )
    .join("");
}

function renderAvoid(items = []) {
  dom.avoidList.innerHTML = items
    .slice(0, 4)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderDashboard(dashboard) {
  if (!dashboard) return;
  state.dashboard = dashboard;
  saveJson(STORAGE_KEYS.dashboardCache, dashboard);

  const guidance = dashboard.guidance || {};
  setText(dom.todayLabel, formatDate(new Date(`${dashboard.today || todayLocal()}T12:00:00+08:00`)));
  setText(dom.guidanceTitle, guidance.title || "等待今天的判断");
  setText(dom.guidanceState, guidance.title || "读取中");
  setText(dom.guidanceFocus, guidance.focus || "请先记录今天的变化。");
  setText(dom.guidanceRationale, guidance.rationale || "");
  setText(dom.safetyNote, guidance.safety_note || "");
  setText(dom.lastSynced, `已同步 ${formatTime(dashboard.synced_at)}`);
  setText(dom.deviceStatus, "云端已同步");
  renderSteps(guidance.steps || []);
  renderAvoid(guidance.avoid || []);
  populateCheckinForm(dashboard.today_entry || null);
  document.body.classList.remove("locked");
}

function populateCheckinForm(entry) {
  const draft = readTodayCheckinDraft();
  const data = { ...(entry || {}), ...(draft || {}) };
  setRadio(dom.checkinForm, "baseline_change", data.baseline_change || "same");
  setRadio(dom.checkinForm, "episode_impact", data.episode_impact || "none");
  setValue(dom.checkinForm, "notes", data.notes || "");
}

function extractTriggerTags(notes) {
  const rules = [
    ["晨起", /(晨起|早上起床|睡醒)/],
    ["紧急叫起", /(紧急叫|突然叫醒|午睡.*叫)/],
    ["惊吓", /(惊吓|吓到|吓了一跳)/],
    ["骑行", /(骑车|骑电动车|骑行|车把)/],
    ["静止到活动", /(起身|久坐后|静止到活动|刚开始走)/],
    ["活动到静止", /(活动停止|运动后停|跑完|走完)/],
    ["转身", /(转身|右转|向后转)/],
    ["上下楼", /(上楼|下楼|台阶)/],
  ];
  return rules.filter(([, pattern]) => pattern.test(notes)).map(([tag]) => tag);
}

function collectCheckin() {
  const notes = valueOf(dom.checkinForm, "notes").trim();
  const episodeImpact = getRadioValue(dom.checkinForm, "episode_impact") || "none";
  const triggerTags = extractTriggerTags(notes);

  return {
    entry_date: todayLocal(),
    baseline_change: getRadioValue(dom.checkinForm, "baseline_change") || "same",
    episode_impact: episodeImpact,
    trigger_tags: triggerTags,
    e_bike: triggerTags.includes("骑行"),
    urgent_wake: triggerTags.includes("紧急叫起"),
    handlebar_unstable: episodeImpact === "control_affected" && /车把|骑/.test(notes),
    stop_after_activity_trigger: triggerTags.includes("活动到静止"),
    source_kind: "website",
    source_ref: "website:quick-checkin",
    notes,
  };
}

function collectCheckinDraft() {
  saveJson(STORAGE_KEYS.checkinDraft, {
    entry_date: todayLocal(),
    baseline_change: getRadioValue(dom.checkinForm, "baseline_change") || "same",
    episode_impact: getRadioValue(dom.checkinForm, "episode_impact") || "none",
    notes: valueOf(dom.checkinForm, "notes"),
  });
}

function readTodayCheckinDraft() {
  const draft = readJson(STORAGE_KEYS.checkinDraft, null);
  if (!draft) return null;
  if (draft.entry_date !== todayLocal()) {
    localStorage.removeItem(STORAGE_KEYS.checkinDraft);
    return null;
  }
  return draft;
}

function openModal(modal) {
  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector("button, input, textarea, [tabindex='-1']")?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  if (!document.querySelector(".modal-backdrop:not([hidden]), .episode-overlay:not([hidden])")) {
    document.body.classList.remove("modal-open");
  }
  lastFocused?.focus?.();
}

function openCheckinModal() {
  populateCheckinForm(state.dashboard?.today_entry || null);
  openModal(dom.checkinModal);
}

async function saveCheckin(event) {
  event.preventDefault();
  const payload = collectCheckin();
  setBusy(dom.saveCheckinButton, true, "保存中");
  try {
    const dashboard = await request("saveCheckin", { checkin: payload });
    localStorage.removeItem(STORAGE_KEYS.checkinDraft);
    renderDashboard(dashboard);
    closeModal(dom.checkinModal);
    showToast("今天的变化已保存");
    await flushQueue();
  } catch (error) {
    enqueuePending("saveCheckin", { checkin: payload });
    closeModal(dom.checkinModal);
    if (error.status === 401) {
      handleAuthFailure("设备验证已失效，记录已暂存。");
    } else {
      showToast("网络不可用，记录已暂存在本机");
    }
  } finally {
    setBusy(dom.saveCheckinButton, false, "保存中");
  }
}

function storeActiveEpisode(value) {
  state.activeEpisode = value;
  if (value) saveJson(STORAGE_KEYS.activeEpisode, value);
  else localStorage.removeItem(STORAGE_KEYS.activeEpisode);
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function renderEpisodeState() {
  if (!state.activeEpisode) return;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(state.activeEpisode.started_at)) / 1000),
  );
  setText(dom.episodeTimer, formatElapsed(elapsedSeconds));
}

function startEpisodeTicker() {
  clearInterval(episodeTimer);
  renderEpisodeState();
  episodeTimer = setInterval(renderEpisodeState, 1000);
}

function stopEpisodeTicker() {
  clearInterval(episodeTimer);
  episodeTimer = null;
}

async function startEpisode() {
  if (state.activeEpisode) {
    dom.episodeTimerView.hidden = false;
    dom.episodeFinishForm.hidden = true;
    openModal(dom.episodeModal);
    startEpisodeTicker();
    return;
  }

  const active = {
    event_id: null,
    started_at: new Date().toISOString(),
  };
  storeActiveEpisode(active);
  dom.episodeTimerView.hidden = false;
  dom.episodeFinishForm.hidden = true;
  openModal(dom.episodeModal);
  startEpisodeTicker();

  try {
    const response = await request("startEpisode", { started_at: active.started_at });
    if (response?.event?.id) {
      active.event_id = response.event.id;
      storeActiveEpisode(active);
    }
  } catch (error) {
    if (error.status === 401) handleAuthFailure("设备验证已失效，计时仍保留在本机。");
    else showToast("计时已开始，网络恢复后再保存");
  }
}

function showEpisodeFinish() {
  stopEpisodeTicker();
  dom.episodeTimerView.hidden = true;
  dom.episodeFinishForm.hidden = false;
  restoreEpisodeDraft();
}

function collectEpisodeFinish() {
  const impact = getRadioValue(dom.episodeFinishForm, "episode_impact") || "control_ok";
  const finishedAt = new Date().toISOString();
  return {
    event_id: state.activeEpisode?.event_id || null,
    started_at: state.activeEpisode?.started_at || finishedAt,
    finished_at: finishedAt,
    duration_seconds: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(state.activeEpisode?.started_at || finishedAt)) / 1000),
    ),
    episode_impact: impact,
    control_affected: impact === "control_affected",
    source_kind: "episode_mode",
    source_ref: "website:episode-timer",
    notes: valueOf(dom.episodeFinishForm, "notes").trim(),
  };
}

function collectEpisodeDraft() {
  saveJson(STORAGE_KEYS.episodeDraft, {
    episode_impact: getRadioValue(dom.episodeFinishForm, "episode_impact") || "control_ok",
    notes: valueOf(dom.episodeFinishForm, "notes"),
  });
}

function restoreEpisodeDraft() {
  const draft = readJson(STORAGE_KEYS.episodeDraft, null);
  if (!draft) return;
  setRadio(dom.episodeFinishForm, "episode_impact", draft.episode_impact || "control_ok");
  setValue(dom.episodeFinishForm, "notes", draft.notes || "");
}

function resetEpisodeState() {
  stopEpisodeTicker();
  storeActiveEpisode(null);
  localStorage.removeItem(STORAGE_KEYS.episodeDraft);
  dom.episodeFinishForm.reset();
}

async function finishEpisode(event) {
  event.preventDefault();
  const payload = collectEpisodeFinish();
  setBusy(dom.saveEpisodeButton, true, "保存中");
  try {
    const dashboard = await request("finishEpisode", payload);
    resetEpisodeState();
    renderDashboard(dashboard);
    closeModal(dom.episodeModal);
    showToast("这次发作已保存");
  } catch (error) {
    enqueuePending("finishEpisode", payload);
    resetEpisodeState();
    closeModal(dom.episodeModal);
    if (error.status === 401) handleAuthFailure("设备验证已失效，发作记录已暂存。");
    else showToast("网络不可用，发作记录已暂存在本机");
  } finally {
    setBusy(dom.saveEpisodeButton, false, "保存中");
  }
}

function enqueuePending(action, payload) {
  state.queue.push({
    id: crypto.randomUUID(),
    action,
    payload,
    created_at: new Date().toISOString(),
  });
  saveJson(STORAGE_KEYS.pendingQueue, state.queue);
}

async function flushQueue() {
  if (!state.token || !navigator.onLine || !state.queue.length) return;
  const remaining = [];
  for (const item of state.queue) {
    try {
      const response = await request(item.action, item.payload);
      if (response?.guidance) state.dashboard = response;
    } catch (error) {
      remaining.push(item);
      if (error.status === 401) break;
    }
  }
  state.queue = remaining;
  saveJson(STORAGE_KEYS.pendingQueue, remaining);
  if (state.dashboard) renderDashboard(state.dashboard);
}

async function loginDevice(password) {
  const normalized = String(password || "").trim();
  if (!normalized) {
    setText(dom.loginStatus, "请输入网站密码。");
    return;
  }
  setBusy(dom.loginButton, true, "验证中");
  try {
    const response = await request(
      "loginDevice",
      { sitePassword: normalized },
      { useAuth: false },
    );
    if (!response.device_token) throw new Error("没有收到可信设备令牌");
    storeAuth(response.device_token, response.trusted_device_expires_at || "");
    renderDashboard(response.dashboard);
    dom.loginPassword.value = "";
    await flushQueue();
    showToast("这台设备已被记住");
  } catch (error) {
    setText(dom.loginStatus, error.status === 401 ? "密码不正确。" : "暂时无法登录，请稍后重试。");
  } finally {
    setBusy(dom.loginButton, false, "验证中");
  }
}

function handleAuthFailure(message) {
  clearAuth();
  document.body.classList.add("locked");
  setText(dom.loginStatus, message);
}

async function bootstrapDashboard(allowCache = true) {
  if (!state.token) {
    document.body.classList.add("locked");
    return;
  }
  if (state.isBooting) return;
  state.isBooting = true;
  try {
    const dashboard = await request("bootstrapDashboard");
    if (dashboard.trusted_device_expires_at) {
      storeAuth(state.token, dashboard.trusted_device_expires_at);
    }
    renderDashboard(dashboard);
    await flushQueue();
  } catch (error) {
    if (error.status === 401) {
      handleAuthFailure("这台设备需要重新验证。");
    } else if (allowCache && state.dashboard) {
      renderDashboard(state.dashboard);
      setText(dom.deviceStatus, "离线缓存");
      showToast("暂时无法连接云端，正在显示本机缓存");
    } else {
      handleAuthFailure("暂时无法读取数据，请检查网络。");
    }
  } finally {
    state.isBooting = false;
  }
}

async function refreshDevice() {
  setBusy(dom.syncButton, true, "…");
  try {
    const response = await request("refreshDevice");
    if (response.trusted_device_expires_at) {
      storeAuth(state.token, response.trusted_device_expires_at);
    }
    renderDashboard(response.dashboard || response);
    await flushQueue();
    showToast("已刷新");
  } catch (error) {
    if (error.status === 401) handleAuthFailure("这台设备需要重新验证。");
    else showToast("刷新失败");
  } finally {
    setBusy(dom.syncButton, false, "…");
  }
}

async function logoutDevice() {
  setBusy(dom.logoutButton, true, "…");
  try {
    if (state.token) await request("logoutDevice").catch(() => {});
  } finally {
    clearAuth();
    document.body.classList.add("locked");
    setText(dom.loginStatus, "当前设备已退出。");
    setBusy(dom.logoutButton, false, "…");
  }
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginDevice(dom.loginPassword.value);
  });
  dom.checkinButton.addEventListener("click", openCheckinModal);
  dom.episodeButton.addEventListener("click", startEpisode);
  dom.checkinForm.addEventListener("submit", saveCheckin);
  dom.checkinForm.addEventListener("input", collectCheckinDraft);
  dom.checkinForm.addEventListener("change", collectCheckinDraft);
  dom.episodeFinishForm.addEventListener("submit", finishEpisode);
  dom.episodeFinishForm.addEventListener("input", collectEpisodeDraft);
  dom.episodeFinishForm.addEventListener("change", collectEpisodeDraft);
  dom.finishEpisodeButton.addEventListener("click", showEpisodeFinish);
  dom.resumeEpisodeButton.addEventListener("click", () => {
    dom.episodeTimerView.hidden = false;
    dom.episodeFinishForm.hidden = true;
    startEpisodeTicker();
  });
  dom.minimizeEpisode.addEventListener("click", () => closeModal(dom.episodeModal));
  dom.syncButton.addEventListener("click", refreshDevice);
  dom.logoutButton.addEventListener("click", logoutDevice);
  $$(".close-modal").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
  });
  window.addEventListener("online", () => {
    flushQueue();
    bootstrapDashboard(true);
  });
  window.addEventListener("beforeunload", () => {
    if (!dom.checkinModal.hidden) collectCheckinDraft();
    if (!dom.episodeFinishForm.hidden) collectEpisodeDraft();
  });
}

function cacheDom() {
  [
    "loginForm",
    "loginPassword",
    "loginButton",
    "loginStatus",
    "todayLabel",
    "deviceStatus",
    "syncButton",
    "logoutButton",
    "guidanceState",
    "guidanceTitle",
    "guidanceFocus",
    "guidanceRationale",
    "actionSteps",
    "avoidList",
    "safetyNote",
    "lastSynced",
    "checkinButton",
    "episodeButton",
    "checkinModal",
    "checkinForm",
    "saveCheckinButton",
    "episodeModal",
    "episodeTimerView",
    "episodeTimer",
    "episodeFinishForm",
    "finishEpisodeButton",
    "resumeEpisodeButton",
    "saveEpisodeButton",
    "minimizeEpisode",
    "toast",
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

async function init() {
  cacheDom();
  bindEvents();
  if (state.dashboard) renderDashboard(state.dashboard);
  if (state.activeEpisode) {
    setText(dom.episodeButton, "继续发作计时");
  }
  await bootstrapDashboard(true);
}

init();
