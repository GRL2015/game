const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const { initDb, getDb } = require("./db");
const { assignVariant, detectSuspiciousScore, scoreRateLimiter, validateTelegramInitData, verifyLightweightDeviceFingerprint } = require("./security");
const { logEvent } = require("./telemetry");

function createApp() {
  initDb();
  const db = getDb();
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "neon-drift-backend" });
  });

  app.post("/api/auth/telegram", (req, res) => {
    const { tgUserId, username, initData, fingerprint } = req.body || {};
    if (!tgUserId) return res.status(400).json({ error: "tgUserId required" });
    if (initData && !validateTelegramInitData(initData)) {
      return res.status(401).json({ error: "invalid initData signature" });
    }
    if (!verifyLightweightDeviceFingerprint(fingerprint || "")) {
      return res.status(400).json({ error: "invalid fingerprint" });
    }

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (tg_user_id, username, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tg_user_id) DO UPDATE SET username=excluded.username, updated_at=excluded.updated_at`
    ).run(String(tgUserId), username || null, now, now);

    const user = db.prepare("SELECT * FROM users WHERE tg_user_id = ?").get(String(tgUserId));
    const variant = assignVariant(String(tgUserId), "ui-layout");
    logEvent({ userId: user.id, eventName: "auth.telegram", payload: { variant } });
    return res.json({ user, variant });
  });

  app.post("/api/score/submit", (req, res) => {
    const { tgUserId, score, durationMs, result, fingerprint } = req.body || {};
    if (!tgUserId || typeof score !== "number" || typeof durationMs !== "number") {
      return res.status(400).json({ error: "tgUserId, score, durationMs required" });
    }
    if (!verifyLightweightDeviceFingerprint(fingerprint || "")) {
      return res.status(400).json({ error: "invalid fingerprint" });
    }
    const rate = scoreRateLimiter(String(tgUserId));
    if (!rate.ok) return res.status(429).json({ error: rate.reason });

    const user = db.prepare("SELECT * FROM users WHERE tg_user_id = ?").get(String(tgUserId));
    if (!user) return res.status(404).json({ error: "user not found" });

    const suspicious = detectSuspiciousScore({
      score,
      durationSec: durationMs / 1000,
      level: user.level,
    });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO matches (user_id, score, duration_ms, result, suspicious, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user.id, score, durationMs, result || "unknown", suspicious ? 1 : 0, now);

    db.prepare(
      `INSERT INTO leaderboards (user_id, board_type, score, season_key, updated_at)
       VALUES (?, 'global', ?, 'all-time', ?)
       ON CONFLICT(user_id, board_type, season_key)
       DO UPDATE SET score = MAX(score, excluded.score), updated_at = excluded.updated_at`
    ).run(user.id, score, now);

    logEvent({ userId: user.id, eventName: "score.submit", payload: { score, suspicious } });
    return res.json({ accepted: true, suspicious });
  });

  app.get("/api/leaderboard/global", (_req, res) => {
    const rows = db.prepare(
      `SELECT u.username, l.score
       FROM leaderboards l
       JOIN users u ON u.id = l.user_id
       WHERE l.board_type = 'global' AND l.season_key = 'all-time'
       ORDER BY l.score DESC
       LIMIT 100`
    ).all();
    res.json({ rows });
  });

  app.post("/api/analytics/track", (req, res) => {
    const { tgUserId, eventName, properties = {}, sessionId = randomUUID() } = req.body || {};
    if (!eventName) return res.status(400).json({ error: "eventName required" });
    let userId = null;
    if (tgUserId) {
      const user = db.prepare("SELECT id FROM users WHERE tg_user_id = ?").get(String(tgUserId));
      userId = user ? user.id : null;
    }
    db.prepare(
      "INSERT INTO analytics_events (user_id, event_name, properties, session_id, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, eventName, JSON.stringify(properties), sessionId, new Date().toISOString());
    return res.json({ ok: true });
  });

  return app;
}

module.exports = { createApp };
