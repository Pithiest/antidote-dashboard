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
assert.match(appSource, /request\("loginDevice"/);
assert.match(appSource, /request\("saveCheckin"/);
assert.match(appSource, /request\("startEpisode"/);
assert.match(appSource, /request\("finishEpisode"/);
assert.match(appSource, /populateCheckinForm\(dashboard\.today_entry \|\| null\)/);
assert.doesNotMatch(appSource, /dashboard\.today_entry \|\| dashboard\.latest_entry/);
assert.match(appSource, /entry_date:\s*todayLocal\(\)/);
assert.match(appSource, /function readTodayCheckinDraft\(\)/);
assert.match(htmlSource, /id="loginForm"/);
assert.match(htmlSource, /id="episodeModal"/);
assert.match(htmlSource, />右脚失控程度\s*<output id="footValue">/);
assert.match(htmlSource, /type="checkbox" value="车把不稳"/);
assert.match(htmlSource, /type="checkbox" value="活动到静止"/);
assert.doesNotMatch(appSource, /可信设备 · 到期/);
assert.doesNotMatch(htmlSource, /https?:\/\/[^"']+\.js/);

console.log("app integrity tests passed");
