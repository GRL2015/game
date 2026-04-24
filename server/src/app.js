const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const { initDb, getDb } = require("./db");
const {
  assignVariant,
  scoreRateLimiter,
  validateTelegramInitData,
  verifyLightweightDeviceFingerprint,
  hashFingerprint,
  verifyPaymentSignature,
  detectImpossibleProgression,
  evaluateScoreRisk,
} = require("./security");
const { logEvent, summarizeRetention } = require("./telemetry");
const { CONFIG, missions, events, pricing } = require("./config");

function nowIso() {
  return new Date().toISOString();
}

function currentSeasonKey() {
  const d = new Date();
  const week = Math.ceil((d.getUTCDate() + new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).getUTCDay()) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function nextRotatingShop(seed) {
  const allEntries = [
    ...(pricing.boosts || []).map((b) => ({ kind: "boost", id: b.id, gemCost: b.gemCost })),
    { kind: "bundle", id: "starter-pack", usd: pricing.starterPack?.usd || 4.99 },
    { kind: "bundle", id: "street-crate-3", credits: (pricing.lootBoxes?.streetCrateCreditCost || 420) * 3 - 100 },
    { kind: "bundle", id: "premium-crate-2", gems: (pricing.lootBoxes?.premiumCrateGemCost || 55) * 2 - 15 },
  ];
  const idx = Math.abs(seed) % allEntries.length;
  return [allEntries[idx], allEntries[(idx + 2) % allEntries.length], allEntries[(idx + 4) % allEntries.length]];
}

function getUserByPublicId(db, publicId) {
  return db.prepare("SELECT * FROM users WHERE tg_user_id = ?").get(String(publicId));
}

function createApp() {
  initDb();
  const db = getDb();
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: CONFIG.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "neon-drift-backend" });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      missions,
      events,
      pricing,
    });
  });

  app.post("/api/auth/session", (req, res) => {
    const { userId, username, fingerprint, initData } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (CONFIG.telegramValidationEnabled && initData && !validateTelegramInitData(initData)) {
      return res.status(401).json({ error: "invalid initData signature" });
    }
    if (!verifyLightweightDeviceFingerprint(fingerprint || "")) {
      return res.status(400).json({ error: "invalid fingerprint" });
    }
    const fingerprintHash = hashFingerprint(fingerprint);
    db.prepare(
      `INSERT INTO users (tg_user_id, username, created_at, updated_at, last_login)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tg_user_id) DO UPDATE SET
         username = excluded.username,
         updated_at = excluded.updated_at,
         last_login = excluded.last_login`
    ).run(String(userId), username || String(userId), nowIso(), nowIso(), nowIso());
    const user = db.prepare("SELECT * FROM users WHERE tg_user_id = ?").get(String(userId));
    const variant = assignVariant(String(userId), "ui-layout");
    const dayKey = new Date().toISOString().slice(0, 10);
    const existingRotation = db.prepare("SELECT payload FROM shop_rotations WHERE user_id = ? AND day_key = ?").get(user.id, dayKey);
    if (!existingRotation) {
      const rotation = nextRotatingShop(Number(user.id));
      db.prepare(
        "INSERT INTO shop_rotations (id, user_id, day_key, payload, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), user.id, dayKey, JSON.stringify(rotation), nowIso());
    }
    logEvent({
      db,
      userId: user.id,
      eventName: "auth.session",
      properties: { variant, fingerprintHash: fingerprintHash.slice(0, 16) },
      sessionId: randomUUID(),
    });
    return res.json({ ok: true, user, variant });
  });

  app.get("/api/profile/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const inventory = db.prepare("SELECT item_type, item_id, qty, equipped, metadata FROM inventories WHERE user_id = ?").all(user.id);
    const friends = db.prepare(
      `SELECT u.tg_user_id AS friendUserId, f.status
       FROM friendships f
       JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = ?`
    ).all(user.id);
    const comeback = db.prepare("SELECT id, reward_type, reward_value, claimed FROM comeback_rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT 3").all(user.id);
    const rotation = db.prepare("SELECT payload FROM shop_rotations WHERE user_id = ? AND day_key = ?").get(user.id, new Date().toISOString().slice(0, 10));
    const missionState = db.prepare(
      "SELECT mission_id, progress, claimed, period_key FROM missions_state WHERE user_id = ? AND period_key = ?"
    ).all(user.id, new Date().toISOString().slice(0, 10));
    res.json({
      user,
      inventory,
      friends,
      comebackRewards: comeback,
      shopRotation: rotation ? JSON.parse(rotation.payload) : [],
      missions: missionState,
    });
  });

  app.post("/api/score/submit", (req, res) => {
    const {
      userId,
      score,
      roundDurationSec,
      level = 1,
      won = false,
      fingerprint,
      missionDelta = {},
      passXp = 0,
      actionsPerMinute = 0,
    } = req.body || {};
    if (!userId || typeof score !== "number" || typeof roundDurationSec !== "number") {
      return res.status(400).json({ error: "userId, score, roundDurationSec required" });
    }
    if (!verifyLightweightDeviceFingerprint(fingerprint || "")) {
      return res.status(400).json({ error: "invalid fingerprint" });
    }
    const limiter = scoreRateLimiter(String(userId));
    if (!limiter.ok) {
      return res.status(429).json({ error: limiter.reason });
    }
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });

    const scoreRisk = evaluateScoreRisk({
      userId: String(userId),
      score,
      roundDurationSec,
      level,
      actionsPerMinute,
      previousBest: user.best_score || 0,
      historicalAverage: (user.best_score || 0) * 0.35 + 150,
    });

    const suspicious = scoreRisk.suspicious;
    db.prepare(
      `INSERT INTO matches (user_id, score, duration_ms, result, payload, device_fingerprint, suspicious, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.id,
      score,
      Math.floor(roundDurationSec * 1000),
      won ? "win" : "loss",
      JSON.stringify({ level, missionDelta, riskFlags: scoreRisk.flags }),
      hashFingerprint(fingerprint),
      suspicious ? 1 : 0,
      nowIso()
    );
    if (!suspicious) {
      db.prepare(
        `INSERT INTO leaderboards (user_id, board_type, score, season_key, updated_at)
         VALUES (?, 'global', ?, 'all-time', ?)
         ON CONFLICT(user_id, board_type, season_key)
         DO UPDATE SET score = MAX(score, excluded.score), updated_at = excluded.updated_at`
      ).run(user.id, score, nowIso());
      db.prepare(
        `INSERT INTO leaderboards (user_id, board_type, score, season_key, updated_at)
         VALUES (?, 'weekly', ?, ?, ?)
         ON CONFLICT(user_id, board_type, season_key)
         DO UPDATE SET score = MAX(score, excluded.score), updated_at = excluded.updated_at`
      ).run(user.id, score, currentSeasonKey(), nowIso());
    }

    const progressionBad = detectImpossibleProgression({
      reportedLevel: level,
      reportedXp: Number(passXp || 0),
      maxAllowedLevelGain: 4,
      maxAllowedXpGain: 2200,
    });

    const today = new Date().toISOString().slice(0, 10);
    Object.entries(missionDelta || {}).forEach(([missionId, delta]) => {
      db.prepare(
        `INSERT INTO missions_state (user_id, mission_id, progress, claimed, period_key, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT(user_id, mission_id, period_key)
         DO UPDATE SET progress = missions_state.progress + excluded.progress, updated_at = excluded.updated_at`
      ).run(user.id, missionId, Number(delta || 0), today, nowIso());
    });

    const activeSeason = (events.season && events.season.id) || "default-season";
    db.prepare(
      `INSERT INTO events_state (user_id, event_id, pass_level, pass_xp, premium_unlocked, updated_at)
       VALUES (?, ?, 1, ?, 0, ?)
       ON CONFLICT(user_id, event_id)
       DO UPDATE SET pass_xp = events_state.pass_xp + excluded.pass_xp, updated_at = excluded.updated_at`
    ).run(user.id, activeSeason, Number(passXp || 0), nowIso());

    db.prepare(
      `UPDATE users
       SET best_score = CASE WHEN COALESCE(best_score, 0) < ? THEN ? ELSE COALESCE(best_score, 0) END,
           updated_at = ?
       WHERE id = ?`
    ).run(score, score, nowIso(), user.id);

    logEvent({
      db,
      userId: user.id,
      eventName: "score.submit",
      properties: { score, roundDurationSec, suspicious, progressionBad, won },
      sessionId: randomUUID(),
    });

    res.json({
      accepted: true,
      suspicious: suspicious || progressionBad,
      trustScore: scoreRisk.trustScore,
      riskFlags: scoreRisk.flags,
    });
  });

  app.get("/api/leaderboard/global", (req, res) => {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const rows = db.prepare(
      `SELECT u.tg_user_id AS userId, u.username, l.score
       FROM leaderboards l
       JOIN users u ON u.id = l.user_id
       WHERE l.board_type = 'global' AND l.season_key = 'all-time'
       ORDER BY l.score DESC
       LIMIT ?`
    ).all(limit);
    res.json({ rows });
  });

  app.get("/api/leaderboard/weekly", (_req, res) => {
    const rows = db.prepare(
      `SELECT u.tg_user_id AS userId, u.username, l.score
       FROM leaderboards l
       JOIN users u ON u.id = l.user_id
       WHERE l.board_type = 'weekly' AND l.season_key = ?
       ORDER BY l.score DESC
       LIMIT 100`
    ).all(currentSeasonKey());
    res.json({ rows, seasonKey: currentSeasonKey() });
  });

  app.get("/api/missions/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const today = new Date().toISOString().slice(0, 10);
    const states = db.prepare(
      "SELECT mission_id, progress, claimed FROM missions_state WHERE user_id = ? AND period_key = ?"
    ).all(user.id, today);
    res.json({ dayKey: today, missions: missions.dailyMissions || [], premiumMission: missions.premiumMission || null, states });
  });

  app.post("/api/missions/claim", (req, res) => {
    const { userId, missionId, reward = {} } = req.body || {};
    if (!userId || !missionId) return res.status(400).json({ error: "userId and missionId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      "UPDATE missions_state SET claimed = 1, updated_at = ? WHERE user_id = ? AND mission_id = ? AND period_key = ?"
    ).run(nowIso(), user.id, missionId, today);
    const credits = Number(reward.credits || 0);
    const gems = Number(reward.gems || 0);
    const xp = Number(reward.xp || 0);
    db.prepare(
      "UPDATE users SET soft_currency = soft_currency + ?, hard_currency = hard_currency + ?, xp = xp + ?, updated_at = ? WHERE id = ?"
    ).run(credits, gems, xp, nowIso(), user.id);
    logEvent({ db, userId: user.id, eventName: "missions.claim", properties: { missionId, reward }, sessionId: randomUUID() });
    res.json({ ok: true });
  });

  app.get("/api/events/current", (_req, res) => {
    res.json({ season: events.season || null, weeklyEvents: events.weeklyEvents || [] });
  });

  app.post("/api/events/pass/progress", (req, res) => {
    const { userId, eventId, xpDelta = 0 } = req.body || {};
    if (!userId || !eventId) return res.status(400).json({ error: "userId and eventId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    db.prepare(
      `INSERT INTO events_state (user_id, event_id, pass_level, pass_xp, premium_unlocked, updated_at)
       VALUES (?, ?, 1, ?, 0, ?)
       ON CONFLICT(user_id, event_id)
       DO UPDATE SET pass_xp = pass_xp + excluded.pass_xp, updated_at = excluded.updated_at`
    ).run(user.id, eventId, Number(xpDelta), nowIso());
    res.json({ ok: true });
  });

  app.post("/api/social/friend", (req, res) => {
    const { userId, friendUserId, relationship = "friend", rivalRank = null } = req.body || {};
    if (!userId || !friendUserId) return res.status(400).json({ error: "userId and friendUserId required" });
    const user = getUserByPublicId(db, userId);
    const friend = getUserByPublicId(db, friendUserId);
    if (!user || !friend) return res.status(404).json({ error: "user not found" });
    db.prepare(
      `INSERT INTO friendships (id, user_id, friend_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'accepted', ?, ?)
       ON CONFLICT(user_id, friend_user_id)
       DO UPDATE SET status = 'accepted', updated_at = excluded.updated_at`
    ).run(randomUUID(), user.id, friend.id, nowIso(), nowIso());
    if (relationship === "rival") {
      db.prepare(
        `INSERT INTO rival_links (user_id, rival_user_id, rival_rank, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, rival_user_id)
         DO UPDATE SET rival_rank = excluded.rival_rank`
      ).run(user.id, friend.id, rivalRank, nowIso());
    }
    res.json({ ok: true });
  });

  app.get("/api/social/friends/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const rows = db.prepare(
      `SELECT u.tg_user_id AS friend_id, u.username, f.status
       FROM friendships f
       JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = ? AND f.status = 'accepted'
       ORDER BY f.updated_at DESC
       LIMIT 50`
    ).all(user.id);
    res.json({ rows });
  });

  app.get("/api/social/rivals/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const rows = db.prepare(
      `SELECT u.tg_user_id AS userId, u.username, r.rival_rank
       FROM rival_links r
       JOIN users u ON u.id = r.rival_user_id
       WHERE r.user_id = ?
       ORDER BY COALESCE(r.rival_rank, 999) ASC, r.created_at DESC
       LIMIT 5`
    ).all(user.id);
    res.json({ rows });
  });

  app.post("/api/social/challenge", (req, res) => {
    const { userId, targetUserId, scoreToBeat } = req.body || {};
    if (!userId || !targetUserId) return res.status(400).json({ error: "userId and targetUserId required" });
    const sourceUser = getUserByPublicId(db, userId);
    const targetUser = getUserByPublicId(db, targetUserId);
    if (!sourceUser || !targetUser) return res.status(404).json({ error: "user not found" });
    const challengeId = randomUUID();
    db.prepare(
      `INSERT INTO challenge_links (link_token, from_user_id, to_user_id, target_score, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      challengeId,
      sourceUser.id,
      targetUser.id,
      Number(scoreToBeat || 0),
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      nowIso()
    );
    const deepLink = `${CONFIG.challengeBaseUrl}?challenge=${challengeId}&from=${encodeURIComponent(userId)}&to=${encodeURIComponent(targetUserId)}&score=${Number(scoreToBeat || 0)}`;
    res.json({
      challengeId,
      deepLink,
      shareText: `I scored ${Number(scoreToBeat || 0)} in Nova Blitz Arena. Beat me: ${deepLink}`,
    });
  });

  app.post("/api/comeback/grant", (req, res) => {
    const { userId, daysAway = 0 } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const credits = daysAway >= 7 ? 600 : daysAway >= 3 ? 280 : 120;
    const gems = daysAway >= 7 ? 30 : daysAway >= 3 ? 15 : 8;
    db.prepare(
      "INSERT INTO comeback_rewards (id, user_id, reward_type, reward_value, claimed, created_at) VALUES (?, ?, 'bundle', ?, 0, ?)"
    ).run(randomUUID(), user.id, JSON.stringify({ credits, gems }), nowIso());
    res.json({ ok: true, reward: { credits, gems } });
  });

  app.post("/api/comeback/claim", (req, res) => {
    const { userId, rewardId } = req.body || {};
    if (!userId || !rewardId) return res.status(400).json({ error: "userId and rewardId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const reward = db.prepare("SELECT * FROM comeback_rewards WHERE id = ? AND user_id = ?").get(String(rewardId), user.id);
    if (!reward || reward.claimed) return res.status(400).json({ error: "reward unavailable" });
    const parsedReward = JSON.parse(reward.reward_value || "{}");
    const credits = Number(parsedReward.credits || 500);
    const gems = Number(parsedReward.gems || 20);
    db.prepare("UPDATE comeback_rewards SET claimed = 1, claimed_at = ? WHERE id = ?").run(nowIso(), String(rewardId));
    db.prepare(
      "UPDATE users SET soft_currency = soft_currency + ?, hard_currency = hard_currency + ?, updated_at = ? WHERE id = ?"
    ).run(credits, gems, nowIso(), user.id);
    res.json({ ok: true, reward: { credits, gems } });
  });

  app.get("/api/shop/rotation/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const dayKey = new Date().toISOString().slice(0, 10);
    let row = db.prepare("SELECT payload FROM shop_rotations WHERE user_id = ? AND day_key = ?").get(user.id, dayKey);
    if (!row) {
      const rotation = nextRotatingShop(Number(user.id));
      db.prepare(
        "INSERT INTO shop_rotations (id, user_id, day_key, payload, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), user.id, dayKey, JSON.stringify(rotation), nowIso());
      row = { payload: JSON.stringify(rotation) };
    }
    const items = JSON.parse(row.payload);
    res.json({ dayKey, items, offers: items });
  });

  app.post("/api/shop/funnel/starter", (req, res) => {
    const { userId, accepted } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = db.prepare("SELECT id FROM users WHERE tg_user_id = ?").get(String(userId));
    if (!user) return res.status(404).json({ error: "user not found" });
    db.prepare(
      "INSERT INTO starter_funnel (id, user_id, accepted, created_at) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), user.id, accepted ? 1 : 0, nowIso());
    res.json({ ok: true });
  });

  app.post("/api/purchase/log", (req, res) => {
    const { userId, provider, providerTxnId, sku, amountCents, currency = "USD", status = "pending", payload = {} } = req.body || {};
    if (!userId || !provider || !sku) return res.status(400).json({ error: "userId, provider, sku required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    db.prepare(
      `INSERT INTO purchases (id, user_id, provider, provider_txn_id, sku, amount_cents, currency, status, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), user.id, provider, providerTxnId || null, sku, Number(amountCents || 0), currency, status, JSON.stringify(payload), nowIso());
    res.json({ ok: true });
  });

  app.post("/api/purchase/verify", (req, res) => {
    const { userId, provider, providerTxnId, sku, amountCents, currency = "USD", signature, payload = {} } = req.body || {};
    if (!userId || !provider || !providerTxnId || !sku || !signature) {
      return res.status(400).json({ error: "userId, provider, providerTxnId, sku, signature required" });
    }
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const valid = verifyPaymentSignature({
      provider,
      providerTxnId,
      sku,
      amountCents: Number(amountCents || 0),
      currency,
      signature,
      secret: CONFIG.purchaseWebhookSecret,
    });
    const purchaseStatus = valid ? "verified" : "rejected";
    db.prepare(
      `INSERT INTO purchases (id, user_id, provider, provider_txn_id, sku, amount_cents, currency, status, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), user.id, provider, providerTxnId, sku, Number(amountCents || 0), currency, purchaseStatus, JSON.stringify(payload), nowIso());
    if (valid) {
      const rewards = pricing.currencyPacks?.find((p) => p.id === sku) || (pricing.starterPack?.id === sku ? pricing.starterPack : null);
      if (rewards?.gems || rewards?.contents?.gems) {
        const gems = Number(rewards.gems || rewards.contents?.gems || 0);
        db.prepare("UPDATE users SET hard_currency = hard_currency + ?, updated_at = ? WHERE id = ?").run(gems, nowIso(), user.id);
      }
      if (rewards?.contents?.streetCrates || rewards?.contents?.premiumCrates || rewards?.contents?.xpBoosters) {
        const inv = rewards.contents;
        const upsertInv = db.prepare(
          `INSERT INTO inventories (user_id, item_type, item_id, qty, equipped, metadata)
           VALUES (?, 'consumable', ?, ?, 0, NULL)
           ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET qty = qty + excluded.qty`
        );
        if (inv.streetCrates) upsertInv.run(user.id, "street-crate", Number(inv.streetCrates));
        if (inv.premiumCrates) upsertInv.run(user.id, "premium-crate", Number(inv.premiumCrates));
        if (inv.xpBoosters) upsertInv.run(user.id, "xp-booster", Number(inv.xpBoosters));
      }
    }
    res.json({ ok: true, verified: valid });
  });

  app.get("/api/tournaments/weekly", (_req, res) => {
    const rows = db.prepare(
      `SELECT tournament_key, title, premium_only, entry_fee, starts_at, ends_at
       FROM tournaments
       ORDER BY starts_at DESC
       LIMIT 10`
    ).all();
    res.json({ rows });
  });

  app.post("/api/tournament/join", (req, res) => {
    const { userId, tournamentId, paidEntry = false } = req.body || {};
    if (!userId || !tournamentId) return res.status(400).json({ error: "userId and tournamentId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const tournament = db.prepare("SELECT id FROM tournaments WHERE tournament_key = ?").get(String(tournamentId));
    if (!tournament) return res.status(404).json({ error: "tournament not found" });
    db.prepare(
      `INSERT INTO tournament_entries (id, tournament_id, user_id, score, joined_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(tournament_id, user_id) DO NOTHING`
    ).run(randomUUID(), tournament.id, user.id, nowIso());
    logEvent({ db, userId: user.id, eventName: "tournament.join", properties: { tournamentId, paidEntry }, sessionId: randomUUID() });
    res.json({ ok: true });
  });

  app.post("/api/analytics/track", (req, res) => {
    const { userId, eventType, payload = {}, sessionId = randomUUID() } = req.body || {};
    if (!eventType) return res.status(400).json({ error: "eventType required" });
    const user = userId ? db.prepare("SELECT id FROM users WHERE tg_user_id = ?").get(String(userId)) : null;
    logEvent({
      db,
      userId: user ? user.id : null,
      eventName: String(eventType),
      properties: payload,
      sessionId,
    });
    res.json({ ok: true });
  });

  app.get("/api/analytics/retention", (_req, res) => {
    res.json(summarizeRetention(db));
  });

  app.post("/api/ab/assign", (req, res) => {
    const { userId, testName = "ui-layout" } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const variant = assignVariant(String(userId), String(testName));
    res.json({ variant, testName });
  });

  return app;
}

module.exports = { createApp };
