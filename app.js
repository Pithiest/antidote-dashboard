const API_URL = "https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api";
const STORAGE_KEY = "antidote.bundle.v3";
const PASSWORD_KEY = "antidote.sitePassword.session.v1";

let bundle = emptyBundle();

function emptyBundle() {
  return { entries: [], profile: null, historical_events: [], hypotheses: [], recommendations: [], research_runs: [] };
}
function normalizeBundle(next = {}) {
  return {
    entries: Array.isArray(next.entries) ? [...next.entries].sort(byDateDesc) : [],
    profile: next.profile || null,
    historical_events: Array.isArray(next.historical_events) ? next.historical_events : [],
    hypotheses: Array.isArray(next.hypotheses) ? next.hypotheses : [],
    recommendations: Array.isArray(next.recommendations) ? [...next.recommendations].sort(byDateDescRec) : [],
    research_runs: Array.isArray(next.research_runs) ? [...next.research_runs].sort(byDateDescRec) : []
  };
}
function loadCachedBundle() { try { return normalizeBundle(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch { return emptyBundle(); } }
function saveCachedBundle() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle)); }
function byDateDesc(a, b) { return String(b.entry_date || "").localeCompare(String(a.entry_date || "")); }
function byDateDescRec(a, b) { return String(b.rec_date || b.run_date || b.entry_date || "").localeCompare(String(a.rec_date || a.run_date || a.entry_date || "")); }
function todayLocal() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function numberOrNull(value) { if (value === "" || value === null || value === undefined) return null; const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function latestEntry() { return bundle.entries[0] || null; }
function latestRecommendation() { const latest = latestEntry(); if (!latest) return null; return bundle.recommendations.find((rec) => rec.rec_date === latest.entry_date) || computeRecommendation(latest); }
function getPassword() { return document.querySelector("#sitePassword")?.value.trim() || sessionStorage.getItem(PASSWORD_KEY) || ""; }
function setPassword(value) { sessionStorage.setItem(PASSWORD_KEY, value); const login = document.querySelector("#loginPassword"); const sidebar = document.querySelector("#sitePassword"); if (login) login.value = value; if (sidebar) sidebar.value = value; }
function setStatus(text) { const syncStatus = document.querySelector("#syncStatus"); const loginStatus = document.querySelector("#loginStatus"); if (syncStatus) syncStatus.textContent = text; if (loginStatus) loginStatus.textContent = text; }
function unlockUi() { document.body.classList.remove("locked"); }
function lockUi() { document.body.classList.add("locked"); }
async function api(action, payload = {}) {
  const sitePassword = getPassword();
  if (!sitePassword) throw new Error("请输入网站密码");
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sitePassword, ...payload }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401) { sessionStorage.removeItem(PASSWORD_KEY); lockUi(); } throw new Error(data.error || `请求失败：${res.status}`); }
  return data;
}
async function loginAndSync() { const typed = document.querySelector("#loginPassword")?.value.trim() || document.querySelector("#sitePassword")?.value.trim() || ""; if (!typed) { setStatus("请输入网站密码。"); return; } setPassword(typed); await syncFromCloud({ allowCacheFallback: true }); }
async function syncFromCloud(options = {}) {
  setStatus("正在读取 Supabase 云端资料...");
  try { const data = await api("list"); bundle = normalizeBundle(data); saveCachedBundle(); unlockUi(); renderAll(); setStatus(`已同步：${bundle.entries.length} 条每日记录。`); }
  catch (error) { const cached = loadCachedBundle(); if (options.allowCacheFallback && cached.entries.length) { bundle = cached; unlockUi(); renderAll(); setStatus(`云端读取失败，暂时显示本机缓存：${error.message}`); return; } setStatus(error.message); }
}
function computeRecommendation(entry) {
  const isC = entry.day_class === "C" || Number(entry.episode_peak_intensity || 0) >= 7 || Number(entry.walking_limitation || 0) >= 7 || Number(entry.right_hip_external_rotation_pain || 0) >= 7 || Number(entry.inner_thigh_acid || 0) >= 7;
  const safetyTrigger = entry.e_bike || entry.urgent_wake || entry.handlebar_unstable || (entry.trigger_tags || []).includes("惊吓");
  const doNow = isC ? ["停止训练性测试", "长呼气 6 次", "坐姿双脚跟交替点地 60 秒", "扶墙原地踏步 20 次", "右脚落点慢走 40 步"] : ["出门/起身前做 60 秒稳定流程", "发作当下做 90 秒流程", "记录右脚控制、右髋痛、大腿内侧酸和发作分钟数"];
  return { day_class: entry.day_class || (isC ? "C" : "B"), plan_stage: isC ? "Day 0 回退" : "Day 0 安全过渡", primary_focus: safetyTrigger ? "优先处理惊吓、紧急叫起和骑行触发" : "降低右侧抽动阈值，稳定右脚落点", do_now: doNow, avoid: ["跑步加量", "引体向上/悬垂", "蛙泳腿", "反复转体", "大幅右髋外旋外展", "深压右臀或右小腿电流点"], next_variable: isC ? "无；加重日不新增变量" : "只观察 60 秒起身流程是否减少诱发", rationale: isC ? "今天指标偏高，先把触发阈值降下来，比继续测试更重要。" : "目前仍以状态切换和右侧控制为主线，每天只保留一个可判断变量。", safety_note: "骑行途中抽动或车把不稳时，优先安全靠边停下。" };
}
async function saveEntry(entry) { const data = await api("save", { entry }); bundle = normalizeBundle(data); saveCachedBundle(); renderAll(); }
function collectEntry() {
  const form = document.querySelector("#entryForm"); const data = new FormData(form);
  return { entry_date: data.get("entry_date") || todayLocal(), day_class: data.get("day_class") || "B", morning_twitch: data.get("morning_twitch") || "same", startle_trigger: data.get("startle_trigger") || "same", walking_discomfort: numberOrNull(data.get("walking_discomfort")), right_foot_control: numberOrNull(data.get("right_foot_control")), forty_step_stumbles: numberOrNull(data.get("forty_step_stumbles")), inner_thigh_acid: numberOrNull(data.get("inner_thigh_acid")), episode_peak_intensity: numberOrNull(data.get("episode_peak_intensity")), walking_limitation: numberOrNull(data.get("walking_limitation")), right_hip_external_rotation_pain: numberOrNull(data.get("right_hip_external_rotation_pain")), right_hip_snap: numberOrNull(data.get("right_hip_snap")), right_lower_leg_electric: numberOrNull(data.get("right_lower_leg_electric")), stairs_instability: numberOrNull(data.get("stairs_instability")), episode_minutes: numberOrNull(data.get("episode_minutes")), sleep_hours: numberOrNull(data.get("sleep_hours")), trigger_tags: [...document.querySelectorAll("#triggerTags input:checked")].map((item) => item.value), e_bike: data.get("e_bike") === "on", urgent_wake: data.get("urgent_wake") === "on", handlebar_unstable: data.get("handlebar_unstable") === "on", running_trigger: data.get("running_trigger") === "on", pullup_trigger: data.get("pullup_trigger") === "on", frog_kick_trigger: data.get("frog_kick_trigger") === "on", turning_trigger: data.get("turning_trigger") === "on", stop_after_activity_trigger: data.get("stop_after_activity_trigger") === "on", medication_taken: data.get("medication_taken") === "on", training_done: String(data.get("training_done") || "").trim(), activity_context: String(data.get("activity_context") || "").trim(), relief_actions: String(data.get("relief_actions") || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), notes: String(data.get("notes") || "").trim(), safety_notes: String(data.get("safety_notes") || "").trim() };
}
function applyEntryToForm(entry) {
  const form = document.querySelector("#entryForm"); if (!form) return; form.reset(); form.entry_date.value = entry?.entry_date || todayLocal(); form.day_class.value = entry?.day_class || "B";
  document.querySelectorAll(".segmented[data-field='day_class'] button").forEach((button) => button.classList.toggle("selected", button.dataset.value === form.day_class.value));
  for (const [key, value] of Object.entries(entry || {})) { if (key === "trigger_tags" || key === "relief_actions") continue; if (!(key in form)) continue; const input = form[key]; if (input.type === "checkbox") input.checked = Boolean(value); else input.value = value ?? ""; }
  document.querySelectorAll("#triggerTags input").forEach((input) => { input.checked = Array.isArray(entry?.trigger_tags) && entry.trigger_tags.includes(input.value); });
  if (Array.isArray(entry?.relief_actions)) form.relief_actions.value = entry.relief_actions.join(", ");
  document.querySelectorAll("input[type='range']").forEach((input) => setInputValue(input, input.value));
}
function setInputValue(input, value) { const output = input.parentElement?.querySelector(".range-value"); if (output) output.textContent = value; }
function showView(target) { document.querySelectorAll(".view-section").forEach((section) => section.classList.toggle("active", section.id === target)); document.querySelectorAll(".nav-link, .bottom-nav button").forEach((item) => item.classList.toggle("active", item.dataset.target === target)); }
function renderAll() { renderToday(); renderTrends(); renderKnowledge(); renderResearch(); renderHistory(); applyEntryToForm(bundle.entries.find((entry) => entry.entry_date === todayLocal()) || { entry_date: todayLocal() }); }
function renderToday() {
  const latest = latestEntry(); const rec = latestRecommendation(); const protocol = bundle.profile?.baseline_protocol || {};
  document.querySelector("#currentStage").textContent = rec?.plan_stage || "等待云端资料";
  document.querySelector("#currentFocus").textContent = rec?.primary_focus || "登录后读取 Supabase 中的个人档案和每日记录。";
  document.querySelector("#currentRationale").textContent = rec?.rationale || "";
  document.querySelector("#latestClass").textContent = rec?.day_class || latest?.day_class || "--";
  document.querySelector("#nextVariable").textContent = rec?.next_variable || "不新增变量";
  document.querySelector("#safetyNote").textContent = rec?.safety_note || "骑行途中抽动或车把不稳时，优先安全靠边停下。";
  renderList("#doNowList", rec?.do_now || protocol.day0_do || ["先登录并读取云端资料"]);
  renderList("#avoidList", rec?.avoid || protocol.avoid_now || ["未生成建议前不新增训练变量"]);
  renderList("#episodeProtocol", protocol.episode_90s || ["停下或坐下", "看固定目标", "长呼气", "双脚跟交替点地", "右脚全脚掌踏地后再慢走"]);
  renderList("#urgentProtocol", protocol.urgent_wake_60s || ["先站稳或坐稳", "长呼气", "双脚跟交替点地", "确认右手和右脚稳定后再行动"]);
  document.querySelector("#latestEpisode").textContent = latest?.episode_minutes != null ? `${latest.episode_minutes} 分钟` : "--";
  document.querySelector("#latestFoot").textContent = latest?.right_foot_control != null ? `${latest.right_foot_control}/10` : "--";
  document.querySelector("#latestHip").textContent = latest?.right_hip_external_rotation_pain != null ? `${latest.right_hip_external_rotation_pain}/10` : "--";
  document.querySelector("#latestElectric").textContent = latest?.right_lower_leg_electric != null ? `${latest.right_lower_leg_electric}/10` : "--";
}
function renderList(selector, items) { document.querySelector(selector).innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join(""); }
function renderTrends() { const recent = [...bundle.entries].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date))).slice(-14); drawLineChart(document.querySelector("#lineChart"), recent); drawDurationChart(document.querySelector("#durationChart"), recent); renderClassBars(); renderTriggerBars(); renderSafetyStats(); }
function setupCanvas(canvas) { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = Math.max(320, rect.width) * ratio; canvas.height = Number(canvas.getAttribute("height") || 260) * ratio; const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio); ctx.clearRect(0, 0, canvas.width, canvas.height); return { ctx, width: canvas.width / ratio, height: canvas.height / ratio }; }
function drawLineChart(canvas, rows) { const { ctx, width, height } = setupCanvas(canvas); drawAxes(ctx, width, height); [["右脚控制", "right_foot_control", "#16615e"], ["右髋痛", "right_hip_external_rotation_pain", "#d9872f"], ["电流感", "right_lower_leg_electric", "#315f9c"]].forEach(([label, field, color], index) => { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((row, i) => { const x = 38 + (rows.length <= 1 ? 0 : (i * (width - 62)) / (rows.length - 1)); const y = height - 28 - ((Number(row[field]) || 0) / 10) * (height - 56); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); ctx.fillStyle = color; ctx.fillText(label, 44 + index * 78, 18); }); if (!rows.length) drawEmpty(ctx, width, height); }
function drawDurationChart(canvas, rows) { const { ctx, width, height } = setupCanvas(canvas); drawAxes(ctx, width, height); const max = Math.max(10, ...rows.map((row) => Number(row.episode_minutes) || 0)); const gap = 8; const barWidth = rows.length ? Math.max(8, (width - 54 - gap * rows.length) / rows.length) : 18; rows.forEach((row, i) => { const value = Number(row.episode_minutes) || 0; const x = 38 + i * (barWidth + gap); const barHeight = (value / max) * (height - 58); ctx.fillStyle = row.day_class === "C" ? "#ba4a4a" : row.day_class === "A" ? "#40855f" : "#d9872f"; ctx.fillRect(x, height - 28 - barHeight, barWidth, barHeight); }); if (!rows.length) drawEmpty(ctx, width, height); }
function drawAxes(ctx, width, height) { ctx.font = "12px Microsoft YaHei, sans-serif"; ctx.strokeStyle = "#d8e3e1"; ctx.fillStyle = "#637173"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(34, 22); ctx.lineTo(34, height - 28); ctx.lineTo(width - 18, height - 28); ctx.stroke(); [0, 5, 10].forEach((tick) => { const y = height - 28 - (tick / 10) * (height - 56); ctx.fillText(String(tick), 8, y + 4); ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(width - 18, y); ctx.stroke(); }); }
function drawEmpty(ctx, width, height) { ctx.fillStyle = "#637173"; ctx.fillText("等待每日记录", width / 2 - 42, height / 2); }
function renderClassBars() { const counts = { A: 0, B: 0, C: 0 }; bundle.entries.forEach((entry) => counts[entry.day_class || "B"] += 1); document.querySelector("#classSummary").textContent = `共 ${bundle.entries.length} 条`; renderBars("#classBars", Object.entries(counts).map(([label, value]) => ({ label, value })), { A: "#40855f", B: "#d9872f", C: "#ba4a4a" }); }
function renderTriggerBars() { const counts = {}; bundle.entries.forEach((entry) => (entry.trigger_tags || []).forEach((tag) => counts[tag] = (counts[tag] || 0) + 1)); const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value })); renderBars("#triggerBars", rows); }
function renderBars(selector, rows, colorMap = {}) { const max = Math.max(1, ...rows.map((row) => row.value)); document.querySelector(selector).innerHTML = rows.length ? rows.map((row) => `<div class="bar-row"><span>${escapeHtml(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${(row.value / max) * 100}%;background:${colorMap[row.label] || "#16615e"}"></div></div><strong>${row.value}</strong></div>`).join("") : `<p class="muted-text">等待数据。</p>`; }
function renderSafetyStats() { const rows = [["骑电动车相关", bundle.entries.filter((entry) => entry.e_bike).length], ["紧急叫起相关", bundle.entries.filter((entry) => entry.urgent_wake).length], ["车把/右手受影响", bundle.entries.filter((entry) => entry.handlebar_unstable).length], ["惊吓标签", bundle.entries.filter((entry) => (entry.trigger_tags || []).includes("惊吓")).length]]; document.querySelector("#safetyStats").innerHTML = rows.map(([label, value]) => `<div class="stat-row"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join(""); }
function renderKnowledge() {
  const profile = bundle.profile;
  document.querySelector("#profileUpdated").textContent = profile?.updated_at ? `更新 ${String(profile.updated_at).slice(0, 10)}` : "等待云端";
  document.querySelector("#profileSummary").innerHTML = profile ? renderProfile(profile) : `<p class="muted-text">登录后从 Supabase 读取症状档案。</p>`;
  document.querySelector("#eventTimeline").innerHTML = bundle.historical_events.length ? [...bundle.historical_events].sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0)).map((event) => `<div class="timeline-item"><strong>${escapeHtml(event.event_label)}</strong><p class="muted-text">${escapeHtml(event.details)}</p><div class="history-meta"><span class="tag">${escapeHtml(event.event_type || "线索")}</span><span class="tag">重要度 ${event.importance || "--"}</span></div></div>`).join("") : `<p class="muted-text">等待历史线索。</p>`;
  document.querySelector("#hypothesisList").innerHTML = bundle.hypotheses.length ? bundle.hypotheses.map((item) => `<div class="hypothesis-item"><strong>${escapeHtml(item.title)}</strong><div class="fit-row"><div class="fit-track"><div class="fit-fill" style="width:${Math.min(100, Number(item.fit_score || 0))}%"></div></div><span>${item.fit_score || "--"}%</span></div><p class="muted-text">${escapeHtml(item.next_test || "")}</p><div class="tag-list">${(item.supporting_points || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div>`).join("") : `<p class="muted-text">等待候选模型。</p>`;
}
function renderProfile(profile) { const summary = profile.symptom_summary || {}; const checks = profile.completed_checks || {}; return `<div class="profile-block"><h3>当前重点</h3><p>${escapeHtml(summary.current_priority || "降低右侧抽动和走路难受")}</p></div><div class="profile-block"><h3>主要症状链</h3><ul>${(summary.core_chain || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div class="profile-block"><h3>常见触发</h3><div class="tag-list">${(summary.key_triggers || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div></div><div class="profile-block"><h3>已做检查/用药背景</h3><p class="muted-text">${escapeHtml((checks.normal_or_no_clear_abnormality || []).join("、"))}</p><p class="muted-text">${escapeHtml((checks.medication_trials || []).join("；"))}</p></div>`; }
function renderResearch() { document.querySelector("#researchList").innerHTML = bundle.research_runs.length ? bundle.research_runs.map((run) => `<div class="research-item"><strong>${escapeHtml(run.run_date || "研究记录")}</strong><p>${escapeHtml(run.findings || "")}</p><p class="muted-text">${escapeHtml(run.implication || "")}</p><div class="source-list">${(run.sources || []).slice(0, 6).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a>`).join("")}</div></div>`).join("") : `<p class="muted-text">等待自动研究任务写入。</p>`; }
function renderHistory() { document.querySelector("#historyCount").textContent = `${bundle.entries.length} 条`; document.querySelector("#historyList").innerHTML = bundle.entries.length ? bundle.entries.map((entry) => `<div class="history-item"><strong>${escapeHtml(entry.entry_date)} · ${escapeHtml(entry.plan_stage || entry.day_class || "未分类")}</strong><div class="history-meta"><span class="tag">走路 ${entry.walking_discomfort ?? "--"}/10</span><span class="tag">右脚 ${entry.right_foot_control ?? "--"}/10</span><span class="tag">右髋 ${entry.right_hip_external_rotation_pain ?? "--"}/10</span><span class="tag">发作 ${entry.episode_minutes ?? "--"} 分钟</span></div><p class="muted-text">${escapeHtml(entry.activity_context || entry.notes || "")}</p></div>`).join("") : `<p class="muted-text">还没有每日记录。</p>`; }
function init() {
  document.querySelector("#loginButton").addEventListener("click", loginAndSync);
  document.querySelector("#loginPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") loginAndSync(); });
  document.querySelector("#syncButton").addEventListener("click", () => syncFromCloud({ allowCacheFallback: true }));
  document.querySelector("#seedButton").addEventListener("click", () => syncFromCloud({ allowCacheFallback: true }));
  document.querySelectorAll(".nav-link, .bottom-nav button").forEach((item) => item.addEventListener("click", (event) => { event.preventDefault(); showView(item.dataset.target); }));
  document.querySelectorAll(".segmented button").forEach((button) => button.addEventListener("click", () => { const field = button.closest(".segmented").dataset.field; document.querySelector(`input[name='${field}']`).value = button.dataset.value; button.closest(".segmented").querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button)); }));
  document.querySelectorAll("input[type='range']").forEach((input) => { setInputValue(input, input.value); input.addEventListener("input", () => setInputValue(input, input.value)); });
  document.querySelector("#entryForm").addEventListener("submit", async (event) => { event.preventDefault(); const state = document.querySelector("#saveState"); state.textContent = "保存中..."; try { await saveEntry(collectEntry()); state.textContent = "已保存"; showView("today"); setStatus("已保存并生成今日建议。"); } catch (error) { state.textContent = "保存失败"; setStatus(error.message); } });
  document.querySelector("#resetForm").addEventListener("click", () => applyEntryToForm({ entry_date: todayLocal() }));
  document.querySelector("#exportButton").addEventListener("click", () => { const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `antidote-${todayLocal()}.json`; link.click(); URL.revokeObjectURL(url); });
  window.addEventListener("resize", () => renderTrends());
  const savedPassword = sessionStorage.getItem(PASSWORD_KEY);
  if (savedPassword) { setPassword(savedPassword); syncFromCloud({ allowCacheFallback: true }); } else { lockUi(); applyEntryToForm({ entry_date: todayLocal() }); }
}
init();
