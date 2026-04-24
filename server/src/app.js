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

const SKIN_RARITY_BY_ID = {
  "pulse-runner": "common",
  "garden-shift": "common",
  "deep-sonar": "rare",
  "blue-lattice": "rare",
  "violet-vortex": "epic",
  "purple-static": "epic",
  "golden-shard": "legendary",
  "crown-arc": "legendary",
  "tidal-phantom": "mythic",
  "neon-empress": "mythic",
  "void-emperor": "godly",
  "black-halo": "godly",
};

const RARITY_BASE_VALUE = {
  common: 120,
  rare: 700,
  epic: 4200,
  legendary: 26000,
  mythic: 180000,
  godly: 1500000,
};

function wearTierFromFloat(floatValue) {
  if (floatValue <= 0.07) return "Factory New";
  if (floatValue <= 0.15) return "Minimal Wear";
  if (floatValue <= 0.38) return "Field-Tested";
  if (floatValue <= 0.45) return "Well-Worn";
  return "Battle-Scarred";
}

function normalizeRarity(rarity, skinId) {
  if (rarity && RARITY_BASE_VALUE[rarity]) return rarity;
  return SKIN_RARITY_BY_ID[skinId] || "common";
}

function rarityValueWithWear(rarity, floatValue) {
  const base = RARITY_BASE_VALUE[rarity] || RARITY_BASE_VALUE.common;
  const wearBonus = 1.35 - floatValue * 0.45;
  return Math.max(10, Math.round(base * wearBonus));
}

function recountSkinQty(db, userId, skinId) {
  const row = db
    .prepare("SELECT COUNT(*) AS qty FROM skin_instances WHERE user_id = ? AND skin_id = ?")
    .get(userId, skinId);
  const qty = Number(row?.qty || 0);
  if (qty <= 0) {
    db.prepare("DELETE FROM inventories WHERE user_id = ? AND item_type = 'skin' AND item_id = ?").run(userId, skinId);
    return;
  }
  db.prepare(
    `INSERT INTO inventories (user_id, item_type, item_id, qty, equipped, metadata)
     VALUES (?, 'skin', ?, ?, 0, NULL)
     ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET qty = excluded.qty`
  ).run(userId, skinId, qty);
}

function mintSkinInstance(db, { userId, skinId, rarity, source }) {
  const normalizedRarity = normalizeRarity(rarity, skinId);
  const floatValue = Number(Math.random().toFixed(5));
  const wearTier = wearTierFromFloat(floatValue);
  const baseValue = rarityValueWithWear(normalizedRarity, floatValue);
  const instanceId = randomUUID();
  db.prepare(
    `INSERT INTO skin_instances
      (id, user_id, skin_id, rarity, float_value, wear_tier, base_value, tradable, locked, lock_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)`
  ).run(instanceId, userId, skinId, normalizedRarity, floatValue, wearTier, baseValue, nowIso());
  recountSkinQty(db, userId, skinId);
  const instance = db.prepare("SELECT * FROM skin_instances WHERE id = ?").get(instanceId);
  logEvent({
    db,
    userId,
    eventName: "cosmetic.instance.minted",
    properties: { instanceId, skinId, rarity: normalizedRarity, wearTier, baseValue, source: source || "unknown" },
    sessionId: randomUUID(),
  });
  return instance;
}

function ensureStarterSkin(db, userId) {
  const row = db.prepare("SELECT COUNT(*) AS qty FROM skin_instances WHERE user_id = ?").get(userId);
  if (Number(row?.qty || 0) > 0) return;
  mintSkinInstance(db, { userId, skinId: "pulse-runner", rarity: "common", source: "starter" });
}

function getTradableSkinForUser(db, userId, instanceId) {
  return db.prepare(
    `SELECT *
     FROM skin_instances
     WHERE id = ? AND user_id = ? AND tradable = 1 AND locked = 0`
  ).get(String(instanceId), userId);
}

