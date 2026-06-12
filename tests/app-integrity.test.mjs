import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");

const requiredFunctions = [
  "loginDevice",
  "bootstrapDashboard",
  "refreshDevice",
  "logoutDevice",
  "startEpisode",
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
assert.match(htmlSource, /name="intervention_method" value="rhythmic_tap"/);
assert.match(htmlSource, /name="intervention_method" value="light_touch"/);
assert.match(htmlSource, /name="intervention_method" value="motor_imagery"/);
assert.match(htmlSource, /name="thirty_second_effect" value="half_or_more"/);
assert.match(htmlSource, /name="thirty_second_effect" value="less_than_half"/);
assert.match(htmlSource, /name="thirty_second_effect" value="none_or_worse"/);
assert.match(htmlSource, /name="right_hand_affected"/);
assert.match(htmlSource, /name="right_foot_affected"/);

assert.match(htmlSource, /先观察 30 秒/);
assert.match(htmlSource, /每次只测试一种方法/);
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

console.log("app integrity tests passed");
