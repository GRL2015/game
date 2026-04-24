const crypto = require("node:crypto");

const scoreWindow = new Map();
const scoreHistory = new Map();

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

function pushScoreHistory(userId, score) {
  const list = scoreHistory.get(userId) || [];
  list.push({ score, at: Date.now() });
  const trimmed = list.slice(-12);
  scoreHistory.set(userId, trimmed);
  return trimmed;
}

function scoreJumpSuspicious(history, score) {
  if (history.length < 3) return false;
  const baseline = history.slice(0, -1).map((x) => x.score);
  const avg = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
  // Large sudden jump can indicate tampering.
  return avg > 0 && score > avg * 6.5;
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

function evaluateScoreRisk({ userId, score, roundDurationSec, actionsPerMinute }) {
  let flags = [];
  if (detectSuspiciousScore({ score, roundDurationSec })) {
    flags.push("score_rate_anomaly");
  }
  if (actionsPerMinute && actionsPerMinute > 1200) {
    flags.push("apm_unrealistic");
  }
  const history = pushScoreHistory(userId, score);
  if (scoreJumpSuspicious(history, score)) {
    flags.push("abrupt_score_jump");
  }
  return {
    suspicious: flags.length > 0,
    flags,
    trustScore: Math.max(0, 100 - flags.length * 25),
  };
}

function verifyPaymentSignature({ provider, providerTxnId, sku, amountCents, currency, signature, secret }) {
  if (!secret) return false;
  const message = [provider, providerTxnId, sku, String(amountCents), currency].join("|");
  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
}

function detectImpossibleProgression({ reportedLevel, reportedXp, maxAllowedLevelGain = 4, maxAllowedXpGain = 2200 }) {
  if (reportedLevel > maxAllowedLevelGain + 1) return true;
  if (reportedXp > maxAllowedXpGain) return true;
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
  evaluateScoreRisk,
  verifyPaymentSignature,
  detectImpossibleProgression,
  validateTelegramInitData,
};
