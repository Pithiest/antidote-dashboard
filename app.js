const API_URL = "https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api";

const STORAGE_KEYS = {
  deviceToken: "antidote.deviceToken.v3",
  deviceExpiry: "antidote.deviceExpiry.v3",
  dashboardCache: "antidote.dashboardCache.v10",
  pendingQueue: "antidote.pendingQueue.v4",
  activeEpisode: "antidote.activeEpisode.v4",
  checkinDraft: "antidote.checkinDraft.v3",
  episodeDraft: "antidote.episodeDraft.v1",
};

const MODE_LABELS = {
  stabilize: "先稳住",
  maintain: "保持节奏",
  progress: "可以小步推进",
  reassess: "需要重新评估",
};

const MODE_CLASSES = ["mode-stabilize", "mode-maintain", "mode-progress", "mode-reassess"];

const ACTION_ICONS = ["wind", "footprints", "target", "clipboard-check"];

const EPISODE_PHASES = [
  {
    title: "先稳住",
    detail: "先停下或坐稳，不继续硬撑骑行或站立。",
  },
  {
    title: "固定视线",
    detail: "看住前方一个固定点，避免低头盯右腿。",
  },
  {
    title: "拉长呼吸",
    detail: "吸气 3 秒，呼气 6 秒，连续做 2 轮。",
  },
  {
    title: "轻点地面",
    detail: "双脚交替轻点地，动作小而均匀。",
  },
  {
    title: "确认落脚",
    detail: "右脚全脚掌慢慢落地，再决定是否继续移动。",
  },
];

const ICONS = {
  refresh: iconSvg(`
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v6h-6" />
  `),
  logout: iconSvg(`
    <path d="M10 16l-4-4 4-4" />
    <path d="M6 12h10" />
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
  `),
  activity: iconSvg(`
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  `),
  edit: iconSvg(`
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  `),
  ban: iconSvg(`
    <circle cx="12" cy="12" r="9" />
    <path d="M7.8 7.8l8.4 8.4" />
  `),
  chart: iconSvg(`
    <path d="M4 19V5" />
    <path d="M8 19v-8" />
    <path d="M12 19v-5" />
    <path d="M16 19V9" />
    <path d="M20 19" />
  `),
  eye: iconSvg(`
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  `),
  arrowRight: iconSvg(`
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  `),
  close: iconSvg(`
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  `),
  minus: iconSvg(`
    <path d="M5 12h14" />
  `),
  wind: iconSvg(`
    <path d="M4 8h7a3 3 0 1 0-3-3" />
    <path d="M4 12h11a3 3 0 1 1-3 3" />
    <path d="M4 16h5" />
  `),
  footprints: iconSvg(`
    <path d="M8 5c1.2 0 2 .8 2 2.1v4.8c0 2-1.3 3.6-3 3.6s-3-1.6-3-3.6V7.1C4 5.8 4.8 5 6 5h2Z" />
    <path d="M14 9c1.2 0 2 .8 2 2.1v4.8c0 2-1.3 3.6-3 3.6s-3-1.6-3-3.6v-4.8C10 9.8 10.8 9 12 9h2Z" />
  `),
  target: iconSvg(`
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  `),
  clipboardCheck: iconSvg(`
    <path d="M9 4h6l1 2h3v14H5V6h3l1-2Z" />
    <path d="M9 13l2 2 4-4" />
  `),
  shieldCheck: iconSvg(`
    <path d="M12 3 5 6v5c0 4.6 2.9 8.9 7 10 4.1-1.1 7-5.4 7-10V6l-7-3Z" />
    <path d="M9.5 12.5 11.5 14.5 15 10.5" />
  `),
  alert: iconSvg(`
    <path d="M10.3 4.1 1.8 18a1.2 1.2 0 0 0 1 1.9h18.4a1.2 1.2 0 0 0 1-1.9L13.7 4.1a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 16h.01" />
  `),
  clock: iconSvg(`
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  `),
  check: iconSvg(`
    <path d="m5 12 4 4L19 6" />
  `),
  spark: iconSvg(`
    <path d="M13 2 8 13h5l-1 9 8-12h-5l1-8z" />
  `),
  circle: iconSvg(`
    <circle cx="12" cy="12" r="8" />
  `),
};

const state = {
  dashboard: readJson(STORAGE_KEYS.dashboardCache, null),
  token: localStorage.getItem(STORAGE_KEYS.deviceToken) || "",
  tokenExpiry: localStorage.getItem(STORAGE_KEYS.deviceExpiry) || "",
  queue: readJson(STORAGE_KEYS.pendingQueue, []),
  activeEpisode: readJson(STORAGE_KEYS.activeEpisode, null),
  isBooting: false,
};

const dom = {};
let toastTimer = null;
let episodeTimer = null;
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

