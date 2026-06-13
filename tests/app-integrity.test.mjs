import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const vercelConfig = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
);

const requiredFunctions = [
  "loginDevice",
  "bootstrapDashboard",
  "refreshDevice",
  "logoutDevice",
  "startEpisode",
  "recordBaselineJerk",
  "recordInterventionJerk",
  "beginIntervention",
  "showEpisodeFinish",
  "finishEpisode",
  "flushQueue",
  "bindEvents",
  "openCheckinModal",
];

for (const functionName of requiredFunctions) {
  assert.match(
    appSource,
    new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`),
    `app.js is missing ${functionName}()`,
  );
}

assert.match(appSource, /localStorage\.setItem\(STORAGE_KEYS\.deviceToken/);
assert.match(appSource, /request\(\s*"loginDevice"/);
assert.match(appSource, /request\("saveCheckin"/);
assert.match(appSource, /request\("startEpisode"/);
assert.match(appSource, /request\("finishEpisode"/);
assert.match(appSource, /intervention_method:/);
assert.match(appSource, /thirty_second_effect:/);
assert.match(appSource, /right_hand_affected:/);
assert.match(appSource, /right_foot_affected:/);
assert.match(appSource, /function readTodayCheckinDraft\(\)/);
assert.match(appSource, /entry_date:\s*todayLocal\(\)/);

assert.match(htmlSource, /id="loginForm"/);
assert.match(htmlSource, /id="episodeModal"/);
assert.match(htmlSource, /id="episodeObserveView"/);
assert.match(htmlSource, /id="episodeInterventionView"/);
assert.match(htmlSource, /id="baselineJerkButton"/);
assert.match(htmlSource, /id="baselineIntervalSummary"/);
assert.match(htmlSource, /id="interventionJerkButton"/);
assert.match(htmlSource, /name="intervention_method" value="rhythmic_tap"/);
assert.match(htmlSource, /name="thirty_second_effect" value="half_or_more"/);
assert.match(htmlSource, /name="thirty_second_effect" value="less_than_half"/);
assert.match(htmlSource, /name="thirty_second_effect" value="none_or_worse"/);
assert.match(htmlSource, /name="right_hand_affected"/);
assert.match(htmlSource, /name="right_foot_affected"/);

assert.match(htmlSource, /记录连续 2 个抽动间隔/);
assert.match(htmlSource, /3 分钟左手节律/);
assert.doesNotMatch(htmlSource, /先观察 30 秒/);
assert.match(appSource, /180_000/);
assert.match(appSource, /baseline_jerk_times/);
assert.match(appSource, /intervention_jerk_count/);
assert.match(appSource, /基线间隔/);
assert.match(appSource, /3 分钟抽动/);
assert.match(appSource, /const EPISODE_GUIDANCE_STEPS/);
assert.match(htmlSource, /抽动开始/);
assert.match(htmlSource, /记录变化/);
assert.match(htmlSource, /id="rehabActions"/);
assert.match(htmlSource, /id="dietAdvice"/);
assert.match(htmlSource, /id="medicationAdvice"/);
assert.match(appSource, /function renderChecklist\(/);
assert.match(appSource, /function fallbackChecklist\(/);
assert.match(appSource, /Date\.now\(\) - latestTimestamp > 36 \* 3_600_000/);
assert.match(appSource, /没有新数据时按保守规则显示/);
assert.match(appSource, /stale \|\|/);
assert.doesNotMatch(htmlSource, /type="range"/);
assert.doesNotMatch(htmlSource, /知识库|研究复盘|Day 0|Day 1|A\/B\/C/);
assert.doesNotMatch(appSource + htmlSource, /\uFFFD/);
assert.doesNotMatch(htmlSource, /https?:\/\/[^"']+\.js/);
assert.equal(vercelConfig.outputDirectory, "public");

console.log("app integrity tests passed");
