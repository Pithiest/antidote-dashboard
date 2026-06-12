import assert from "node:assert/strict";

import {
  buildDailyChecklist,
  buildGuidance,
  computeTrend,
} from "../shared/antidote-guidance.js";

const now = new Date("2026-06-12T12:00:00+08:00");

function event(hoursAgo, overrides = {}) {
  return {
    started_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    finished_at: new Date(now.getTime() - hoursAgo * 3_600_000 + 180_000).toISOString(),
    peak_intensity: 3,
    control_affected: false,
    right_hand_affected: false,
    right_foot_affected: false,
    ...overrides,
  };
}

function entry(daysAgo, overrides = {}) {
  const date = new Date(now.getTime() - daysAgo * 86_400_000);
  return {
    entry_date: date.toISOString().slice(0, 10),
    observed_at: date.toISOString(),
    baseline_change: "same",
    episode_impact: "none",
    ...overrides,
  };
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(12, { right_hand_affected: true, right_foot_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events, now), now);

  assert.equal(guidance.mode, "stabilize");
  assert.match(guidance.focus, /暂停骑电动车/);
  assert.match(guidance.steps[0].detail, /前兆/);
  assert.match(guidance.steps[1].detail, /观察 30 秒/);
  assert.match(guidance.steps[2].detail, /一次只测试一种/);
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(6, { episode_impact: "control_affected", control_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events, now), now);

  assert.equal(guidance.mode, "stabilize");
  assert.match(guidance.safety_note, /右手和右脚恢复/);
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(8), event(30)];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events, now), now);

  assert.equal(guidance.mode, "stabilize");
  assert.match(guidance.rationale, /72 小时内反复发作/);
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(80, { right_hand_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events, now), now);

  assert.equal(guidance.mode, "maintain");
  assert.match(guidance.focus, /不要主动诱发/);
}

{
  const entries = [
    entry(0, { baseline_change: "lighter" }),
    entry(1, { baseline_change: "lighter" }),
    entry(2, { baseline_change: "lighter" }),
  ];
  const trend = computeTrend(entries, [], now);

  assert.equal(trend.sample_count, 3);
  assert.equal(trend.status, "baseline");
  assert.match(trend.message, /建立个人基线/);
}

console.log("guidance tests passed");

{
  const entries = [entry(0, { baseline_change: "worse", episode_impact: "control_affected" })];
  const events = [event(4, { control_affected: true, right_hand_affected: true })];
  const checklist = buildDailyChecklist(entries, events, now);

  assert.equal(checklist.state, "stabilize");
  assert.equal(checklist.actions.length, 3);
  assert.equal(checklist.release, null);
  assert.equal(checklist.stretch, null);
  assert.match(checklist.avoid.join(" "), /骑电动车/);
  assert.match(checklist.medication, /不自行停药、加量、减量或换药/);
  assert.match(checklist.diet, /不要自行开始生酮/);
  for (const action of checklist.actions) {
    assert.ok(action.dose);
    assert.ok(action.expected);
    assert.ok(action.stop);
  }
}

{
  const staleNow = new Date("2026-06-20T08:00:00+08:00");
  const entries = [entry(8, { baseline_change: "same", episode_impact: "none" })];
  const checklist = buildDailyChecklist(entries, [], staleNow);

  assert.equal(checklist.data_stale, true);
  assert.match(checklist.basis, /最近记录日期/);
  assert.equal(checklist.state, "conservative");
}
