import {
  createTrustedDeviceToken,
  hashTrustedDeviceToken,
  nextTrustedDeviceExpiry,
  parseBearerToken,
  trustedDeviceIsActive,
} from "../../shared/antidote-auth.js";
import {
  buildGuidance,
  computeTrend,
} from "../../shared/antidote-guidance.js";

const allowedOrigins = new Set([
  "https://antidote.pithiest.cn",
  "https://antidote-dashboard.vercel.app",
]);

type JsonRecord = Record<string, unknown>;
type RuntimeConfig = { password_sha256: string; sync_hash: string };
type GuidanceMode = "stabilize" | "maintain" | "progress" | "reassess";
type DayClass = "A" | "B" | "C";
type TrustedDeviceRow = {
  id: string;
  sync_hash: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at?: string | null;
};

let cachedRuntimeConfig: RuntimeConfig | null = null;
const TRUSTED_DEVICE_TTL_DAYS = 180;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || local ? origin : "https://antidote.pithiest.cn",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function rateLimitKey(req: Request, action: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwarded || "unknown"}:${action}`;
}

function checkRateLimit(req: Request, action: string) {
  const isLogin = action === "loginDevice";
  const windowMs = isLogin ? 10 * 60_000 : 60_000;
  const limit = isLogin ? 8 : 180;
  const now = Date.now();
  const key = rateLimitKey(req, action);
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function encode(value: string) {
  return encodeURIComponent(value);
}

function cleanText(value: unknown, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function cleanTextArray(value: unknown, maxItems = 18, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function cleanTimestamp(value: unknown) {
  const text = cleanText(value, 64);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function lowValueEvidenceTitle(value: unknown) {
  return /(supplement|proceedings|platform and poster|abstracts? of the)/i.test(cleanText(value, 300));
}

function clampInt(value: unknown, min = 0, max = 10) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function nonNegativeInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.round(numeric));
}

function nonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing Supabase Edge Function environment variables");

  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function rest(path: string, options: RequestInit = {}) {
  const res = await supabaseFetch(path, options);
  const data = await parseBody(res);
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

async function runtimeConfig() {
  if (cachedRuntimeConfig) return cachedRuntimeConfig;
  const rows = await rest("/rest/v1/antidote_runtime_config?config_key=eq.owner_auth&select=config_value&limit=1", {
    method: "GET",
  });
  const value = Array.isArray(rows) ? rows[0]?.config_value : null;
  if (!value?.password_sha256 || !value?.sync_hash) throw new Error("Runtime config is missing");
  cachedRuntimeConfig = {
    password_sha256: String(value.password_sha256),
    sync_hash: String(value.sync_hash),
  };
  return cachedRuntimeConfig;
}

async function verifySitePassword(value: unknown) {
  const password = String(value || "").trim();
  if (!password) return null;
  const config = await runtimeConfig();
  return timingSafeEqual(await sha256Hex(password), config.password_sha256) ? config.sync_hash : null;
}

async function getTrustedDeviceByHash(tokenHash: string) {
  const rows = await rest(
    `/rest/v1/antidote_trusted_devices?token_hash=eq.${encode(tokenHash)}&select=id,sync_hash,token_hash,expires_at,revoked_at,last_used_at&limit=1`,
    { method: "GET" },
  );
  return Array.isArray(rows) ? ((rows[0] as TrustedDeviceRow | undefined) || null) : null;
}

async function touchTrustedDevice(deviceId: string) {
  await rest(`/rest/v1/antidote_trusted_devices?id=eq.${encode(deviceId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      last_used_at: new Date().toISOString(),
      expires_at: nextTrustedDeviceExpiry(new Date(), TRUSTED_DEVICE_TTL_DAYS),
    }),
  });
}

