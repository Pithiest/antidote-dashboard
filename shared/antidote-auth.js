const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function trimToken(value) {
  return String(value ?? "").trim();
}

export function createTrustedDeviceToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(trimToken(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashTrustedDeviceToken(token) {
  return await sha256Hex(token);
}

export function parseBearerToken(value) {
  const text = trimToken(value);
  const match = /^bearer\s+(.+)$/i.exec(text);
  return match ? match[1].trim() : "";
}

export function trustedDeviceIsActive(row, now = new Date()) {
  if (!row) return false;
  if (row.revoked_at) return false;
  if (!row.expires_at) return false;
  const expiry = Date.parse(String(row.expires_at));
  if (!Number.isFinite(expiry)) return false;
  return expiry > now.getTime();
}

export function nextTrustedDeviceExpiry(now = new Date(), days = 180) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
