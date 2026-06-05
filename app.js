const API_URL = "https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api";
const PASSWORD_KEY = "antidote.sitePassword.session.v2";
const DASHBOARD_CACHE_KEY = "antidote.dashboard.v7";
const PENDING_QUEUE_KEY = "antidote.pending.v1";
const ACTIVE_EPISODE_KEY = "antidote.activeEpisode.v1";
const stepIcons = ["wind", "footprints", "crosshair", "clipboard-check"];

const episodeSteps = [
  {
    title: "停下或坐稳",
    detail: "不要继续硬走或硬骑，先扶稳、靠边或坐下。"
  },
  {
    title: "看一个固定目标",
    detail: "视线看前方固定物，不要低头盯着右腿。"
  },
  {
    title: "把呼气拉长",
    detail: "吸气 3 秒、呼气 6 秒，连续做两次。"
  },
  {
    title: "双脚跟交替点地",
    detail: "动作小而均匀，不追求速度和幅度。"
  },
  {
    title: "右脚全脚掌踏实",
    detail: "确认右脚和右手可控后，再决定是否慢慢移动。"
  }
];

let dashboard = loadJson(DASHBOARD_CACHE_KEY, null);
let activeEpisode = loadJson(ACTIVE_EPISODE_KEY, null);
let episodeInterval = null;
let toastTimer = null;
let lastFocused = null;

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
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

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatSyncTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || "";
}

function setStatus(message) {
  const syncStatus = $("#syncStatus");
  const syncStatusText = $("#syncStatusText");
  const loginStatus = $("#loginStatus");
  if (syncStatusText) syncStatusText.textContent = message;
  if (syncStatus) {
    syncStatus.classList.toggle("is-offline", message.includes("缓存") || message.includes("离线"));
    syncStatus.classList.toggle("is-syncing", message.includes("同步"));
  }
  if (loginStatus) loginStatus.textContent = message;
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

async function api(action, payload = {}) {
  const sitePassword = getPassword();
  if (!sitePassword) throw new Error("请先输入网站密码");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, sitePassword, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem(PASSWORD_KEY);
      document.body.classList.add("locked");
    }
    const error = new Error(data.error || `请求失败：${response.status}`);
    error.code = response.status === 401 ? "AUTH" : "API";
    throw error;
  }
  return data;
}

function pendingQueue() {
  return loadJson(PENDING_QUEUE_KEY, []);
}

function enqueue(action, payload) {
  const queue = pendingQueue();
  queue.push({ action, payload, queued_at: new Date().toISOString() });
  saveJson(PENDING_QUEUE_KEY, queue);
}

async function flushPending() {
  const queue = pendingQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      dashboard = await api(item.action, item.payload);
    } catch {
      remaining.push(item);
    }
  }
  saveJson(PENDING_QUEUE_KEY, remaining);
  if (!remaining.length) showToast("离线暂存的数据已经同步。");
}

async function login(password) {
  if (!password) {
    setStatus("请输入网站密码。");
    return;
  }
  const loginButton = $("#loginForm button[type='submit']");
  setBusy(loginButton, true);
  sessionStorage.setItem(PASSWORD_KEY, password);
  try {
    await syncDashboard(true);
  } finally {
    setBusy(loginButton, false);
  }
}

async function syncDashboard(allowCache = false) {
  setStatus("正在同步");
  const syncButton = $("#syncButton");
  syncButton?.classList.add("is-loading");
  setBusy(syncButton, true);
  try {
    await flushPending();
    dashboard = await api("bootstrapDashboard");
    saveJson(DASHBOARD_CACHE_KEY, dashboard);
    document.body.classList.remove("locked");
    renderDashboard();
    setStatus("已同步");
  } catch (error) {
    if (error.code !== "AUTH" && allowCache && dashboard) {
      document.body.classList.remove("locked");
      renderDashboard();
      setStatus("显示本机缓存");
      showToast("云端暂时不可用，正在显示最近一次指令。");
    } else {
      setStatus(error.message);
    }
  } finally {
    syncButton?.classList.remove("is-loading");
    setBusy(syncButton, false);
  }
}

