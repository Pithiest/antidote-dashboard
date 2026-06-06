import assert from "node:assert/strict";
import {
  createTrustedDeviceToken,
  hashTrustedDeviceToken,
  parseBearerToken,
  trustedDeviceIsActive,
} from "../shared/antidote-auth.js";

const token = createTrustedDeviceToken();

assert.match(token, /^[A-Za-z0-9_-]{40,}$/);

const hash = await hashTrustedDeviceToken(token);
assert.match(hash, /^[a-f0-9]{64}$/);

assert.equal(parseBearerToken("Bearer abc123"), "abc123");
assert.equal(parseBearerToken("bearer   abc123  "), "abc123");
assert.equal(parseBearerToken("abc123"), "");

const now = new Date("2026-06-06T00:00:00.000Z");

assert.equal(
  trustedDeviceIsActive(
    {
      expires_at: "2026-12-31T00:00:00.000Z",
      revoked_at: null,
    },
    now,
  ),
  true,
);

assert.equal(
  trustedDeviceIsActive(
    {
      expires_at: "2026-06-05T23:59:59.000Z",
      revoked_at: null,
    },
    now,
  ),
  false,
);

assert.equal(
  trustedDeviceIsActive(
    {
      expires_at: "2026-12-31T00:00:00.000Z",
      revoked_at: "2026-06-06T00:00:00.000Z",
    },
    now,
  ),
  false,
);

console.log("antidote-auth tests passed");
