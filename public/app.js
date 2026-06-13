const API_URL = "https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api";

const STORAGE_KEYS = {
  deviceToken: "antidote.deviceToken.v4",
  deviceExpiry: "antidote.deviceExpiry.v4",
  dashboardCache: "antidote.dashboardCache.v12",
  pendingQueue: "antidote.pendingQueue.v6",
  activeEpisode: "antidote.activeEpisode.v6",
  checkinDraft: "antidote.checkinDraft.v5",
  episodeDraft: "antidote.episodeDraft.v3",
};

const INTERVENTIONS = {
  rhythmic_tap: {
    title: "左手节拍",
    instruction: "坐稳。跟随圆点节奏，左手拇指与食指每秒轻点一次；右侧不要主动抵抗。",
  },
};

const EPISODE_GUIDANCE_STEPS = [
  {
    title: "前兆出现就停",
    detail: "立即停止移动；骑行时安全停车、断电并离开车流。",
    time: "马上",
  },
  {
    title: "先取得基线",
    detail: "坐稳或躺稳，每次抽动点一下，记录连续 2 个抽动间隔。",
    time: "约 1–3 分钟",
  },
  {
    title: "主动测试左手节拍",
    detail: "左手按 60 次/分钟轻点，右侧不主动纠正，同时记录抽动，连续 3 分钟。",
    time: "3 分钟",
  },
];

const state = {
  token: localStorage.getItem(STORAGE_KEYS.deviceToken) || "",
  tokenExpiry: localStorage.getItem(STORAGE_KEYS.deviceExpiry) || "",
  dashboard: readJson(STORAGE_KEYS.dashboardCache, null),
  queue: readJson(STORAGE_KEYS.pendingQueue, []),
  activeEpisode: readJson(STORAGE_KEYS.activeEpisode, null),
  isBooting: false,
};

const dom = {};
let episodeTicker = null;
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

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(target, value) {
  const element = typeof target === "string" ? $(target) : target;
  if (element) element.textContent = value ?? "";
}