const SKIN_POOL = [
  { skinId: "pulse-runner", rarity: "common" },
  { skinId: "garden-shift", rarity: "common" },
  { skinId: "deep-sonar", rarity: "rare" },
  { skinId: "blue-lattice", rarity: "rare" },
  { skinId: "violet-vortex", rarity: "epic" },
  { skinId: "purple-static", rarity: "epic" },
  { skinId: "golden-shard", rarity: "legendary" },
  { skinId: "crown-arc", rarity: "legendary" },
  { skinId: "tidal-phantom", rarity: "mythic" },
  { skinId: "neon-empress", rarity: "mythic" },
  { skinId: "void-emperor", rarity: "godly" },
  { skinId: "black-halo", rarity: "godly" },
];

function rarityBaseValue(rarity) {
  const table = {
    common: 120,
    rare: 450,
    epic: 1600,
    legendary: 7800,
    mythic: 28000,
    godly: 160000,
  };
  return table[String(rarity)] || 100;
}

function wearTier(floatValue) {
  if (floatValue < 0.07) return "Factory New";
  if (floatValue < 0.15) return "Minimal Wear";
  if (floatValue < 0.38) return "Field-Tested";
  if (floatValue < 0.45) return "Well-Worn";
  return "Battle-Scarred";
}

function createSkinInstance(db, userId, skinId, rarity, source = "seed") {
  const floatValue = Number(Math.random().toFixed(5));
  const id = randomUUID();
  db.prepare(
    `INSERT INTO skin_instances
     (id, user_id, skin_id, rarity, float_value, wear_tier, base_value, tradable, locked, lock_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)`
  ).run(id, userId, skinId, rarity, floatValue, wearTier(floatValue), rarityBaseValue(rarity), nowIso());
  return db.prepare("SELECT * FROM skin_instances WHERE id = ?").get(id);
}

function ensureSeedInventory(db, user) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM skin_instances WHERE user_id = ?").get(user.id);
  if ((existing?.c || 0) > 0) return;
  const starter = SKIN_POOL.filter((s) => s.rarity === "common").slice(0, 2);
  const bonus = SKIN_POOL.find((s) => s.rarity === "rare");
  for (const skin of starter) {
    createSkinInstance(db, user.id, skin.skinId, skin.rarity, "starter");
  }
  if (bonus) createSkinInstance(db, user.id, bonus.skinId, bonus.rarity, "starter");
}

function rarityMultiplier(rarity) {
  const table = {
    common: 1,
    rare: 2.5,
    epic: 7,
    legendary: 24,
    mythic: 90,
    godly: 700,
  };
  return table[rarity] || 1;
}

function estimatedSkinValue(metadataRaw) {
  let metadata = {};
  try {
    metadata = JSON.parse(metadataRaw || "{}");
  } catch {
    metadata = {};
  }
  const rarity = String(metadata.rarity || "common");
  const wear = Number(metadata.wear || 0.4);
  const serial = Number(metadata.serial || 99999);
  const base = 140;
  const wearBonus = Math.max(0.55, 1.35 - wear);
  const serialBonus = serial <= 25 ? 4 : serial <= 100 ? 2 : 1;
  return Math.floor(base * rarityMultiplier(rarity) * wearBonus * serialBonus);
}

function toPublicSkinRow(row) {
  if (!row) return null;
  const rarity = String(row.rarity || "common");
  const floatValue = Number(row.float_value || 0);
  return {
    id: row.id,
    skinId: row.skin_id,
    skin_id: row.skin_id,
    rarity,
    floatValue,
    float_value: floatValue,
    wearTier: row.wear_tier || wearTier(floatValue),
    wear_tier: row.wear_tier || wearTier(floatValue),
    baseValue: Number(row.base_value || 0),
    base_value: Number(row.base_value || 0),
    estimatedCredits: Math.max(50, Math.floor((row.base_value || rarityBaseValue(rarity)) * (1.12 - floatValue * 0.25))),
    estimatedUsd: Number(((row.base_value || rarityBaseValue(rarity)) / 220).toFixed(2)),
    tradable: Number(row.tradable || 0) === 1,
    locked: Number(row.locked || 0) === 1,
  };
}

function getSkinInstance(db, instanceId) {
  return db.prepare("SELECT * FROM skin_instances WHERE id = ?").get(String(instanceId));
}

function assertTradableOwnedSkin(db, { userId, instanceId }) {
  return db.prepare(
    `SELECT *
     FROM skin_instances
     WHERE id = ? AND user_id = ? AND tradable = 1 AND locked = 0`
  ).get(String(instanceId), userId);
}

