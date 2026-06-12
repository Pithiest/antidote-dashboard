const allowedOrigins = new Set([
  "https://antidote.pithiest.cn",
  "https://antidote-dashboard.vercel.app",
]);

type JsonRecord = Record<string, unknown>;
type RuntimeConfig = { password_sha256: string; sync_hash: string };

let cachedRuntimeConfig: RuntimeConfig | null = null;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || local
      ? origin
      : "https://antidote.pithiest.cn",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function encode(value: string) {
  return encodeURIComponent(value);
}

function cleanText(value: unknown, max = 6000) {
  return String(value || "").trim().slice(0, max);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value.trim()),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rest(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase environment");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await parseBody(response);
  if (!response.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

async function runtimeConfig() {
  if (cachedRuntimeConfig) return cachedRuntimeConfig;
  const rows = await rest(
    "/rest/v1/antidote_runtime_config?config_key=eq.owner_auth&select=config_value&limit=1",
    { method: "GET" },
  );
  const value = Array.isArray(rows) ? rows[0]?.config_value : null;
  if (!value?.password_sha256 || !value?.sync_hash) throw new Error("Runtime config is missing");
  cachedRuntimeConfig = {
    password_sha256: String(value.password_sha256),
    sync_hash: String(value.sync_hash),
  };
  return cachedRuntimeConfig;
}

async function verifyPassword(value: unknown) {
  const password = cleanText(value, 200);
  if (!password) return null;
  const config = await runtimeConfig();
  return timingSafeEqual(await sha256Hex(password), config.password_sha256)
    ? config.sync_hash
    : null;
}

async function getDocumentNotes(syncHash: string) {
  return await rest(
    `/rest/v1/antidote_document_notes?sync_hash=eq.${encode(syncHash)}&order=document_key.asc,note_type.asc,updated_at.desc`,
    { method: "GET" },
  );
}

async function exportBundle(syncHash: string) {
  const queries = [
    ["entries", `/rest/v1/antidote_entries?sync_hash=eq.${encode(syncHash)}&order=entry_date.desc&limit=366`],
    ["profile", `/rest/v1/antidote_profiles?sync_hash=eq.${encode(syncHash)}&limit=1`],
    ["historical_events", `/rest/v1/antidote_historical_events?sync_hash=eq.${encode(syncHash)}&order=importance.desc,event_date.desc.nullslast&limit=100`],
    ["hypotheses", `/rest/v1/antidote_hypotheses?sync_hash=eq.${encode(syncHash)}&order=priority.desc,fit_score.desc&limit=30`],
    ["recommendations", `/rest/v1/antidote_recommendations?sync_hash=eq.${encode(syncHash)}&order=rec_date.desc&limit=90`],
    ["research_runs", `/rest/v1/antidote_research_runs?sync_hash=eq.${encode(syncHash)}&order=run_date.desc,created_at.desc&limit=40`],
    ["knowledge_cards", `/rest/v1/antidote_knowledge_cards?sync_hash=eq.${encode(syncHash)}&is_active=eq.true&order=created_at.desc&limit=120`],
    ["episode_events", `/rest/v1/antidote_episode_events?sync_hash=eq.${encode(syncHash)}&order=started_at.desc&limit=180`],
  ] as const;
  const values = await Promise.all(
    queries.map(([, path]) => rest(path, { method: "GET" })),
  );
  const result: JsonRecord = {};
  queries.forEach(([key], index) => {
    result[key] = key === "profile" && Array.isArray(values[index])
      ? values[index][0] || null
      : values[index] || [];
  });
  result.document_notes = await getDocumentNotes(syncHash);
  return result;
}

async function syncDocumentNotes(syncHash: string, notes: unknown) {
  const payload = (Array.isArray(notes) ? notes : [])
    .slice(0, 20)
    .map((note) => note as JsonRecord)
    .map((note) => ({
      sync_hash: syncHash,
      document_key: cleanText(note.document_key, 60),
      section_key: cleanText(note.section_key, 100) || "general",
      note_type: cleanText(note.note_type, 30),
      content: cleanText(note.content),
      source_kind: "word",
      updated_at: new Date().toISOString(),
    }))
    .filter(
      (note) =>
        ["dossier", "diary", "today"].includes(note.document_key) &&
        ["personal", "expert"].includes(note.note_type) &&
        note.content,
    );
  if (payload.length) {
    await rest(
      "/rest/v1/antidote_document_notes?on_conflict=sync_hash,document_key,section_key,note_type",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      },
    );
  }
  return { saved_count: payload.length, document_notes: await getDocumentNotes(syncHash) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });
  try {
    const body = await req.json();
    const syncHash = await verifyPassword(body.sitePassword);
    if (!syncHash) return json(req, 401, { error: "网站密码错误" });
    if (body.action === "exportWordBundle") {
      return json(req, 200, await exportBundle(syncHash));
    }
    if (body.action === "syncDocumentNotes") {
      return json(req, 200, await syncDocumentNotes(syncHash, body.notes));
    }
    return json(req, 400, { error: "Unknown action" });
  } catch (error) {
    return json(req, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});