function getRadioValue(root, name) {
  return root?.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setRadio(root, name, value) {
  const input = root?.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
  if (input) input.checked = true;
}

function valueOf(root, name) {
  return root?.querySelector(`[name="${name}"]`)?.value || "";
}

function setValue(root, name, value) {
  const input = root?.querySelector(`[name="${name}"]`);
  if (input) input.value = value ?? "";
}

function checked(root, name) {
  return Boolean(root?.querySelector(`[name="${name}"]`)?.checked);
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
          <div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div>
          <span>${escapeHtml(step.time)}</span>
        </li>`,
    )
    .join("");
}

function renderAvoid(items = []) {
  dom.avoidList.innerHTML = items
    .slice(0, 4)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function fallbackChecklist(dashboard = {}) {
  const latestDate = dashboard.latest_entry?.entry_date || "无";
  const latestTimestamp = Date.parse(
    dashboard.latest_entry?.observed_at ||
      dashboard.latest_entry?.updated_at ||
      `${latestDate}T12:00:00+08:00`,
  );
  const stale =
    !Number.isFinite(latestTimestamp) ||
    Date.now() - latestTimestamp > 36 * 3_600_000;
  const unstable =
    stale ||
    ["stabilize", "reassess"].includes(dashboard.guidance?.mode) ||
    dashboard.latest_entry?.baseline_change === "worse" ||
    dashboard.latest_entry?.episode_impact === "control_affected";
  return {
    basis: stale
      ? `最近记录日期为 ${latestDate}；没有新数据时按保守规则显示。`
      : `依据最近记录与发作事件生成；最近记录日期为 ${latestDate}。`,
    actions: [
      {
        title: "坐稳后再起身",
        detail: "醒来或久坐后先坐稳，双脚自然踏地，不刻意把右腿外旋。",
        dose: "60 秒，1 次",
        expected: "呼吸自然，右手右脚没有突然失控感。",
        stop: "抽动幅度上升、头晕、麻木扩散或意识异常时停止。",
      },
      {
        title: "扶稳站立检查",
        detail: "扶住固定支撑缓慢站起，不反复测试髋部弹响。",
        dose: "30 秒，1 次",
        expected: "右脚能稳定承重，没有明显偏移或踩空感。",
        stop: "右脚不听使唤、右手抽动或必须抓紧支撑时坐回去。",
      },
      {
        title: "室内短距离慢走",
        detail: "仅在前两步稳定时，在无车流、无楼梯的环境自然慢走。",
        dose: "10 步，1 组",
        expected: "落脚位置可控，症状没有逐步升高。",
        stop: "出现前兆、悬停卡顿、落点失控或大腿内侧迅速变酸时停止。",
      },
    ],
    release: unstable
      ? null
      : {
          area: "右臀外侧周围",
          method: "只用手掌轻触或轻扫，不找痛点、不深压。",
          dose: "30 秒，1 次",
          stop: "疼痛、抽筋感、麻电感或抽动增加时停止。",
        },
    stretch: unstable
      ? null
      : {
          area: "不做右髋外旋、P2 侧弓步或内收肌强拉伸",
          method: "只做不进入牵拉感的自然关节活动。",
          dose: "舒适范围内 3 次",
          stop: "出现牵拉、伴痛弹响或大腿内侧快速变酸时停止。",
        },
    movement: unstable
      ? "暂停骑电动车、跑步、引体向上、悬垂、蛙泳腿和需要快速转向的训练。"
      : "只保留安全环境中的日常步行；恢复专项运动前需要连续稳定并重新评估。",
    diet: "规律进餐和补水，保持稳定睡眠；避免醉酒和未经核验的草药或补充剂，不自行开始生酮饮食。",
    medication: "按医院处方服用现用药物，不自行停药、加量、减量或换药。",
  };
}

function renderChecklist(checklist = {}) {
  const actions = checklist.actions || [];
  dom.rehabActions.innerHTML = actions
    .slice(0, 3)
    .map(
      (action) => `
        <li>
          <div>
            <strong>${escapeHtml(action.title)}</strong>
            <p>${escapeHtml(action.detail)}</p>
          </div>
          <dl>
            <div><dt>剂量</dt><dd>${escapeHtml(action.dose)}</dd></div>
            <div><dt>正确感觉</dt><dd>${escapeHtml(action.expected)}</dd></div>
            <div><dt>停止</dt><dd>${escapeHtml(action.stop)}</dd></div>
          </dl>
        </li>`,
    )
    .join("");

  setText(dom.checklistBasis, checklist.basis || "等待最新记录");
  setText(
    dom.releaseAdvice,
    checklist.release
      ? `${checklist.release.area}：${checklist.release.method} ${checklist.release.dose}；${checklist.release.stop}`
      : "今天不安排主动松解或深压。",
  );
  setText(
    dom.stretchAdvice,
    checklist.stretch
      ? `${checklist.stretch.area}。${checklist.stretch.method} ${checklist.stretch.dose}；${checklist.stretch.stop}`
      : "今天不安排右髋、内收肌或小腿拉伸。",
  );
  setText(dom.movementAdvice, checklist.movement || "");
  setText(dom.dietAdvice, checklist.diet || "");
  setText(dom.medicationAdvice, checklist.medication || "");
}

function renderDashboard(dashboard) {
  if (!dashboard) return;
  state.dashboard = dashboard;
  saveJson(STORAGE_KEYS.dashboardCache, dashboard);
  const serverGuidance = dashboard.guidance || {};
  const guidance = {
    ...serverGuidance,
    focus: "下一次自然发作主动测试左手节律竞争：先取得两个抽动间隔，再连续记录 3 分钟。",
    steps: EPISODE_GUIDANCE_STEPS,
    next_check: "记录基线间隔、3 分钟抽动次数、总持续时间和右手右脚控制影响。",
  };
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
  renderChecklist(dashboard.checklist || fallbackChecklist(dashboard));
  populateCheckinForm(dashboard.today_entry || null);
  document.body.classList.remove("locked");
}

function populateCheckinForm(entry) {
  const data = { ...(entry || {}), ...(readTodayCheckinDraft() || {}) };
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
    ["静止到活动", /(起身|久坐后|刚开始走)/],
    ["活动到静止", /(活动停止|运动后停|跑完|走完)/],
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
  document.body.classList.remove("modal-open");
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
    if (error.status === 401) handleAuthFailure("设备验证已失效，记录已暂存。");
    else showToast("网络不可用，记录已暂存在本机");
  } finally {
    setBusy(dom.saveCheckinButton, false, "保存中");
  }
}

function storeActiveEpisode(value) {
  state.activeEpisode = value;
  if (value) saveJson(STORAGE_KEYS.activeEpisode, value);
  else localStorage.removeItem(STORAGE_KEYS.activeEpisode);
  setText(dom.episodeButton, value ? "继续记录发作" : "抽动开始");
}

function phaseSecondsLeft(endAt) {
  return Math.max(0, Math.ceil((Date.parse(endAt) - Date.now()) / 1000));
}

function showEpisodeView(name) {
  dom.episodeObserveView.hidden = name !== "observe";
  dom.episodeInterventionView.hidden = name !== "select";
  dom.episodeInterventionRunView.hidden = name !== "run";
  dom.episodeFinishForm.hidden = name !== "finish";
}

function renderEpisodeState() {
  if (!state.activeEpisode) return;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(state.activeEpisode.started_at)) / 1000),
  );
  setText(dom.episodeTimer, formatElapsed(elapsed));

  if (state.activeEpisode.phase === "observe") {
    const taps = state.activeEpisode.baseline_jerk_times || [];
    const intervals = state.activeEpisode.baseline_intervals_seconds || [];
    setText(dom.observeCountdown, `${Math.min(taps.length, 3)} / 3`);
    setText(
      dom.baselineIntervalSummary,
      intervals.length === 2
        ? `两个间隔：${intervals[0]} 秒、${intervals[1]} 秒`
        : taps.length
          ? `已记录 ${taps.length} 次抽动`
          : "尚未形成基线",
    );
    dom.chooseInterventionButton.disabled = taps.length < 3;
    setText(
      dom.chooseInterventionButton,
      taps.length < 3 ? "记录 3 次抽动后继续" : "开始本轮测试",
    );
  }

  if (state.activeEpisode.phase === "run") {
    const left = phaseSecondsLeft(state.activeEpisode.intervention_ends_at);
    setText(dom.interventionCountdown, formatElapsed(left));
    setText(
      dom.interventionJerkButton,
      `刚抽了一次 · ${state.activeEpisode.intervention_jerk_count || 0}`,
    );
    if (left === 0) showEpisodeFinish(false);
  }
}

function startEpisodeTicker() {
  clearInterval(episodeTicker);
  renderEpisodeState();
  episodeTicker = setInterval(renderEpisodeState, 250);
}

function stopEpisodeTicker() {
  clearInterval(episodeTicker);
  episodeTicker = null;
}

function restoreEpisodeView() {
  const phase = state.activeEpisode?.phase || "observe";
  showEpisodeView(phase);
  if (phase === "run") {
    const method = state.activeEpisode.intervention_method;
    setText(dom.interventionTitle, INTERVENTIONS[method]?.title || "单一变量测试");
    setText(dom.interventionInstruction, INTERVENTIONS[method]?.instruction || "");
    dom.metronomePulse.hidden = method !== "rhythmic_tap";
  }
  if (phase === "finish") restoreEpisodeDraft();
}

async function startEpisode() {
  if (state.activeEpisode) {
    restoreEpisodeView();
    openModal(dom.episodeModal);
    startEpisodeTicker();
    return;
  }

  const startedAt = new Date().toISOString();
  const active = {
    event_id: null,
    started_at: startedAt,
    phase: "observe",
    baseline_jerk_times: [],
    baseline_intervals_seconds: [],
    intervention_method: "none",
    intervention_started_at: null,
    intervention_ends_at: null,
    intervention_jerk_count: 0,
  };
  storeActiveEpisode(active);
  showEpisodeView("observe");
  openModal(dom.episodeModal);
  startEpisodeTicker();

  try {
    const response = await request("startEpisode", {
      started_at: startedAt,
      source_ref: "website:episode-intervention",
    });
    if (response?.event?.id) {
      active.event_id = response.event.id;
      storeActiveEpisode(active);
    }
  } catch (error) {
    if (error.status === 401) handleAuthFailure("设备验证已失效，计时仍保留在本机。");
    else showToast("计时已开始，网络恢复后再保存");
  }
}

function recordBaselineJerk() {
  if (!state.activeEpisode || state.activeEpisode.phase !== "observe") return;
  const times = [...(state.activeEpisode.baseline_jerk_times || []), Date.now()].slice(-3);
  const intervals = times
    .slice(1)
    .map((time, index) => Math.max(1, Math.round((time - times[index]) / 1000)));
  state.activeEpisode.baseline_jerk_times = times;
  state.activeEpisode.baseline_intervals_seconds = intervals;
  storeActiveEpisode(state.activeEpisode);
  renderEpisodeState();
}

function chooseIntervention() {
  if (!state.activeEpisode || (state.activeEpisode.baseline_jerk_times || []).length < 3) return;
  state.activeEpisode.phase = "select";
  storeActiveEpisode(state.activeEpisode);
  showEpisodeView("select");
}

function beginIntervention() {
  if (!state.activeEpisode) return;
  const method = "rhythmic_tap";
  const startedAt = new Date().toISOString();
  state.activeEpisode = {
    ...state.activeEpisode,
    phase: "run",
    intervention_method: method,
    intervention_started_at: startedAt,
    intervention_ends_at: new Date(Date.now() + 180_000).toISOString(),
    intervention_jerk_count: 0,
  };
  storeActiveEpisode(state.activeEpisode);
  setText(dom.interventionTitle, INTERVENTIONS[method].title);
  setText(dom.interventionInstruction, INTERVENTIONS[method].instruction);
  dom.metronomePulse.hidden = method !== "rhythmic_tap";
  showEpisodeView("run");
}

function recordInterventionJerk() {
  if (!state.activeEpisode || state.activeEpisode.phase !== "run") return;
  state.activeEpisode.intervention_jerk_count =
    Number(state.activeEpisode.intervention_jerk_count || 0) + 1;
  storeActiveEpisode(state.activeEpisode);
  renderEpisodeState();
}

function calculatedInterventionEffect() {
  const intervals = state.activeEpisode?.baseline_intervals_seconds || [];
  if (intervals.length < 2 || !state.activeEpisode?.intervention_started_at) {
    return "none_or_worse";
  }
  const averageInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const elapsedSeconds = Math.max(
    1,
    Math.min(
      180,
      Math.floor((Date.now() - Date.parse(state.activeEpisode.intervention_started_at)) / 1000),
    ),
  );
  const expectedJerks = elapsedSeconds / averageInterval;
  const observedJerks = Number(state.activeEpisode.intervention_jerk_count || 0);
  const ratio = expectedJerks > 0 ? observedJerks / expectedJerks : 1;
  if (ratio <= 0.5) return "half_or_more";
  if (ratio < 1) return "less_than_half";
  return "none_or_worse";
}

function showEpisodeFinish(skipped = false) {
  if (!state.activeEpisode || state.activeEpisode.phase === "finish") return;
  state.activeEpisode.phase = "finish";
  if (skipped) {
    state.activeEpisode.intervention_method = "none";
    state.activeEpisode.intervention_started_at = null;
  }
  storeActiveEpisode(state.activeEpisode);
  dom.effectFieldset.hidden = skipped;
  setRadio(
    dom.episodeFinishForm,
    "thirty_second_effect",
    skipped ? "none_or_worse" : calculatedInterventionEffect(),
  );
  showEpisodeView("finish");
  restoreEpisodeDraft();
}

function collectEpisodeFinish() {
  const finishedAt = new Date().toISOString();
  const rightHand = checked(dom.episodeFinishForm, "right_hand_affected");
  const rightFoot = checked(dom.episodeFinishForm, "right_foot_affected");
  const method = state.activeEpisode?.intervention_method || "none";
  const intervals = state.activeEpisode?.baseline_intervals_seconds || [];
  const interventionJerks = Number(state.activeEpisode?.intervention_jerk_count || 0);
  const interventionDuration = state.activeEpisode?.intervention_started_at
    ? Math.max(
        0,
        Math.min(
          180,
          Math.floor(
            (Date.now() - Date.parse(state.activeEpisode.intervention_started_at)) / 1000,
          ),
        ),
      )
    : null;
  const userNotes = valueOf(dom.episodeFinishForm, "notes").trim();
  const metricNote = [
    intervals.length
      ? `基线间隔：${intervals.map((value) => `${value}秒`).join("、")}`
      : "基线间隔：未完成",
    method === "none" ? "未测试干预" : `3 分钟抽动：${interventionJerks}次`,
    interventionDuration === null ? "" : `实际干预：${interventionDuration}秒`,
  ]
    .filter(Boolean)
    .join("；");
  return {
    event_id: state.activeEpisode?.event_id || null,
    started_at: state.activeEpisode?.started_at || finishedAt,
    finished_at: finishedAt,
    duration_seconds: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(state.activeEpisode?.started_at || finishedAt)) / 1000),
    ),
    intervention_method: method,
    intervention_started_at: state.activeEpisode?.intervention_started_at || null,
    baseline_intervals_seconds: intervals,
    intervention_jerk_count: interventionJerks,
    intervention_duration_seconds: interventionDuration,
    thirty_second_effect:
      method === "none"
        ? "not_tested"
        : getRadioValue(dom.episodeFinishForm, "thirty_second_effect") || "none_or_worse",
    episode_impact: rightHand || rightFoot ? "control_affected" : "control_ok",
    control_affected: rightHand || rightFoot,
    right_hand_affected: rightHand,
    right_foot_affected: rightFoot,
    source_kind: "episode_mode",
    source_ref: "website:episode-intervention",
    notes: userNotes ? `[${metricNote}] ${userNotes}` : `[${metricNote}]`,
  };
}

function collectEpisodeDraft() {
  saveJson(STORAGE_KEYS.episodeDraft, {
    thirty_second_effect:
      getRadioValue(dom.episodeFinishForm, "thirty_second_effect") || "none_or_worse",
    right_hand_affected: checked(dom.episodeFinishForm, "right_hand_affected"),
    right_foot_affected: checked(dom.episodeFinishForm, "right_foot_affected"),
    notes: valueOf(dom.episodeFinishForm, "notes"),
  });
}

function restoreEpisodeDraft() {
  const draft = readJson(STORAGE_KEYS.episodeDraft, null);
  if (!draft) return;
  setRadio(
    dom.episodeFinishForm,
    "thirty_second_effect",
    draft.thirty_second_effect || "none_or_worse",
  );
  dom.episodeFinishForm.elements.right_hand_affected.checked = Boolean(draft.right_hand_affected);
  dom.episodeFinishForm.elements.right_foot_affected.checked = Boolean(draft.right_foot_affected);
  setValue(dom.episodeFinishForm, "notes", draft.notes || "");
}

function resetEpisodeState() {
  stopEpisodeTicker();
  storeActiveEpisode(null);
  localStorage.removeItem(STORAGE_KEYS.episodeDraft);
  dom.episodeFinishForm.reset();
  dom.effectFieldset.hidden = false;
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
    showToast("本次发作已保存");
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
      showToast("云端暂不可用，正在显示本机缓存");
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
  dom.baselineJerkButton.addEventListener("click", recordBaselineJerk);
  dom.chooseInterventionButton.addEventListener("click", chooseIntervention);
  dom.skipInterventionButton.addEventListener("click", () => showEpisodeFinish(true));
  dom.beginInterventionButton.addEventListener("click", beginIntervention);
  dom.interventionJerkButton.addEventListener("click", recordInterventionJerk);
  dom.stopInterventionButton.addEventListener("click", () => showEpisodeFinish(false));
  dom.episodeFinishForm.addEventListener("submit", finishEpisode);
  dom.episodeFinishForm.addEventListener("input", collectEpisodeDraft);
  dom.episodeFinishForm.addEventListener("change", collectEpisodeDraft);
  dom.resumeEpisodeButton.addEventListener("click", () => closeModal(dom.episodeModal));
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
    "loginForm", "loginPassword", "loginButton", "loginStatus", "todayLabel", "deviceStatus",
    "syncButton", "logoutButton", "guidanceState", "guidanceTitle", "guidanceFocus",
    "guidanceRationale", "actionSteps", "avoidList", "safetyNote", "lastSynced",
    "rehabActions", "checklistBasis", "releaseAdvice", "stretchAdvice", "movementAdvice",
    "dietAdvice", "medicationAdvice",
    "checkinButton", "episodeButton", "checkinModal", "checkinForm", "saveCheckinButton",
    "episodeModal", "episodeTimer", "episodeObserveView", "observeCountdown",
    "baselineJerkButton", "baselineIntervalSummary", "chooseInterventionButton",
    "skipInterventionButton", "episodeInterventionView",
    "beginInterventionButton", "episodeInterventionRunView", "interventionTitle",
    "interventionInstruction", "interventionCountdown", "interventionJerkButton", "metronomePulse",
    "stopInterventionButton", "episodeFinishForm", "effectFieldset", "resumeEpisodeButton",
    "saveEpisodeButton", "minimizeEpisode", "toast",
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

async function init() {
  cacheDom();
  bindEvents();
  if (state.dashboard) renderDashboard(state.dashboard);
  if (state.activeEpisode) {
    setText(dom.episodeButton, "继续记录发作");
    startEpisodeTicker();
  }
  await bootstrapDashboard(true);
}

init();
