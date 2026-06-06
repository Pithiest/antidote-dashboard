import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase-functions/antidote-api/index.ts", import.meta.url),
  "utf8",
);

assert.match(source, /const requestedQuality\s*=/);
assert.match(source, /is_active:\s*!excluded\s*&&\s*requestedQuality\s*===\s*"reviewed"/);
assert.match(source, /quality_status:\s*excluded\s*\?\s*"excluded"\s*:\s*requestedQuality/);

console.log("edge function integrity tests passed");
