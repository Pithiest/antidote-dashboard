import assert from "node:assert/strict";

import {
  buildGuidance,
  computeTrend,
} from "../shared/antidote-guidance.js";

const now = new Date("2026-06-11T12:00:00+08:00");

function event(hoursAgo, overrides = {}) {
  return {
    started_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    finished_at: new Date(now.getTime() - hoursAgo * 3_600_000 + 180_000).toISOString(),
    peak_intensity: 3,
    right_hand_affected: false,
    right_foot_affected: false,
    ...overrides,
  };
}

function entry(daysAgo, overrides = {}) {
  const date = new Date(now.getTime() - daysAgo * 86_400_000);
  return {
    entry_date: date.toISOString().slice(0, 10),
    baseline_change: "same",
    episode_impact: "none",
    ...overrides,
  };
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(12, { right_hand_affected: true, right_foot_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events), now);

  assert.equal(guidance.mode, "stabilize");
  assert.match(guidance.focus, /暂停骑电动车/);
  assert.equal(guidance.steps.length, 3);
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(6, { episode_impact: "control_affected", control_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events), now);

  assert.equal(guidance.mode, "stabilize");
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(8), event(30)];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events), now);

  assert.equal(guidance.mode, "stabilize");
  assert.match(guidance.rationale, /72 小时内反复发作/);
}

{
  const entries = [entry(0), entry(1)];
  const events = [event(80, { right_hand_affected: true })];
  const guidance = buildGuidance(entries, events, computeTrend(entries, events), now);

  assert.equal(guidance.mode, "maintain");
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
  assert.doesNotMatch(trend.message, /保持节奏/);
}

console.log("guidance tests passed");
