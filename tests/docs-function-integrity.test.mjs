import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase-functions/antidote-docs/index.ts", import.meta.url),
  "utf8",
);

assert.match(source, /exportWordBundle/);
assert.match(source, /syncDocumentNotes/);
assert.match(source, /antidote_document_notes/);
assert.match(source, /password_sha256/);
assert.doesNotMatch(source, /const\s+(?:SITE_)?PASSWORD\s*=\s*["']/i);
assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY\s*=/);

console.log("docs function integrity tests passed");
