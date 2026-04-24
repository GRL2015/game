const crypto = require("node:crypto");

const scoreWindow = new Map();

function hashFingerprint(raw) {
  return crypto.createHash("sha256").update(String(raw || "")).digest("hex");
}

function verifyLightweightDeviceFingerprint(fingerprint) {
  return typeof fingerprint === "string" && fingerprint.length >= 8;
}

function scoreRateLimiter(userId) {
  const now = Date.now();
  const arr = scoreWindow.get(userId) || [];
  const recent = arr.filter((t) => now - t < 10_000);
  if (recent.length >= 6) {
    scoreWindow.set(userId, recent);
    return { ok: false, reason: "rate_limited" };
  }
  recent.push(now);
  scoreWindow.set(userId, recent);
  return { ok: true };
}

function assignVariant(userId, test) {
  const seed = `${test}:${userId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "A" : "B";
}

function detectSuspiciousScore({ score, roundDurationSec }) {
  if (score > 50000) return true;
  if (roundDurationSec > 0 && score / roundDurationSec > 250) return true;
  return false;
}

function validateTelegramInitData(_initData) {
  // Stub for now: real HMAC verification can be plugged in when BOT token is set.
  return true;
}

module.exports = {
  hashFingerprint,
  verifyLightweightDeviceFingerprint,
  scoreRateLimiter,
  assignVariant,
  detectSuspiciousScore,
  validateTelegramInitData,
};
