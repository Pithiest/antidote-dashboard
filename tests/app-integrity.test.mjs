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
assert.match(appSource, /populateCheckinForm\(dashboard\.today_entry \|\| null\)/);
assert.doesNotMatch(appSource, /dashboard\.today_entry \|\| dashboard\.latest_entry/);
assert.match(appSource, /entry_date:\s*todayLocal\(\)/);
assert.match(appSource, /function readTodayCheckinDraft\(\)/);
assert.match(htmlSource, /id="loginForm"/);
assert.match(htmlSource, /id="episodeModal"/);
assert.match(htmlSource, /name="episode_impact" value="none"/);
assert.match(htmlSource, /name="episode_impact" value="control_ok"/);
assert.match(htmlSource, /name="episode_impact" value="control_affected"/);
assert.match(htmlSource, /name="notes"/);
assert.doesNotMatch(htmlSource, /type="range"/);
assert.doesNotMatch(htmlSource, /baselineCount/);
assert.doesNotMatch(htmlSource, /7 个有效日/);
assert.doesNotMatch(appSource, /90\s*-\s*elapsedSeconds/);
assert.doesNotMatch(appSource, /EPISODE_PHASES/);
assert.doesNotMatch(appSource, /可信设备 · 到期/);
assert.match(htmlSource, /今天最重要的事/);
assert.match(htmlSource, /抽动开始/);
assert.match(htmlSource, /记录变化/);
assert.doesNotMatch(appSource + htmlSource, /\uFFFD/);
assert.doesNotMatch(htmlSource, /https?:\/\/[^"']+\.js/);

console.log("app integrity tests passed");