async function revokeTrustedDevice(deviceId: string) {
  await rest(`/rest/v1/antidote_trusted_devices?id=eq.${encode(deviceId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
}

async function createTrustedDevice(syncHash: string) {
  const token = createTrustedDeviceToken();
  const tokenHash = await hashTrustedDeviceToken(token);
  const inserted = await rest("/rest/v1/antidote_trusted_devices", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      sync_hash: syncHash,
      token_hash: tokenHash,
      expires_at: nextTrustedDeviceExpiry(new Date(), TRUSTED_DEVICE_TTL_DAYS),
      last_used_at: new Date().toISOString(),
    }),
  });
  const device = Array.isArray(inserted) ? inserted[0] : inserted;
  return { token, device };
}

async function authFromBearer(req: Request) {
  const token = parseBearerToken(req.headers.get("authorization") || "");
  if (!token) return null;
  const tokenHash = await hashTrustedDeviceToken(token);
  const device = await getTrustedDeviceByHash(tokenHash);
  if (!trustedDeviceIsActive(device, new Date())) return null;
  await touchTrustedDevice(device.id);
  return { syncHash: device.sync_hash, device };
}

function dateValue(value: unknown) {
  return String(value || "").slice(0, 10);
}

function internalDayClass(mode: GuidanceMode): DayClass {
  if (mode === "reassess" || mode === "stabilize") return "C";
  if (mode === "progress") return "A";
  return "B";
}

function sanitizeCheckin(input: JsonRecord, syncHash: string) {
  const entry: JsonRecord = {
    sync_hash: syncHash,
    entry_date: cleanText(input.entry_date, 10) || todayInShanghai(),
    day_class: "B",
    baseline_change: cleanText(input.baseline_change, 20) || "same",
    episode_impact: cleanText(input.episode_impact, 30) || "none",
    morning_twitch: cleanText(input.morning_twitch, 40),
    walking_discomfort: clampInt(input.walking_discomfort),
    right_foot_control: clampInt(input.right_foot_control),
    episode_minutes: nonNegativeNumber(input.episode_minutes),
    episode_peak_intensity: clampInt(input.episode_peak_intensity),
    trigger_tags: cleanTextArray(input.trigger_tags, 12, 60),
    protocol_response: cleanText(input.protocol_response, 30),
    e_bike: asBoolean(input.e_bike),
    urgent_wake: asBoolean(input.urgent_wake),
    handlebar_unstable: asBoolean(input.handlebar_unstable),
    stop_after_activity_trigger: asBoolean(input.stop_after_activity_trigger),
    baseline_symptoms_changed: asBoolean(input.baseline_symptoms_changed),
    medication_taken: typeof input.medication_taken === "boolean" ? input.medication_taken : null,
    source_kind: cleanText(input.source_kind, 40) || "website",
    source_ref: cleanText(input.source_ref, 160) || "website:daily-checkin",
    observed_at: cleanTimestamp(input.observed_at) || new Date().toISOString(),
    notes: cleanText(input.notes, 1200),
    updated_at: new Date().toISOString(),
  };

  if (entry.baseline_symptoms_changed) {
    entry.hip_snap_change = cleanText(input.hip_snap_change, 100);
    entry.right_hip_external_rotation_pain = clampInt(input.right_hip_external_rotation_pain);
    entry.right_lower_leg_electric = clampInt(input.right_lower_leg_electric);
    entry.inner_thigh_acid = clampInt(input.inner_thigh_acid);
  }

  return entry;
}

function sanitizeKnowledgeCard(input: JsonRecord, syncHash: string) {
  const title = cleanText(input.title, 240) || cleanText(input.source_title, 240) || "Untitled source";
  const excluded = lowValueEvidenceTitle(title);
  const requestedQuality = cleanText(input.quality_status, 40) === "reviewed" ? "reviewed" : "candidate";
  return {
    sync_hash: syncHash,
    topic: cleanText(input.topic, 120) || "research",
    title,
    source_title: cleanText(input.source_title, 240),
    source_url: cleanText(input.source_url, 500),
    evidence_type: cleanText(input.evidence_type, 80) || "literature",
    doi: cleanText(input.doi, 160),
    pmid: cleanText(input.pmid, 40),
    publication_type: cleanText(input.publication_type, 80),
    evidence_level: cleanText(input.evidence_level, 80) || "unrated",
    relevance_score: clampInt(input.relevance_score, 0, 100),
    full_text_status: cleanText(input.full_text_status, 40) || "not_checked",
    quality_status: excluded ? "excluded" : requestedQuality,
    is_active: !excluded && requestedQuality === "reviewed",
    exclusion_reason: excluded ? "聚合补充材料、会议摘要集或标题不足以支持临床相关性判断" : "",
    verified_at: cleanTimestamp(input.verified_at),
    key_finding: cleanText(input.key_finding, 1600),
    implication: cleanText(input.implication, 1600),
    caution: cleanText(input.caution, 1200),
    query: cleanText(input.query, 500),
    updated_at: new Date().toISOString(),
  };
}

async function getEntries(syncHash: string, limit = 30) {
  return await rest(
    `/rest/v1/antidote_entries?sync_hash=eq.${encode(syncHash)}&order=entry_date.desc&limit=${limit}`,
    { method: "GET" },
  ) as JsonRecord[];
}

async function getEpisodeEvents(syncHash: string, limit = 30) {
  return await rest(
    `/rest/v1/antidote_episode_events?sync_hash=eq.${encode(syncHash)}&order=started_at.desc&limit=${limit}`,
    { method: "GET" },
  ) as JsonRecord[];
}

async function buildDashboard(syncHash: string) {
  const [entries, episodeEvents] = await Promise.all([
    getEntries(syncHash, 30),
    getEpisodeEvents(syncHash, 30),
  ]);
  const trend = computeTrend(entries, episodeEvents);
  const guidance = buildGuidance(entries, episodeEvents, trend);
  const activeEpisode = episodeEvents.find((event) => !event.finished_at) || null;
  return {
    today: todayInShanghai(),
    latest_entry: entries[0] || null,
    today_entry: entries.find((entry) => dateValue(entry.entry_date) === todayInShanghai()) || null,
    guidance,
    trend,
    active_episode: activeEpisode,
    recent_episode_count: episodeEvents.filter((event) => {
      const age = Date.now() - Date.parse(String(event.started_at));
      return age >= 0 && age <= 7 * 86_400_000;
    }).length,
    synced_at: new Date().toISOString(),
  };
}

async function upsertRecommendation(syncHash: string, entry: JsonRecord, guidance: JsonRecord, sourceEntryId?: string | null) {
  const dayClass = internalDayClass(guidance.mode as GuidanceMode);
  await rest("/rest/v1/antidote_recommendations?on_conflict=sync_hash,rec_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      sync_hash: syncHash,
      rec_date: entry.entry_date,
      source_entry_id: sourceEntryId || null,
      day_class: dayClass,
      plan_stage: guidance.title,
      primary_focus: guidance.focus,
      do_now: (guidance.steps as JsonRecord[]).map((step) => `${step.title}：${step.detail}`),
      avoid: guidance.avoid,
      next_variable: guidance.next_check,
      rationale: guidance.rationale,
      safety_note: guidance.safety_note,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function saveCheckin(syncHash: string, input: JsonRecord) {
  const entry = sanitizeCheckin(input, syncHash);
  const provisional = await rest("/rest/v1/antidote_entries?on_conflict=sync_hash,entry_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(entry),
  });
  const saved = Array.isArray(provisional) ? provisional[0] : provisional;
  const dashboard = await buildDashboard(syncHash);
  const guidance = dashboard.guidance as JsonRecord;
  const dayClass = internalDayClass(guidance.mode as GuidanceMode);
  const patched = await rest(
    `/rest/v1/antidote_entries?sync_hash=eq.${encode(syncHash)}&entry_date=eq.${encode(String(entry.entry_date))}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        day_class: dayClass,
        guidance_mode: guidance.mode,
        review_due: guidance.review_due,
        plan_stage: guidance.title,
        recommendation: `${guidance.focus}：${(guidance.steps as JsonRecord[]).map((step) => step.title).join("；")}`,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const finalEntry = Array.isArray(patched) ? patched[0] : saved;
  await upsertRecommendation(syncHash, finalEntry || entry, guidance, finalEntry?.id || saved?.id || null);
  return await buildDashboard(syncHash);
}

async function getFullBundle(syncHash: string) {
  const [entries, profiles, historicalEvents, hypotheses, recommendations, researchRuns, knowledgeCards, episodeEvents] =
    await Promise.all([
      getEntries(syncHash, 366),
      rest(`/rest/v1/antidote_profiles?sync_hash=eq.${encode(syncHash)}&limit=1`, { method: "GET" }),
      rest(
        `/rest/v1/antidote_historical_events?sync_hash=eq.${encode(syncHash)}&order=importance.desc,event_date.desc.nullslast&limit=100`,
        { method: "GET" },
      ),
      rest(`/rest/v1/antidote_hypotheses?sync_hash=eq.${encode(syncHash)}&order=priority.desc,fit_score.desc&limit=30`, {
        method: "GET",
      }),
      rest(`/rest/v1/antidote_recommendations?sync_hash=eq.${encode(syncHash)}&order=rec_date.desc&limit=90`, {
        method: "GET",
      }),
      rest(`/rest/v1/antidote_research_runs?sync_hash=eq.${encode(syncHash)}&order=run_date.desc,created_at.desc&limit=40`, {
        method: "GET",
      }),
      rest(`/rest/v1/antidote_knowledge_cards?sync_hash=eq.${encode(syncHash)}&is_active=eq.true&order=created_at.desc&limit=120`, {
        method: "GET",
      }),
      getEpisodeEvents(syncHash, 180),
    ]);
  return {
    entries,
    profile: Array.isArray(profiles) ? profiles[0] || null : null,
    historical_events: historicalEvents || [],
    hypotheses: hypotheses || [],
    recommendations: recommendations || [],
    research_runs: researchRuns || [],
    knowledge_cards: knowledgeCards || [],
    episode_events: episodeEvents || [],
  };
}

async function resolveSyncHash(req: Request, body: JsonRecord) {
  const bearerAuth = await authFromBearer(req);
  if (bearerAuth) return { syncHash: bearerAuth.syncHash, authMode: "device" as const, device: bearerAuth.device };
  const sitePassword = body.sitePassword;
  if (!sitePassword) return null;
  const syncHash = await verifySitePassword(sitePassword);
  if (!syncHash) return null;
  return { syncHash, authMode: "password" as const, device: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const action = cleanText(body.action, 80);
    if (!checkRateLimit(req, action)) return json(req, 429, { error: "请求过于频繁，请稍后再试" });

    if (action === "loginDevice") {
      const syncHash = await verifySitePassword(body.sitePassword);
      if (!syncHash) return json(req, 401, { error: "网站密码错误" });
      const { token, device } = await createTrustedDevice(syncHash);
      return json(req, 200, {
        device_token: token,
        trusted_device_expires_at: device.expires_at,
        dashboard: await buildDashboard(syncHash),
      });
    }

    const auth = await resolveSyncHash(req, body);
    if (!auth) return json(req, 401, { error: "网站密码错误" });
    const syncHash = auth.syncHash;
    const bearerAuth =
      auth.authMode === "device" && auth.device
        ? { syncHash: auth.syncHash, device: auth.device }
        : null;

    if (action === "refreshDevice") {
      if (!bearerAuth?.device) return json(req, 401, { error: "可信设备令牌无效" });
      return json(req, 200, {
        trusted_device_expires_at: nextTrustedDeviceExpiry(new Date(), TRUSTED_DEVICE_TTL_DAYS),
        dashboard: await buildDashboard(syncHash),
      });
    }

    if (action === "logoutDevice") {
      if (!bearerAuth?.device) return json(req, 401, { error: "可信设备令牌无效" });
      await revokeTrustedDevice(bearerAuth.device.id);
      return json(req, 200, { ok: true });
    }

    if (action === "bootstrapDashboard") {
      const dashboard = await buildDashboard(syncHash);
      return json(req, 200, bearerAuth?.device ? { ...dashboard, trusted_device_expires_at: nextTrustedDeviceExpiry(new Date(), TRUSTED_DEVICE_TTL_DAYS) } : dashboard);
    }

    if (action === "saveCheckin" || action === "save") {
      return json(req, 200, await saveCheckin(syncHash, body.entry || body.checkin || {}));
    }

    if (action === "startEpisode") {
      const started = await rest("/rest/v1/antidote_episode_events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          sync_hash: syncHash,
          started_at: body.started_at || new Date().toISOString(),
          trigger_tags: cleanTextArray(body.trigger_tags, 10, 60),
          source_kind: "episode_mode",
          source_ref: cleanText(body.source_ref, 160) || "website:episode-mode",
        }),
      });
      return json(req, 200, { event: Array.isArray(started) ? started[0] : started });
    }

    if (action === "finishEpisode") {
      const payload = {
        finished_at: body.finished_at || new Date().toISOString(),
        duration_seconds: nonNegativeInt(body.duration_seconds),
        trigger_tags: cleanTextArray(body.trigger_tags, 10, 60),
        peak_intensity: clampInt(body.peak_intensity),
        episode_impact: cleanText(body.episode_impact, 30) || "control_ok",
        control_affected: asBoolean(body.control_affected),
        right_foot_affected: asBoolean(body.right_foot_affected),
        right_hand_affected: asBoolean(body.right_hand_affected),
        intervention_method: cleanText(body.intervention_method, 40) || "none",
        intervention_started_at: cleanTimestamp(body.intervention_started_at),
        thirty_second_effect: cleanText(body.thirty_second_effect, 40) || "not_tested",
        protocol_response:
          cleanText(body.thirty_second_effect, 40) ||
          cleanText(body.protocol_response, 30) ||
          "not_tested",
        source_kind: "episode_mode",
        source_ref: cleanText(body.source_ref, 160) || "website:episode-mode",
        notes: cleanText(body.notes, 800),
        updated_at: new Date().toISOString(),
      };
      let event;
      if (body.event_id) {
        const updated = await rest(
          `/rest/v1/antidote_episode_events?id=eq.${encode(String(body.event_id))}&sync_hash=eq.${encode(syncHash)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload),
          },
        );
        event = Array.isArray(updated) ? updated[0] : updated;
      } else {
        const inserted = await rest("/rest/v1/antidote_episode_events", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            sync_hash: syncHash,
            started_at: body.started_at || new Date(Date.now() - Number(payload.duration_seconds || 0) * 1000).toISOString(),
            ...payload,
          }),
        });
        event = Array.isArray(inserted) ? inserted[0] : inserted;
      }
      return json(req, 200, { event, ...(await buildDashboard(syncHash)) });
    }

    if (action === "list" || action === "bootstrap") {
      return json(req, 200, await getFullBundle(syncHash));
    }

    if (action === "saveResearch") {
      const payload = {
        sync_hash: syncHash,
        run_date: body.run_date || todayInShanghai(),
        query_set: Array.isArray(body.query_set) ? body.query_set : [],
        sources: Array.isArray(body.sources) ? body.sources : [],
        findings: cleanText(body.findings, 4000),
        implication: cleanText(body.implication, 4000),
      };
      const saved = await rest("/rest/v1/antidote_research_runs", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      return json(req, 200, {
        research_run: Array.isArray(saved) ? saved[0] : saved,
        ...(await getFullBundle(syncHash)),
      });
    }

    if (action === "saveKnowledgeCards") {
      const cards = Array.isArray(body.cards) ? body.cards.slice(0, 20) : [];
      const payload = cards
        .map((card) => sanitizeKnowledgeCard(card as JsonRecord, syncHash))
        .filter((card) => card.title && card.source_url);
      if (payload.length) {
        await rest("/rest/v1/antidote_knowledge_cards?on_conflict=sync_hash,title,source_url", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(payload),
        });
      }
      return json(req, 200, { saved_count: payload.length, ...(await getFullBundle(syncHash)) });
    }

    return json(req, 400, { error: "Unknown action" });
  } catch (error) {
    return json(req, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});