function transferSkin(db, { instanceId, toUserId }) {
  db.prepare("UPDATE skin_instances SET user_id = ?, locked = 0, lock_reason = NULL WHERE id = ?").run(toUserId, String(instanceId));
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
    ensureSeedInventory(db, user);
    const variant = assignVariant(String(userId), "ui-layout");
    const dayKey = new Date().toISOString().slice(0, 10);
    const existingRotation = db.prepare("SELECT payload FROM shop_rotations WHERE user_id = ? AND day_key = ?").get(user.id, dayKey);
    if (!existingRotation) {
      const rotation = nextRotatingShop(Number(user.id));
      db.prepare(
        "INSERT INTO shop_rotations (user_id, day_key, payload, created_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, dayKey, JSON.stringify(rotation), nowIso());
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

  app.post("/api/cosmetics/grant", (req, res) => {
    const { userId, skinId = "pulse-runner", rarity = null, source = "manual-grant" } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const normalizedRarity = normalizeRarity(rarity, skinId);
    const instance = mintSkinInstance(db, { userId: user.id, skinId, rarity: normalizedRarity, source });
    res.json({ ok: true, instance: toPublicSkinRow(instance) });
  });

  app.post("/api/skins/grant", (req, res, next) => {
    req.url = "/api/cosmetics/grant";
    return app._router.handle(req, res, next);
  });

  app.get("/api/skins/inventory/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    ensureSeedInventory(db, user);
    const rows = db.prepare(
      `SELECT *
       FROM skin_instances
       WHERE user_id = ?
       ORDER BY base_value DESC, float_value ASC, created_at DESC
       LIMIT 250`
    ).all(user.id);
    const mapped = rows.map(toPublicSkinRow);
    res.json({ rows: mapped, items: mapped });
  });

  app.post("/api/trade/create", (req, res) => {
    const { fromUserId, toUserId, offeredSkinInstanceId, requestedSkinInstanceId } = req.body || {};
    if (!fromUserId || !toUserId || !offeredSkinInstanceId || !requestedSkinInstanceId) {
      return res.status(400).json({ error: "fromUserId, toUserId, offeredSkinInstanceId, requestedSkinInstanceId required" });
    }
    const fromUser = getUserByPublicId(db, fromUserId);
    const toUser = getUserByPublicId(db, toUserId);
    if (!fromUser || !toUser) return res.status(404).json({ error: "user not found" });
    const offered = assertTradableOwnedSkin(db, { userId: fromUser.id, instanceId: offeredSkinInstanceId });
    if (!offered) return res.status(400).json({ error: "offered skin unavailable" });
    const requested = assertTradableOwnedSkin(db, { userId: toUser.id, instanceId: requestedSkinInstanceId });
    if (!requested) return res.status(400).json({ error: "requested skin unavailable" });

    const offerId = randomUUID();
    const now = nowIso();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO trade_offers
         (id, from_user_id, to_user_id, offered_skin_instance_id, requested_skin_instance_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).run(offerId, fromUser.id, toUser.id, offered.id, requested.id, now, now);
      db.prepare("UPDATE skin_instances SET locked = 1, lock_reason = ? WHERE id = ?").run(`trade:${offerId}`, offered.id);
      db.prepare("UPDATE skin_instances SET locked = 1, lock_reason = ? WHERE id = ?").run(`trade:${offerId}`, requested.id);
    })();

    const offer = db.prepare("SELECT * FROM trade_offers WHERE id = ?").get(offerId);
    res.json({ ok: true, offer });
  });

  app.post("/api/market/offer", (req, res) => {
    req.url = "/api/trade/create";
    app.handle(req, res);
  });

  app.post("/api/trade/accept", (req, res) => {
    const { offerId, userId } = req.body || {};
    if (!offerId || !userId) return res.status(400).json({ error: "offerId and userId required" });
    const accepter = getUserByPublicId(db, userId);
    if (!accepter) return res.status(404).json({ error: "user not found" });

    const offer = db.prepare("SELECT * FROM trade_offers WHERE id = ?").get(String(offerId));
    if (!offer || offer.status !== "pending") return res.status(404).json({ error: "offer not pending" });
    if (Number(offer.to_user_id) !== Number(accepter.id)) return res.status(403).json({ error: "not offer target" });

    const offered = getSkinInstance(db, offer.offered_skin_instance_id);
    const requested = getSkinInstance(db, offer.requested_skin_instance_id);
    if (!offered || !requested) return res.status(400).json({ error: "skin instances missing" });
    if (Number(offered.user_id) !== Number(offer.from_user_id) || Number(requested.user_id) !== Number(offer.to_user_id)) {
      return res.status(400).json({ error: "ownership mismatch" });
    }

    db.transaction(() => {
      transferSkin(db, { instanceId: offered.id, toUserId: offer.to_user_id });
      transferSkin(db, { instanceId: requested.id, toUserId: offer.from_user_id });
      db.prepare("UPDATE trade_offers SET status = 'accepted', updated_at = ?, resolved_at = ? WHERE id = ?").run(nowIso(), nowIso(), offer.id);
      recountSkinQty(db, offer.from_user_id, offered.skin_id);
      recountSkinQty(db, offer.to_user_id, offered.skin_id);
      recountSkinQty(db, offer.from_user_id, requested.skin_id);
      recountSkinQty(db, offer.to_user_id, requested.skin_id);
    })();

    res.json({ ok: true, offerId: offer.id });
  });

  app.post("/api/market/offer/accept", (req, res) => {
    req.url = "/api/trade/accept";
    app.handle(req, res);
  });

  app.get("/api/trade/incoming/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const rows = db.prepare(
      `SELECT o.*,
              sf.skin_id AS offered_skin_id,
              sf.rarity AS offered_rarity,
              st.skin_id AS requested_skin_id,
              st.rarity AS requested_rarity
       FROM trade_offers o
       JOIN skin_instances sf ON sf.id = o.offered_skin_instance_id
       JOIN skin_instances st ON st.id = o.requested_skin_instance_id
       WHERE o.to_user_id = ? AND o.status = 'pending'
       ORDER BY o.updated_at DESC
       LIMIT 100`
    ).all(user.id);
    res.json({ rows });
  });

  app.post("/api/duel/create", (req, res) => {
    const { challengerUserId, opponentUserId, challengerSkinInstanceId, opponentSkinInstanceId } = req.body || {};
    if (!challengerUserId || !opponentUserId || !challengerSkinInstanceId || !opponentSkinInstanceId) {
      return res.status(400).json({ error: "challengerUserId, opponentUserId, challengerSkinInstanceId, opponentSkinInstanceId required" });
    }
    const challenger = getUserByPublicId(db, challengerUserId);
    const opponent = getUserByPublicId(db, opponentUserId);
    if (!challenger || !opponent) return res.status(404).json({ error: "user not found" });

    const challengerSkin = assertTradableOwnedSkin(db, { userId: challenger.id, instanceId: challengerSkinInstanceId });
    const opponentSkin = assertTradableOwnedSkin(db, { userId: opponent.id, instanceId: opponentSkinInstanceId });
    if (!challengerSkin || !opponentSkin) return res.status(400).json({ error: "stake skin unavailable" });

    const duelId = randomUUID();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO skin_duels
         (id, challenger_user_id, opponent_user_id, challenger_skin_instance_id, opponent_skin_instance_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      ).run(duelId, challenger.id, opponent.id, challengerSkin.id, opponentSkin.id, nowIso());
      db.prepare("UPDATE skin_instances SET locked = 1, lock_reason = ? WHERE id = ?").run(`duel:${duelId}`, challengerSkin.id);
      db.prepare("UPDATE skin_instances SET locked = 1, lock_reason = ? WHERE id = ?").run(`duel:${duelId}`, opponentSkin.id);
    })();

    const duel = db.prepare("SELECT * FROM skin_duels WHERE id = ?").get(duelId);
    res.json({ ok: true, duel });
  });

  app.get("/api/duel/open/:userId", (req, res) => {
    const user = getUserByPublicId(db, req.params.userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    const rows = db.prepare(
      `SELECT d.*
       FROM skin_duels d
       WHERE (d.challenger_user_id = ? OR d.opponent_user_id = ?)
       ORDER BY d.created_at DESC
       LIMIT 100`
    ).all(user.id, user.id);
    res.json({ rows });
  });

  app.post("/api/duel/resolve", (req, res) => {
    const { duelId } = req.body || {};
    if (!duelId) return res.status(400).json({ error: "duelId required" });
    const duel = db.prepare("SELECT * FROM skin_duels WHERE id = ?").get(String(duelId));
    if (!duel || duel.status !== "pending") return res.status(404).json({ error: "duel not pending" });
    const challengerSkin = getSkinInstance(db, duel.challenger_skin_instance_id);
    const opponentSkin = getSkinInstance(db, duel.opponent_skin_instance_id);
    if (!challengerSkin || !opponentSkin) return res.status(400).json({ error: "stake skins missing" });

    const challengerRoll = Number((Math.random() + (challengerSkin.base_value || 1) / Math.max(1, (challengerSkin.base_value || 1) + (opponentSkin.base_value || 1)) * 0.12).toFixed(6));
    const opponentRoll = Number((Math.random() + (opponentSkin.base_value || 1) / Math.max(1, (challengerSkin.base_value || 1) + (opponentSkin.base_value || 1)) * 0.12).toFixed(6));
    const winnerUserId = challengerRoll >= opponentRoll ? duel.challenger_user_id : duel.opponent_user_id;
    const loserSkin = winnerUserId === duel.challenger_user_id ? opponentSkin : challengerSkin;

    db.transaction(() => {
      transferSkin(db, { instanceId: challengerSkin.id, toUserId: winnerUserId });
      transferSkin(db, { instanceId: opponentSkin.id, toUserId: winnerUserId });
      db.prepare(
        `UPDATE skin_duels
         SET status = 'resolved',
             winner_user_id = ?,
             challenger_roll = ?,
             opponent_roll = ?,
             resolved_at = ?
         WHERE id = ?`
      ).run(winnerUserId, challengerRoll, opponentRoll, nowIso(), duel.id);
      recountSkinQty(db, duel.challenger_user_id, challengerSkin.skin_id);
      recountSkinQty(db, duel.opponent_user_id, challengerSkin.skin_id);
      recountSkinQty(db, duel.challenger_user_id, opponentSkin.skin_id);
      recountSkinQty(db, duel.opponent_user_id, opponentSkin.skin_id);
    })();

    const winnerUser = db.prepare("SELECT tg_user_id FROM users WHERE id = ?").get(winnerUserId);
    res.json({
      ok: true,
      duelId: duel.id,
      winnerUserId: winnerUser ? winnerUser.tg_user_id : null,
      challengerRoll,
      opponentRoll,
      winnerTakes: toPublicSkinRow(loserSkin),
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
      `INSERT INTO friendships (user_id, friend_user_id, status, created_at, updated_at)
       VALUES (?, ?, 'accepted', ?, ?)
       ON CONFLICT(user_id, friend_user_id)
       DO UPDATE SET status = 'accepted', updated_at = excluded.updated_at`
    ).run(user.id, friend.id, nowIso(), nowIso());
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
        "INSERT INTO shop_rotations (user_id, day_key, payload, created_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, dayKey, JSON.stringify(rotation), nowIso());
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
      "INSERT INTO starter_funnel (user_id, accepted, created_at) VALUES (?, ?, ?)"
    ).run(user.id, accepted ? 1 : 0, nowIso());
    res.json({ ok: true });
  });

  app.post("/api/purchase/log", (req, res) => {
    const { userId, provider, providerTxnId, sku, amountCents, currency = "USD", status = "pending", payload = {} } = req.body || {};
    if (!userId || !provider || !sku) return res.status(400).json({ error: "userId, provider, sku required" });
    const user = getUserByPublicId(db, userId);
    if (!user) return res.status(404).json({ error: "user not found" });
    db.prepare(
      `INSERT INTO purchases (user_id, provider, provider_txn_id, sku, amount_cents, currency, status, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(user.id, provider, providerTxnId || null, sku, Number(amountCents || 0), currency, status, JSON.stringify(payload), nowIso());
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
      `INSERT INTO purchases (user_id, provider, provider_txn_id, sku, amount_cents, currency, status, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(user.id, provider, providerTxnId, sku, Number(amountCents || 0), currency, purchaseStatus, JSON.stringify(payload), nowIso());
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
      `INSERT INTO tournament_entries (tournament_id, user_id, score, joined_at)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(tournament_id, user_id) DO NOTHING`
    ).run(tournament.id, user.id, nowIso());
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