function renderDashboard() {
  if (!dashboard) return;
  const guidance = dashboard.guidance || {};
  const trend = dashboard.trend || {};
  const steps = Array.isArray(guidance.steps) ? guidance.steps : [];
  const avoid = Array.isArray(guidance.avoid) ? guidance.avoid : [];

  document.body.classList.remove("mode-stabilize", "mode-maintain", "mode-progress", "mode-reassess");
  document.body.classList.add(`mode-${guidance.mode || "maintain"}`);

  $("#todayLabel").textContent = formatDate();
  $("#guidanceTitle").textContent = guidance.title || "保持节奏";
  $("#guidanceState").textContent = guidance.title || "保持节奏";
  $("#guidanceFocus").textContent = guidance.focus || "今天保持低刺激、可重复的稳定流程。";
  $("#guidanceRationale").textContent = guidance.rationale || "";
  $("#nextCheck").textContent = guidance.next_check || "只观察今天的流程是否帮助右脚控制。";
  $("#safetyNote").textContent = guidance.safety_note || "发作时先确保自己处于不会摔倒或失控的位置。";
  $("#trendMessage").textContent = trend.message || "数据仍在建立基线。";
  $("#baselineCount").textContent = `${trend.sample_count || 0}/${trend.required_count || 7} 个有效日`;
  $("#recentEpisodeCount").textContent = `近 7 天 ${dashboard.recent_episode_count || 0} 次发作记录`;
  $("#baselineFill").style.width = `${Math.min(100, ((trend.sample_count || 0) / (trend.required_count || 7)) * 100)}%`;
  $("#reviewPrompt").hidden = !guidance.review_due;
  $("#lastSynced").textContent = formatSyncTime(dashboard.synced_at);

  $("#actionSteps").innerHTML = steps.map((step, index) => `
    <li class="action-step">
      <span class="step-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="step-icon" aria-hidden="true">
        <i data-lucide="${stepIcons[index] || "circle"}"></i>
      </span>
      <div class="step-copy">
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(step.detail)}</p>
      </div>
      <span class="step-time">${escapeHtml(step.time || "")}</span>
    </li>
  `).join("");

  $("#avoidList").innerHTML = avoid.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  if (dashboard.today_entry) applyTodayEntry(dashboard.today_entry);
  if (dashboard.active_episode && !activeEpisode) {
    activeEpisode = {
      eventId: dashboard.active_episode.id,
      startedAt: dashboard.active_episode.started_at
    };
    saveJson(ACTIVE_EPISODE_KEY, activeEpisode);
  }
  refreshIcons();
  requestAnimationFrame(() => document.body.classList.add("is-ready"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showModal(selector) {
  lastFocused = document.activeElement;
  $(selector).hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => {
    $(selector).querySelector('[role="dialog"]')?.focus();
  });
}

function hideModal(selector) {
  $(selector).hidden = true;
  if ($("#checkinModal").hidden && $("#episodeModal").hidden) {
    document.body.classList.remove("modal-open");
  }
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

function selectedRadio(form, name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function checkedValues(selector) {
  return $$(selector).filter((input) => input.checked).map((input) => input.value);
}

function setRadio(form, name, value, fallback) {
  const target = form.querySelector(`input[name="${name}"][value="${value}"]`)
    || form.querySelector(`input[name="${name}"][value="${fallback}"]`);
  if (target) target.checked = true;
}

function applyTodayEntry(entry) {
  const form = $("#checkinForm");
  setRadio(form, "baseline_change", entry.baseline_change, "same");
  form.walking_discomfort.value = entry.walking_discomfort ?? 4;
  form.right_foot_control.value = entry.right_foot_control ?? 4;
  setRadio(form, "had_episode", Number(entry.episode_minutes || 0) > 0 ? "yes" : "no", "no");
  form.episode_minutes.value = entry.episode_minutes ?? "";
  form.episode_peak_intensity.value = entry.episode_peak_intensity ?? 5;
  setRadio(form, "protocol_response", entry.protocol_response, "not_used");
  form.baseline_symptoms_changed.checked = Boolean(entry.baseline_symptoms_changed);
  form.right_hip_external_rotation_pain.value = entry.right_hip_external_rotation_pain ?? 5;
  form.right_lower_leg_electric.value = entry.right_lower_leg_electric ?? 3;
  form.inner_thigh_acid.value = entry.inner_thigh_acid ?? 4;
  form.hip_snap_change.value = entry.hip_snap_change || "";
  form.notes.value = entry.notes || "";

  $$("#triggerChoices input").forEach((input) => {
    input.checked = Array.isArray(entry.trigger_tags) && entry.trigger_tags.includes(input.value);
  });
  updateConditionalFields();
  updateRangeOutputs();
}

function updateConditionalFields() {
  const form = $("#checkinForm");
  $("#episodeFields").hidden = selectedRadio(form, "had_episode") !== "yes";
  $("#baselineChangeFields").hidden = !$("#baselineChanged").checked;
}

function updateRangeOutputs() {
  const map = [
    ["walking_discomfort", "#walkingValue"],
    ["right_foot_control", "#footValue"],
    ["episode_peak_intensity", "#intensityValue"],
    ["right_hip_external_rotation_pain", "#hipValue"],
    ["right_lower_leg_electric", "#electricValue"],
    ["inner_thigh_acid", "#innerThighValue"],
    ["peak_intensity", "#episodePeakValue"]
  ];
  map.forEach(([name, selector]) => {
    const input = document.querySelector(`input[name="${name}"]`);
    const output = $(selector);
    if (input && output) output.textContent = input.value;
  });
}

function collectCheckin() {
  const form = $("#checkinForm");
  const hadEpisode = selectedRadio(form, "had_episode") === "yes";
  const triggerTags = checkedValues("#triggerChoices input");
  return {
    entry_date: todayLocal(),
    baseline_change: selectedRadio(form, "baseline_change") || "same",
    walking_discomfort: Number(form.walking_discomfort.value),
    right_foot_control: Number(form.right_foot_control.value),
    episode_minutes: hadEpisode && form.episode_minutes.value !== "" ? Number(form.episode_minutes.value) : null,
    episode_peak_intensity: hadEpisode ? Number(form.episode_peak_intensity.value) : 0,
    trigger_tags: triggerTags,
    protocol_response: selectedRadio(form, "protocol_response") || "not_used",
    e_bike: triggerTags.includes("骑行"),
    urgent_wake: triggerTags.includes("紧急叫起"),
    handlebar_unstable: false,
    stop_after_activity_trigger: triggerTags.includes("静止到活动"),
    baseline_symptoms_changed: form.baseline_symptoms_changed.checked,
    right_hip_external_rotation_pain: form.baseline_symptoms_changed.checked
      ? Number(form.right_hip_external_rotation_pain.value)
      : null,
    right_lower_leg_electric: form.baseline_symptoms_changed.checked
      ? Number(form.right_lower_leg_electric.value)
      : null,
    inner_thigh_acid: form.baseline_symptoms_changed.checked
      ? Number(form.inner_thigh_acid.value)
      : null,
    hip_snap_change: form.baseline_symptoms_changed.checked ? form.hip_snap_change.value.trim() : "",
    notes: form.notes.value.trim()
  };
}

async function saveCheckin(event) {
  event.preventDefault();
  const button = $("#saveCheckinButton");
  const checkin = collectCheckin();
  setBusy(button, true);
  button.querySelector("span").textContent = "保存中";
  try {
    dashboard = await api("saveCheckin", { checkin });
    saveJson(DASHBOARD_CACHE_KEY, dashboard);
    renderDashboard();
    hideModal("#checkinModal");
    showToast("今日变化已保存，指令已更新。");
  } catch (error) {
    if (error.code === "AUTH") {
      enqueue("saveCheckin", { checkin });
      hideModal("#checkinModal");
      showToast("登录已失效；记录已暂存，请重新进入。");
    } else {
      enqueue("saveCheckin", { checkin });
      hideModal("#checkinModal");
      showToast("网络不可用，已暂存在本机，联网后会自动同步。");
    }
  } finally {
    setBusy(button, false);
    button.querySelector("span").textContent = "保存并更新指令";
  }
}

function elapsedEpisodeSeconds() {
  if (!activeEpisode?.startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - Date.parse(activeEpisode.startedAt)) / 1000));
}

function episodeStepIndex(elapsed) {
  return Math.min(episodeSteps.length - 1, Math.floor(Math.min(elapsed, 89) / 18));
}

function renderEpisodeTimer() {
  if (!activeEpisode) return;
  const elapsed = elapsedEpisodeSeconds();
  const remaining = Math.max(0, 90 - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const stepIndex = episodeStepIndex(elapsed);

  $("#episodeTimer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $("#episodeTitle").textContent = episodeSteps[stepIndex].title;
  $("#episodeInstruction").textContent = episodeSteps[stepIndex].detail;
  $$("#episodeProgress li").forEach((item, index) => {
    item.classList.toggle("active", index === stepIndex);
    item.classList.toggle("complete", index < stepIndex);
  });

  if (remaining === 0 && $("#episodeFinishForm").hidden) {
    showEpisodeFinish();
  }
}

async function startOrResumeEpisode() {
  if (!activeEpisode) {
    activeEpisode = {
      eventId: null,
      startedAt: new Date().toISOString()
    };
    saveJson(ACTIVE_EPISODE_KEY, activeEpisode);
    api("startEpisode", { started_at: activeEpisode.startedAt })
      .then(({ event }) => {
        if (!activeEpisode) return;
        activeEpisode.eventId = event?.id || null;
        saveJson(ACTIVE_EPISODE_KEY, activeEpisode);
      })
      .catch(() => {
        showToast("计时已开始；本次记录会在结束时尝试同步。");
      });
  }

  $("#episodeTimerView").hidden = false;
  $("#episodeFinishForm").hidden = true;
  showModal("#episodeModal");
  clearInterval(episodeInterval);
  renderEpisodeTimer();
  episodeInterval = setInterval(renderEpisodeTimer, 1000);
}

function showEpisodeFinish() {
  clearInterval(episodeInterval);
  $("#episodeTimerView").hidden = true;
  $("#episodeFinishForm").hidden = false;
  updateRangeOutputs();
}

function minimizeEpisode() {
  clearInterval(episodeInterval);
  hideModal("#episodeModal");
  showToast("发作计时仍已保留，重新打开可继续。");
}

function collectEpisodeFinish() {
  const form = $("#episodeFinishForm");
  return {
    event_id: activeEpisode?.eventId || null,
    started_at: activeEpisode?.startedAt || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_seconds: elapsedEpisodeSeconds(),
    trigger_tags: checkedValues("#episodeTriggerChoices input"),
    peak_intensity: Number(form.peak_intensity.value),
    right_foot_affected: form.right_foot_affected.checked,
    right_hand_affected: form.right_hand_affected.checked,
    protocol_response: selectedRadio(form, "protocol_response") || "helped",
    notes: form.notes.value.trim()
  };
}

async function saveEpisode(event) {
  event.preventDefault();
  const payload = collectEpisodeFinish();
  const button = $("#saveEpisodeButton");
  setBusy(button, true);
  button.textContent = "保存中";
  try {
    dashboard = await api("finishEpisode", payload);
    saveJson(DASHBOARD_CACHE_KEY, dashboard);
    renderDashboard();
    showToast("这次发作已记录。");
  } catch (error) {
    if (error.code === "AUTH") {
      enqueue("finishEpisode", payload);
      showToast("登录已失效；这次发作已暂存，请重新进入。");
    } else {
      enqueue("finishEpisode", payload);
      showToast("网络不可用，这次发作已暂存在本机。");
    }
  } finally {
    activeEpisode = null;
    localStorage.removeItem(ACTIVE_EPISODE_KEY);
    clearInterval(episodeInterval);
    hideModal("#episodeModal");
    $("#episodeFinishForm").reset();
    setBusy(button, false);
    button.textContent = "保存这次发作";
  }
}

function openFullReview() {
  showModal("#checkinModal");
  $("#baselineChanged").checked = true;
  $("#baselineChangeFields").hidden = false;
  $("#checkinForm").notes.placeholder = "请从右侧抽动、走路、右脚控制、活动诱发、右髋和小腿感觉开始，完整描述和平常相比的变化。";
  $("#checkinForm").notes.focus();
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("#loginPassword").value.trim());
  });
  $("#syncButton").addEventListener("click", () => syncDashboard(true));
  $("#logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(PASSWORD_KEY);
    document.body.classList.add("locked");
    setStatus("已退出");
  });
  $("#checkinButton").addEventListener("click", () => showModal("#checkinModal"));
  $("#reviewButton").addEventListener("click", openFullReview);
  $("#episodeButton").addEventListener("click", startOrResumeEpisode);
  $("#finishEpisodeButton").addEventListener("click", showEpisodeFinish);
  $("#minimizeEpisode").addEventListener("click", minimizeEpisode);
  $("#checkinForm").addEventListener("submit", saveCheckin);
  $("#episodeFinishForm").addEventListener("submit", saveEpisode);
  $$(".close-modal").forEach((button) => {
    button.addEventListener("click", () => hideModal("#checkinModal"));
  });
  $$('input[name="had_episode"]').forEach((input) => input.addEventListener("change", updateConditionalFields));
  $("#baselineChanged").addEventListener("change", updateConditionalFields);
  $$('input[type="range"]').forEach((input) => input.addEventListener("input", updateRangeOutputs));
  $("#checkinModal").addEventListener("click", (event) => {
    if (event.target === $("#checkinModal")) hideModal("#checkinModal");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#episodeModal").hidden) {
      minimizeEpisode();
    } else if (!$("#checkinModal").hidden) {
      hideModal("#checkinModal");
    }
  });
  window.addEventListener("online", () => {
    setStatus("正在同步");
    syncDashboard(true);
  });
  window.addEventListener("offline", () => setStatus("离线，可继续记录"));
}

function init() {
  $("#todayLabel").textContent = formatDate();
  bindEvents();
  updateConditionalFields();
  updateRangeOutputs();
  refreshIcons();
  if (!navigator.onLine) setStatus("离线，可继续记录");

  if (dashboard) renderDashboard();
  if (getPassword()) {
    syncDashboard(true);
  } else {
    document.body.classList.add("locked");
  }
}

init();