function removeStorage(keys) {
  for (const key of keys) localStorage.removeItem(key);
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatTime(dateLike) {
  if (!dateLike) return "--";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(dateLike) {
  if (!dateLike) return "--";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatExpiryLabel(dateLike) {
  if (!dateLike) return "未设置";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function iconSvg(paths, viewBox = "0 0 24 24") {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function iconMarkup(name) {
  return `<span class="icon" data-icon="${name}">${ICONS[name] || ICONS.circle}</span>`;
}

function syncIcons(root = document) {
  $$(".icon[data-icon]", root).forEach((el) => {
    const name = el.dataset.icon || "circle";
    el.innerHTML = ICONS[name] || ICONS.circle;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setText(selector, value, root = document) {
  const el = $(selector, root);
  if (el) el.textContent = value;
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const span = button.querySelector("span:last-child");
  if (span && label) span.textContent = label;
}

function showToast(message, tone = "neutral") {
  const toast = dom.toast;
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function clearDashboardCache() {
  state.dashboard = null;
  localStorage.removeItem(STORAGE_KEYS.dashboardCache);
}

function clearAuth() {
  state.token = "";
  state.tokenExpiry = "";
  removeStorage([STORAGE_KEYS.deviceToken, STORAGE_KEYS.deviceExpiry]);
}

function storeAuth(token, expiry) {
  state.token = token;
  state.tokenExpiry = expiry || "";
  localStorage.setItem(STORAGE_KEYS.deviceToken, token);
  localStorage.setItem(STORAGE_KEYS.deviceExpiry, expiry || "");
}

function storeActiveEpisode(value) {
  state.activeEpisode = value;
  if (value) saveJson(STORAGE_KEYS.activeEpisode, value);
  else localStorage.removeItem(STORAGE_KEYS.activeEpisode);
}

function storeQueue(queue) {
  state.queue = queue;
  saveJson(STORAGE_KEYS.pendingQueue, queue);
}

function getQueue() {
  return Array.isArray(state.queue) ? state.queue : [];
}

function enqueuePending(action, payload) {
  const queue = getQueue();
  queue.push({
    action,
    payload,
    queued_at: new Date().toISOString(),
  });
  storeQueue(queue);
}

function uniqueQueued(queue) {
  const seen = new Set();
  return queue.filter((item) => {
    const key = `${item.action}:${JSON.stringify(item.payload)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeErrorMessage(message) {
  return String(message || "请求失败").replace(/\s+/g, " ").trim();
}

async function request(action, payload = {}, { useAuth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (useAuth && state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(normalizeErrorMessage(data.error || `请求失败 (${response.status})`));
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function renderStaticCopy() {
  document.title = "Antidote · 行动指令台";
  const metaDescription = $('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute(
      "content",
      "Antidote 私人行动指令台，聚焦今天做什么、发作时做什么、今天避免什么。",
    );
  }

  setText(".auth-copy p", "私人康复指挥台");
  setText(".brand-copy p", "私人康复指挥台");
  setText("#loginStatus", "陌生设备首次输入网站密码后会记住这台设备。");
  setText(".auth-submit span", "进入指挥台");
  setText(".topbar .brand-copy p", "私人康复指挥台");
  setText(".primary-panel .section-label", "今天只做这一件");
  setText(".side-rail .rail-panel:nth-of-type(1) h2", "今天避免");
  setText(".side-rail .rail-panel:nth-of-type(2) h2", "当前判断");
  setText(".side-rail .rail-panel:nth-of-type(3) h2", "下一次只观察");
  setText("#reviewPrompt strong", "长期基线可能已经变化");
  setText("#reviewPrompt p", "近期趋势已经接近复盘门槛，建议完整复述一次症状和变化。");
  if (dom.reviewButton) {
    dom.reviewButton.innerHTML = `开始完整复述 ${iconMarkup("arrowRight")}`;
    syncIcons(dom.reviewButton);
  }
  setText("#checkinTitle", "今天有什么变化");
  setText("#checkinForm .section-label", "约 20 秒");
  setText("#checkinForm .modal-actions .secondary", "取消");
  setText("#saveCheckinButton span", "保存变化");
  setText("#episodeTitle", "先停下或坐稳");
  setText("#episodeInstruction", "不要继续硬撑骑行或站立，先把自己放到安全位置。");
  setText("#episodeButton span:last-child", "我现在在发作");
  setText("#checkinButton span:last-child", "填写今日变化");
  setText("#logoutButton span:last-child", "退出");
  setText("#syncButton span:last-child", "刷新");
  setText("#deviceStatus", "陌生设备需要密码");
  setText(".footer-bar span:last-child", "发作时先安全停下，避免摔倒或硬撑骑行。");
  setText("#lastSynced", "--");
  setText("#baselineCount", "0/7 个有效日");
  setText("#recentEpisodeCount", "近 7 天 0 次发作");
  setText("#trendMessage", "数据仍在建立基线");
  setText("#nextCheck", "等今天的记录回来以后，再看下一步。");
  setText("#guidanceTitle", "正在读取今日指令");
  setText("#guidanceState", "同步中");
  setText("#guidanceFocus", "稍等一下，指令会根据最新记录自动生成。");
  setText("#guidanceRationale", "");
  setText("#safetyNote", "发作时优先安全停下，避免摔倒或硬撑骑行。");
  setText(".episode-caption", "先保证安全，再继续当前这一步。");

  const episodeProgress = $("#episodeProgress");
  if (episodeProgress) {
    episodeProgress.innerHTML = ["稳住", "定点", "呼吸", "点地", "落脚"]
      .map((text, index) => `<li class="${index === 0 ? "active" : ""}">${escapeHtml(text)}</li>`)
      .join("");
  }
}

function renderActionList(steps = []) {
  const list = dom.actionSteps;
  if (!list) return;
  if (!steps.length) {
    list.innerHTML = `
      <li class="action-step">
        <span class="step-index">00</span>
        <span class="step-icon">${iconMarkup("spark")}</span>
        <div class="step-copy">
          <strong>正在读取今日指令</strong>
          <p>登录后会自动根据最新记录生成今天该做什么。</p>
        </div>
        <span class="step-time">--</span>
      </li>
    `;
    syncIcons(list);
    return;
  }

  list.innerHTML = steps
    .map((step, index) => {
      const iconName = ACTION_ICONS[index] || "clipboard-check";
      return `
        <li class="action-step">
          <span class="step-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="step-icon">${iconMarkup(iconName)}</span>
          <div class="step-copy">
            <strong>${escapeHtml(step.title || `步骤 ${index + 1}`)}</strong>
            <p>${escapeHtml(step.detail || "")}</p>
          </div>
          <span class="step-time">${escapeHtml(step.time || "")}</span>
        </li>
      `;
    })
    .join("");
  syncIcons(list);
}

function renderAvoidList(items = []) {
  const list = dom.avoidList;
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<li>正在等待今天的记录。</li>`;
    return;
  }
  list.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function updateDeviceChip(message) {
  if (!dom.deviceStatus) return;
  dom.deviceStatus.textContent = message;
}

function setMode(mode) {
  MODE_CLASSES.forEach((className) => document.body.classList.remove(className));
  document.body.classList.add(`mode-${mode}`);
}

function renderDashboard(dashboard) {
  if (!dashboard) {
    renderStaticCopy();
    return;
  }

  state.dashboard = dashboard;
  saveJson(STORAGE_KEYS.dashboardCache, dashboard);

  const guidance = dashboard.guidance || {};
  const trend = dashboard.trend || {};
  const mode = guidance.mode || "maintain";
  const modeLabel = MODE_LABELS[mode] || "保持节奏";

  setMode(mode);
  setText("#todayLabel", formatDate(new Date(`${dashboard.today || todayLocal()}T12:00:00+08:00`)));
  setText("#guidanceTitle", guidance.title || modeLabel);
  setText("#guidanceState", modeLabel);
  setText("#guidanceFocus", guidance.focus || "今天先保持稳定，不加量。");
  setText("#guidanceRationale", guidance.rationale || "");
  setText("#nextCheck", guidance.next_check || "下一次只观察现在这套流程是否有效。");
  setText("#safetyNote", guidance.safety_note || "发作时先安全停下，避免摔倒或硬撑骑行。");
  setText("#trendMessage", trend.message || "数据仍在建立基线");
  setText("#baselineCount", `${trend.sample_count || 0}/${trend.required_count || 7} 个有效日`);
  setText("#recentEpisodeCount", `近 7 天 ${dashboard.recent_episode_count || 0} 次发作`);
  setText("#lastSynced", `已同步 ${formatTime(dashboard.synced_at)}`);
  setText("#deviceStatus", state.token ? "云端已同步" : "陌生设备需要密码");

  const fill = $("#baselineFill");
  if (fill) {
    const sampleCount = Number(trend.sample_count || 0);
    const requiredCount = Number(trend.required_count || 7);
    const percent = requiredCount > 0 ? Math.min(100, (sampleCount / requiredCount) * 100) : 0;
    fill.style.width = `${percent}%`;
  }

  const reviewPrompt = dom.reviewPrompt;
  if (reviewPrompt) reviewPrompt.hidden = !guidance.review_due;

  renderActionList(guidance.steps || []);
  renderAvoidList(guidance.avoid || []);
  updateGuidanceStateCopy(mode, trend);
  populateCheckinForm(dashboard.today_entry || null);
  syncIcons(document);
  updateButtonsEnabled(true);
  document.body.classList.remove("locked");
}

function updateGuidanceStateCopy(mode, trend) {
  const label = MODE_LABELS[mode] || "保持节奏";
  if (dom.guidanceState) dom.guidanceState.textContent = label;
  if (trend && typeof trend.improvement_percent === "number" && trend.sample_count >= 7) {
    const direction = trend.improvement_percent >= 0 ? "改善" : "加重";
    const percentLabel = formatPercent(trend.improvement_percent);
    const text = trend.review_due
      ? `${direction} ${percentLabel}，可以安排一次完整症状复述。`
      : `${direction} ${percentLabel}，继续维持当前节奏。`;
    if (dom.trendMessage) dom.trendMessage.textContent = text;
  }
  if (trend && trend.sample_count < 7 && dom.trendMessage) {
    dom.trendMessage.textContent = "数据仍在建立基线";
  }
}

function populateCheckinForm(entry) {
  const form = dom.checkinForm;
  if (!form) return;

  const draft = readTodayCheckinDraft() || {};
  const data = { ...(entry || {}), ...(draft || {}) };

  setRadio(form, "baseline_change", data.baseline_change || "same");
  setRange(form, "walking_discomfort", data.walking_discomfort ?? 4);
  setRange(form, "right_foot_control", data.right_foot_control ?? 4);
  setRadio(form, "had_episode", data.had_episode || (Number(data.episode_minutes || 0) > 0 ? "yes" : "no"));
  setNumber(form, "episode_minutes", data.episode_minutes ?? "");
  setRange(form, "episode_peak_intensity", data.episode_peak_intensity ?? 5);
  setRadio(form, "protocol_response", data.protocol_response || "not_used");
  setCheckboxes("#triggerChoices input", data.trigger_tags || []);
  setCheckbox(dom.baselineChanged, Boolean(data.baseline_symptoms_changed));
  setRange(form, "right_hip_external_rotation_pain", data.right_hip_external_rotation_pain ?? 5);
  setRange(form, "right_lower_leg_electric", data.right_lower_leg_electric ?? 3);
  setRange(form, "inner_thigh_acid", data.inner_thigh_acid ?? 4);
  setValue(form, "hip_snap_change", data.hip_snap_change || "");
  setValue(form, "notes", data.notes || "");

  if (data.baseline_symptoms_changed) {
    dom.baselineChangeFields.hidden = false;
  }
  updateConditionalFields();
  updateRangeOutputs(form);
}

function setCheckbox(el, checked) {
  if (el) el.checked = checked;
}

function setRadio(form, name, value) {
  if (!form) return;
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
  if (input) input.checked = true;
}

function setRange(form, name, value) {
  if (!form) return;
  const input = form.querySelector(`input[name="${name}"]`);
  if (!input) return;
  input.value = String(value);
}

function setNumber(form, name, value) {
  if (!form) return;
  const input = form.querySelector(`input[name="${name}"]`);
  if (!input) return;
  input.value = value === null || value === undefined ? "" : String(value);
}

function setValue(form, name, value) {
  if (!form) return;
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) return;
  input.value = value ?? "";
}

function setCheckboxes(selector, values = []) {
  const set = new Set(values.map((value) => String(value)));
  $$(selector).forEach((input) => {
    input.checked = set.has(input.value);
  });
}

function collectCheckin() {
  const form = dom.checkinForm;
  const hadEpisode = getRadioValue(form, "had_episode") === "yes";
  const baselineChanged = dom.baselineChanged?.checked || false;
  const triggerTags = checkedValues("#triggerChoices input");

  const checkin = {
    entry_date: todayLocal(),
    baseline_change: getRadioValue(form, "baseline_change") || "same",
    walking_discomfort: numberValue(form, "walking_discomfort", 0, 10, 4),
    right_foot_control: numberValue(form, "right_foot_control", 0, 10, 4),
    had_episode: hadEpisode,
    episode_minutes: hadEpisode ? optionalNumberValue(form, "episode_minutes", 0, 999) : null,
    episode_peak_intensity: hadEpisode ? numberValue(form, "episode_peak_intensity", 0, 10, 5) : 0,
    trigger_tags: triggerTags,
    protocol_response: getRadioValue(form, "protocol_response") || "not_used",
    e_bike: triggerTags.includes("骑行"),
    urgent_wake: triggerTags.includes("紧急叫起"),
    handlebar_unstable: triggerTags.includes("车把不稳"),
    stop_after_activity_trigger: triggerTags.some((value) => ["静止到活动", "活动到静止", "活动切换"].includes(value)),
    baseline_symptoms_changed: baselineChanged,
    right_hip_external_rotation_pain: baselineChanged
      ? numberValue(form, "right_hip_external_rotation_pain", 0, 10, 5)
      : null,
    right_lower_leg_electric: baselineChanged ? numberValue(form, "right_lower_leg_electric", 0, 10, 3) : null,
    inner_thigh_acid: baselineChanged ? numberValue(form, "inner_thigh_acid", 0, 10, 4) : null,
    hip_snap_change: baselineChanged ? valueOf(form, "hip_snap_change").trim() : "",
    notes: valueOf(form, "notes").trim(),
  };

  return checkin;
}

function getRadioValue(form, name) {
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function valueOf(form, name) {
  const input = form.querySelector(`[name="${name}"]`);
  return input ? input.value : "";
}

function numberValue(form, name, min, max, fallback) {
  const input = form.querySelector(`[name="${name}"]`);
  const numeric = Number(input?.value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function optionalNumberValue(form, name, min, max) {
  const input = form.querySelector(`[name="${name}"]`);
  if (!input || input.value.trim() === "") return null;
  const numeric = Number(input.value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, numeric));
}

function checkedValues(selector) {
  return $$(selector)
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function updateConditionalFields() {
  if (!dom.checkinForm) return;
  const hadEpisode = getRadioValue(dom.checkinForm, "had_episode") === "yes";
  const baselineChanged = dom.baselineChanged?.checked || false;

  if (dom.episodeFields) dom.episodeFields.hidden = !hadEpisode;
  if (dom.baselineChangeFields) dom.baselineChangeFields.hidden = !baselineChanged;
}

function updateRangeOutputs(form = document) {
  const bindings = [
    ["walking_discomfort", "#walkingValue"],
    ["right_foot_control", "#footValue"],
    ["episode_peak_intensity", "#intensityValue"],
    ["right_hip_external_rotation_pain", "#hipValue"],
    ["right_lower_leg_electric", "#electricValue"],
    ["inner_thigh_acid", "#innerThighValue"],
    ["peak_intensity", "#episodePeakValue"],
  ];
  bindings.forEach(([name, selector]) => {
    const input = form.querySelector(`input[name="${name}"]`);
    const output = $(selector, form) || $(selector);
    if (input && output) output.textContent = input.value;
  });
}

function openModal(modal) {
  const el = typeof modal === "string" ? $(modal) : modal;
  if (!el) return;
  lastFocused = document.activeElement;
  el.hidden = false;
  document.body.classList.add("modal-open");
  const focusable = el.querySelector("button, input, textarea, [tabindex]:not([tabindex='-1'])");
  focusable?.focus();
}

function closeModal(modal) {
  const el = typeof modal === "string" ? $(modal) : modal;
  if (!el) return;
  el.hidden = true;
  if (!$(".modal-backdrop:not([hidden]), .episode-overlay:not([hidden])")) {
    document.body.classList.remove("modal-open");
  }
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
}

function renderEpisodeState() {
  const modal = dom.episodeModal;
  if (!modal || !state.activeEpisode) return;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(state.activeEpisode.started_at)) / 1000));
  const remaining = Math.max(0, 90 - elapsedSeconds);
  const phaseIndex = Math.min(EPISODE_PHASES.length - 1, Math.floor(Math.min(elapsedSeconds, 89) / 18));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  setText("#episodeTimer", `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
  setText("#episodeTitle", EPISODE_PHASES[phaseIndex].title);
  setText("#episodeInstruction", EPISODE_PHASES[phaseIndex].detail);

  $$("#episodeProgress li").forEach((item, index) => {
    item.classList.toggle("active", index === phaseIndex);
    item.classList.toggle("complete", index < phaseIndex);
  });

  if (remaining === 0 && dom.episodeTimerView && dom.episodeFinishForm.hidden) {
    dom.episodeTimerView.hidden = true;
    dom.episodeFinishForm.hidden = false;
    updateRangeOutputs(dom.episodeFinishForm);
  }
}

function startEpisodeTicker() {
  clearInterval(episodeTimer);
  episodeTimer = setInterval(() => {
    if (!state.activeEpisode) {
      clearInterval(episodeTimer);
      episodeTimer = null;
      return;
    }
    renderEpisodeState();
  }, 1000);
}

function stopEpisodeTicker() {
  clearInterval(episodeTimer);
  episodeTimer = null;
}

async function startEpisode() {
  if (state.activeEpisode) {
    openModal(dom.episodeModal);
    dom.episodeTimerView.hidden = false;
    dom.episodeFinishForm.hidden = true;
    startEpisodeTicker();
    renderEpisodeState();
    showToast("发作模式已继续");
    return;
  }

  state.activeEpisode = {
    event_id: null,
    started_at: new Date().toISOString(),
  };
  storeActiveEpisode(state.activeEpisode);

  openModal(dom.episodeModal);
  dom.episodeTimerView.hidden = false;
  dom.episodeFinishForm.hidden = true;
  startEpisodeTicker();
  renderEpisodeState();

  try {
    const response = await request("startEpisode", { started_at: state.activeEpisode.started_at });
    if (response?.event?.id) {
      state.activeEpisode.event_id = response.event.id;
      storeActiveEpisode(state.activeEpisode);
    }
  } catch (error) {
    if (error.status === 401) {
      queueCurrentEpisode();
      handleAuthFailure("设备已失效，发作记录已暂存");
      return;
    }
    showToast("发作计时已开始，结束时会继续保存");
  }
}

function queueCurrentEpisode() {
  if (!state.activeEpisode) return;
  const payload = collectEpisodeFinish();
  enqueuePending("finishEpisode", payload);
}

function collectEpisodeFinish() {
  const form = dom.episodeFinishForm;
  return {
    event_id: state.activeEpisode?.event_id || null,
    started_at: state.activeEpisode?.started_at || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_seconds: Math.max(0, Math.floor((Date.now() - Date.parse(state.activeEpisode?.started_at || new Date().toISOString())) / 1000)),
    trigger_tags: checkedValues("#episodeTriggerChoices input"),
    peak_intensity: numberValue(form, "peak_intensity", 0, 10, 5),
    right_foot_affected: form.querySelector('[name="right_foot_affected"]')?.checked || false,
    right_hand_affected: form.querySelector('[name="right_hand_affected"]')?.checked || false,
    protocol_response: getRadioValue(form, "protocol_response") || "helped",
    notes: valueOf(form, "notes").trim(),
  };
}

async function finishEpisode(event) {
  event.preventDefault();
  const button = dom.saveEpisodeButton;
  const payload = collectEpisodeFinish();
  setBusy(button, true, "保存中");

  try {
    const response = await request("finishEpisode", payload);
    state.dashboard = response;
    saveJson(STORAGE_KEYS.dashboardCache, response);
    showToast("这次发作已经保存");
    clearEpisodeState();
    renderDashboard(response);
    closeModal(dom.episodeModal);
  } catch (error) {
    enqueuePending("finishEpisode", payload);
    if (error.status === 401) {
      clearEpisodeState();
      handleAuthFailure("设备已失效，这次发作已暂存");
    } else {
      showToast("网络暂时不可用，这次发作已先存到本机");
      clearEpisodeState();
      closeModal(dom.episodeModal);
    }
  } finally {
    setBusy(button, false, "保存这次发作");
    stopEpisodeTicker();
    resetEpisodeForm();
  }
}

function clearEpisodeState() {
  storeActiveEpisode(null);
  stopEpisodeTicker();
}

function resetEpisodeForm() {
  if (!dom.episodeFinishForm) return;
  dom.episodeFinishForm.reset();
  updateRangeOutputs(dom.episodeFinishForm);
  saveJson(STORAGE_KEYS.episodeDraft, {});
}

function collectEpisodeDraft() {
  if (!dom.episodeFinishForm) return;
  const draft = {
    peak_intensity: valueOf(dom.episodeFinishForm, "peak_intensity"),
    right_foot_affected: dom.episodeFinishForm.querySelector('[name="right_foot_affected"]')?.checked || false,
    right_hand_affected: dom.episodeFinishForm.querySelector('[name="right_hand_affected"]')?.checked || false,
    protocol_response: getRadioValue(dom.episodeFinishForm, "protocol_response") || "helped",
    notes: valueOf(dom.episodeFinishForm, "notes"),
  };
  saveJson(STORAGE_KEYS.episodeDraft, draft);
}

function restoreEpisodeDraft() {
  const draft = readJson(STORAGE_KEYS.episodeDraft, null);
  if (!draft || !dom.episodeFinishForm) return;
  if (draft.peak_intensity !== undefined) setValue(dom.episodeFinishForm, "peak_intensity", draft.peak_intensity);
  if (draft.right_foot_affected !== undefined) dom.episodeFinishForm.querySelector('[name="right_foot_affected"]').checked = draft.right_foot_affected;
  if (draft.right_hand_affected !== undefined) dom.episodeFinishForm.querySelector('[name="right_hand_affected"]').checked = draft.right_hand_affected;
  if (draft.protocol_response) setRadio(dom.episodeFinishForm, "protocol_response", draft.protocol_response);
  if (draft.notes !== undefined) setValue(dom.episodeFinishForm, "notes", draft.notes);
  updateRangeOutputs(dom.episodeFinishForm);
}

function collectCheckinDraft() {
  if (!dom.checkinForm) return;
  const draft = {
    entry_date: todayLocal(),
    baseline_change: getRadioValue(dom.checkinForm, "baseline_change") || "same",
    walking_discomfort: valueOf(dom.checkinForm, "walking_discomfort"),
    right_foot_control: valueOf(dom.checkinForm, "right_foot_control"),
    had_episode: getRadioValue(dom.checkinForm, "had_episode") || "no",
    episode_minutes: valueOf(dom.checkinForm, "episode_minutes"),
    episode_peak_intensity: valueOf(dom.checkinForm, "episode_peak_intensity"),
    trigger_tags: checkedValues("#triggerChoices input"),
    protocol_response: getRadioValue(dom.checkinForm, "protocol_response") || "not_used",
    baseline_symptoms_changed: dom.baselineChanged?.checked || false,
    right_hip_external_rotation_pain: valueOf(dom.checkinForm, "right_hip_external_rotation_pain"),
    right_lower_leg_electric: valueOf(dom.checkinForm, "right_lower_leg_electric"),
    inner_thigh_acid: valueOf(dom.checkinForm, "inner_thigh_acid"),
    hip_snap_change: valueOf(dom.checkinForm, "hip_snap_change"),
    notes: valueOf(dom.checkinForm, "notes"),
  };
  saveJson(STORAGE_KEYS.checkinDraft, draft);
}

function readTodayCheckinDraft() {
  const draft = readJson(STORAGE_KEYS.checkinDraft, null);
  if (!draft) return null;
  if (draft.entry_date !== todayLocal()) {
    clearCheckinDraft();
    return null;
  }
  return draft;
}

function restoreCheckinDraft() {
  const draft = readTodayCheckinDraft();
  if (!draft || !dom.checkinForm) return;
  setRadio(dom.checkinForm, "baseline_change", draft.baseline_change || "same");
  setRange(dom.checkinForm, "walking_discomfort", draft.walking_discomfort ?? 4);
  setRange(dom.checkinForm, "right_foot_control", draft.right_foot_control ?? 4);
  setRadio(dom.checkinForm, "had_episode", draft.had_episode || "no");
  setNumber(dom.checkinForm, "episode_minutes", draft.episode_minutes ?? "");
  setRange(dom.checkinForm, "episode_peak_intensity", draft.episode_peak_intensity ?? 5);
  setCheckboxes("#triggerChoices input", draft.trigger_tags || []);
  setRadio(dom.checkinForm, "protocol_response", draft.protocol_response || "not_used");
  setCheckbox(dom.baselineChanged, Boolean(draft.baseline_symptoms_changed));
  setRange(dom.checkinForm, "right_hip_external_rotation_pain", draft.right_hip_external_rotation_pain ?? 5);
  setRange(dom.checkinForm, "right_lower_leg_electric", draft.right_lower_leg_electric ?? 3);
  setRange(dom.checkinForm, "inner_thigh_acid", draft.inner_thigh_acid ?? 4);
  setValue(dom.checkinForm, "hip_snap_change", draft.hip_snap_change || "");
  setValue(dom.checkinForm, "notes", draft.notes || "");
  updateConditionalFields();
  updateRangeOutputs(dom.checkinForm);
}

function clearCheckinDraft() {
  localStorage.removeItem(STORAGE_KEYS.checkinDraft);
}

async function saveCheckin(event) {
  event.preventDefault();
  const button = dom.saveCheckinButton;
  const payload = collectCheckin();
  setBusy(button, true, "保存中");

  try {
    const response = await request("saveCheckin", { checkin: payload });
    state.dashboard = response;
    saveJson(STORAGE_KEYS.dashboardCache, response);
    clearCheckinDraft();
    renderDashboard(response);
    closeModal(dom.checkinModal);
    showToast("今天的变化已经保存");
    await flushQueue();
  } catch (error) {
    enqueuePending("saveCheckin", { checkin: payload });
    if (error.status === 401) {
      handleAuthFailure("设备已失效，今天的变化已暂存");
    } else {
      showToast("网络暂时不可用，今天的变化已先存到本机");
    }
    closeModal(dom.checkinModal);
  } finally {
    setBusy(button, false, "保存变化");
  }
}

async function loginDevice(password) {
  const normalized = String(password || "").trim();
  if (!normalized) {
    setText("#loginStatus", "请输入网站密码。");
    return;
  }

  const button = dom.loginButton;
  setBusy(button, true, "验证中");

  try {
    const response = await request("loginDevice", { sitePassword: normalized }, { useAuth: false });
    const token = response.device_token || "";
    const expiry = response.trusted_device_expires_at || "";
    if (!token) throw new Error("登录成功，但没有收到可信设备令牌");

    storeAuth(token, expiry);
    clearCheckinDraft();
    clearDashboardCache();
    state.dashboard = response.dashboard || null;
    renderDashboard(state.dashboard);
    await flushQueue();
    showToast("这台设备已被记住");
    setText("#loginStatus", "设备已记住，下次打开会自动恢复。");
    dom.loginPassword.value = "";
    dom.loginPassword.blur();
  } catch (error) {
    if (error.status === 401) {
      setText("#loginStatus", "密码不正确，请再试一次。");
    } else {
      setText("#loginStatus", error.message || "登录失败，请稍后重试。");
    }
  } finally {
    setBusy(button, false, "进入指挥台");
  }
}

async function bootstrapDashboard(allowCache = true) {
  if (!state.token) {
    document.body.classList.add("locked");
    renderStaticCopy();
    return;
  }

  if (state.isBooting) return;
  state.isBooting = true;
  setText("#loginStatus", "正在恢复可信设备...");
  updateDeviceChip("正在同步...");

  try {
    const response = await request("bootstrapDashboard");
    state.dashboard = response;
    saveJson(STORAGE_KEYS.dashboardCache, response);
    if (response.trusted_device_expires_at) {
      state.tokenExpiry = response.trusted_device_expires_at;
      localStorage.setItem(STORAGE_KEYS.deviceExpiry, response.trusted_device_expires_at);
    }
    renderDashboard(response);
    document.body.classList.remove("locked");
    await flushQueue();
    updateDeviceChip("云端已同步");
  } catch (error) {
    if (error.status === 401) {
      handleAuthFailure("设备已失效，请重新输入密码。");
      return;
    }

    if (allowCache && state.dashboard) {
      renderDashboard(state.dashboard);
      updateDeviceChip("离线缓存 · 等待重新同步");
      showToast("暂时连不上云端，正在显示本机缓存", "warning");
      document.body.classList.remove("locked");
    } else {
      setText("#loginStatus", "暂时无法恢复数据，请检查网络后重试。");
      document.body.classList.add("locked");
    }
  } finally {
    state.isBooting = false;
  }
}

async function refreshDevice() {
  if (!state.token) {
    handleAuthFailure("请先输入网站密码。");
    return;
  }

  const button = dom.syncButton;
  setBusy(button, true, "刷新中");
  try {
    const response = await request("refreshDevice");
    if (response.trusted_device_expires_at) {
      storeAuth(state.token, response.trusted_device_expires_at);
    }
    if (response.dashboard) {
      state.dashboard = response.dashboard;
      saveJson(STORAGE_KEYS.dashboardCache, response.dashboard);
      renderDashboard(response.dashboard);
    } else {
      await bootstrapDashboard(true);
    }
    updateDeviceChip("云端已同步");
    showToast("已经刷新云端数据");
  } catch (error) {
    if (error.status === 401) {
      handleAuthFailure("设备已失效，请重新输入密码。");
    } else {
      showToast("刷新失败，稍后再试");
    }
  } finally {
    setBusy(button, false, "刷新");
  }
}

async function logoutDevice() {
  const button = dom.logoutButton;
  setBusy(button, true, "退出中");
  try {
    if (state.token) {
      await request("logoutDevice").catch(() => {});
    }
  } finally {
    clearAuth();
    clearDashboardCache();
    clearCheckinDraft();
    clearEpisodeState();
    storeQueue([]);
    state.dashboard = null;
    renderStaticCopy();
    document.body.classList.add("locked");
    updateDeviceChip("陌生设备需要密码");
    setText("#loginStatus", "已经退出这台设备。");
    dom.loginPassword.focus();
    setBusy(button, false, "退出");
  }
}

function handleAuthFailure(message) {
  clearAuth();
  document.body.classList.add("locked");
  clearDashboardCache();
  updateDeviceChip("陌生设备需要密码");
  setText("#loginStatus", message);
  renderStaticCopy();
}

async function flushQueue() {
  const queue = uniqueQueued(getQueue());
  if (!queue.length) {
    storeQueue([]);
    return;
  }

  const remaining = [];
  for (const item of queue) {
    try {
      const response = await request(item.action, item.payload);
      if (item.action === "saveCheckin" || item.action === "save") {
        state.dashboard = response;
        saveJson(STORAGE_KEYS.dashboardCache, response);
        renderDashboard(response);
      } else if (item.action === "finishEpisode") {
        state.dashboard = response;
        saveJson(STORAGE_KEYS.dashboardCache, response);
        renderDashboard(response);
      }
    } catch (error) {
      remaining.push(item);
      if (error.status === 401) {
        handleAuthFailure("设备已失效，待同步内容已保留。");
        break;
      }
      break;
    }
  }

  storeQueue(remaining);
  if (!remaining.length) showToast("离线内容已同步完成");
}

function bindCheckinAutosave() {
  if (!dom.checkinForm) return;
  const saveDraft = () => {
    collectCheckinDraft();
    updateConditionalFields();
    updateRangeOutputs(dom.checkinForm);
  };

  dom.checkinForm.addEventListener("input", saveDraft);
  dom.checkinForm.addEventListener("change", saveDraft);
}

function bindEpisodeAutosave() {
  if (!dom.episodeFinishForm) return;
  const saveDraft = () => {
    collectEpisodeDraft();
    updateRangeOutputs(dom.episodeFinishForm);
  };
  dom.episodeFinishForm.addEventListener("input", saveDraft);
  dom.episodeFinishForm.addEventListener("change", saveDraft);
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginDevice(dom.loginPassword.value);
  });

  dom.syncButton.addEventListener("click", refreshDevice);
  dom.logoutButton.addEventListener("click", logoutDevice);
  dom.checkinButton.addEventListener("click", () => openCheckinModal(false));
  dom.reviewButton?.addEventListener("click", () => openCheckinModal(true));
  dom.episodeButton.addEventListener("click", startEpisode);
  dom.minimizeEpisode.addEventListener("click", () => closeModal(dom.episodeModal));
  dom.finishEpisodeButton.addEventListener("click", () => {
    dom.episodeTimerView.hidden = true;
    dom.episodeFinishForm.hidden = false;
    updateRangeOutputs(dom.episodeFinishForm);
  });
  dom.checkinForm.addEventListener("submit", saveCheckin);
  dom.episodeFinishForm.addEventListener("submit", finishEpisode);

  $$(".close-modal").forEach((button) => {
    button.addEventListener("click", () => closeModal(dom.checkinModal));
  });

  dom.checkinModal.addEventListener("click", (event) => {
    if (event.target === dom.checkinModal) closeModal(dom.checkinModal);
  });

  dom.episodeModal.addEventListener("click", (event) => {
    if (event.target === dom.episodeModal) closeModal(dom.episodeModal);
  });

  $$('input[name="had_episode"]').forEach((input) => input.addEventListener("change", updateConditionalFields));
  dom.baselineChanged.addEventListener("change", updateConditionalFields);

  $$('input[type="range"]').forEach((input) => {
    input.addEventListener("input", () => {
      updateRangeOutputs(document);
      if (dom.checkinModal && !dom.checkinModal.hidden) collectCheckinDraft();
      if (dom.episodeModal && !dom.episodeModal.hidden) collectEpisodeDraft();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dom.episodeModal && !dom.episodeModal.hidden) {
      closeModal(dom.episodeModal);
    } else if (dom.checkinModal && !dom.checkinModal.hidden) {
      closeModal(dom.checkinModal);
    }
  });

  window.addEventListener("online", async () => {
    if (state.token) {
      showToast("网络恢复，正在重新同步");
      await bootstrapDashboard(true);
    }
    await flushQueue();
  });

  window.addEventListener("offline", () => {
    updateDeviceChip(state.token ? "离线，仍可继续本机记录" : "离线");
    showToast("当前离线，记录会先保存在本机", "warning");
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (state.token && !state.isBooting) {
      await bootstrapDashboard(true);
    }
  });
}

function openCheckinModal(forceReview) {
  if (forceReview) {
    dom.baselineChanged.checked = true;
    dom.baselineChangeFields.hidden = false;
    setValue(dom.checkinForm, "notes", "请补充右半身抽动、走路、右脚控制、骑行/惊吓/紧急叫起触发的变化。");
  }
  restoreCheckinDraft();
  updateConditionalFields();
  openModal(dom.checkinModal);
  dom.notesField?.focus?.();
  updateRangeOutputs(dom.checkinForm);
}

function cacheDom() {
  const ids = [
    "loginForm",
    "loginPassword",
    "loginStatus",
    "appShell",
    "todayLabel",
    "deviceStatus",
    "syncButton",
    "logoutButton",
    "actionSteps",
    "avoidList",
    "trendMessage",
    "baselineFill",
    "baselineCount",
    "recentEpisodeCount",
    "reviewPrompt",
    "reviewButton",
    "nextCheck",
    "lastSynced",
    "safetyNote",
    "guidanceTitle",
    "guidanceState",
    "guidanceFocus",
    "guidanceRationale",
    "checkinModal",
    "checkinForm",
    "checkinButton",
    "checkinTitle",
    "baselineChanged",
    "baselineChangeFields",
    "episodeFields",
    "walkingValue",
    "footValue",
    "intensityValue",
    "hipValue",
    "electricValue",
    "innerThighValue",
    "saveCheckinButton",
    "episodeModal",
    "episodeTimerView",
    "episodeFinishForm",
    "episodeTimer",
    "episodeTitle",
    "episodeInstruction",
    "episodeProgress",
    "episodeButton",
    "minimizeEpisode",
    "finishEpisodeButton",
    "saveEpisodeButton",
    "toast",
    "episodeTriggerChoices",
  ];

  ids.forEach((id) => {
    dom[id] = document.getElementById(id);
  });

  dom.loginButton = dom.loginForm?.querySelector('button[type="submit"]');
  dom.notesField = dom.checkinForm?.querySelector('textarea[name="notes"]');
}

function initializeEpisodeState() {
  if (!state.activeEpisode) return;
  openModal(dom.episodeModal);
  dom.episodeTimerView.hidden = false;
  dom.episodeFinishForm.hidden = true;
  startEpisodeTicker();
  renderEpisodeState();
  setText("#episodeButton span:last-child", "继续发作模式");
}

function setDefaultButtonCopy() {
  setText("#episodeButton span:last-child", state.activeEpisode ? "继续发作模式" : "我现在在发作");
}

function updateButtonsEnabled(enabled) {
  [dom.checkinButton, dom.episodeButton, dom.syncButton, dom.logoutButton].forEach((button) => {
    if (button) button.disabled = !enabled;
  });
}

async function init() {
  cacheDom();
  renderStaticCopy();
  syncIcons();
  bindEvents();
  bindCheckinAutosave();
  bindEpisodeAutosave();
  updateConditionalFields();
  updateRangeOutputs(document);

  if (!navigator.onLine) {
    updateDeviceChip(state.token ? "离线，仍可继续本机记录" : "离线");
  }

  setDefaultButtonCopy();
  updateButtonsEnabled(Boolean(state.token));

  if (!state.token) {
    document.body.classList.add("locked");
    updateDeviceChip("陌生设备需要密码");
    setText("#loginStatus", "请输入网站密码。");
    return;
  }

  document.body.classList.remove("locked");
  await bootstrapDashboard(true);
  initializeEpisodeState();
  setDefaultButtonCopy();
  updateButtonsEnabled(true);
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
