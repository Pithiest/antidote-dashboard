import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase-migration-episode-interventions.sql", import.meta.url),
  "utf8",
);

assert.match(source, /add column if not exists intervention_method text/);
assert.match(source, /add column if not exists intervention_started_at timestamptz/);
assert.match(source, /add column if not exists thirty_second_effect text/);
assert.match(source, /antidote_episode_events_intervention_method_check/);
assert.match(source, /'rhythmic_tap', 'light_touch', 'motor_imagery', 'none'/);
assert.match(source, /'half_or_more', 'less_than_half', 'none_or_worse', 'not_tested'/);

console.log("episode migration tests passed");
