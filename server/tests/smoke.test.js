const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");

test("health endpoint returns ok", async () => {
  const app = createApp();
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("auth session upserts user and returns variant", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/session").send({
    userId: "test-user-smoke",
    username: "smoke_user",
    fingerprint: "device-fingerprint-smoke-123",
  });
  assert.equal(res.status, 200);
  assert.equal(Boolean(res.body.user), true);
  assert.equal(typeof res.body.variant, "string");
});

test("shop rotation endpoint responds with offers", async () => {
  const app = createApp();
  await request(app).post("/api/auth/session").send({
    userId: "test-user-shop",
    username: "shop_user",
    fingerprint: "device-fingerprint-shop-123",
  });
  const res = await request(app).get("/api/shop/rotation/test-user-shop");
  assert.equal(res.status, 200);
  assert.equal(Array.isArray(res.body.items), true);
});

test("purchase verify accepts valid signature", async () => {
  const app = createApp();
  await request(app).post("/api/auth/session").send({
    userId: "pay-user-smoke",
    username: "pay_user",
    fingerprint: "device-fingerprint-pay-123",
  });
  const payload = {
    userId: "pay-user-smoke",
    provider: "paypal",
    providerTxnId: "txn-1",
    sku: "pack-small",
    amountCents: 299,
    currency: "USD",
  };
  const crypto = require("node:crypto");
  const signing = `${payload.provider}|${payload.providerTxnId}|${payload.sku}|${payload.amountCents}|${payload.currency}`;
  const secret = process.env.PURCHASE_WEBHOOK_SECRET || "";
  const signature = crypto.createHmac("sha256", secret).update(signing).digest("hex");
  const res = await request(app).post("/api/purchase/verify").send({ ...payload, signature });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.verified, "boolean");
});

test("skin trade and duel settlement works", async () => {
  const app = createApp();
  await request(app).post("/api/auth/session").send({
    userId: "trade-user-a",
    username: "trade_a",
    fingerprint: "fingerprint-trade-a",
  });
  await request(app).post("/api/auth/session").send({
    userId: "trade-user-b",
    username: "trade_b",
    fingerprint: "fingerprint-trade-b",
  });

  const grantA = await request(app).post("/api/skins/grant").send({
    userId: "trade-user-a",
    skinId: "void-emperor",
    rarity: "godly",
    source: "test",
  });
  const grantB = await request(app).post("/api/skins/grant").send({
    userId: "trade-user-b",
    skinId: "golden-shard",
    rarity: "legendary",
    source: "test",
  });
  assert.equal(grantA.status, 200);
  assert.equal(grantB.status, 200);

  const offer = await request(app).post("/api/trade/create").send({
    fromUserId: "trade-user-a",
    toUserId: "trade-user-b",
    offeredSkinInstanceId: grantA.body.instance.id,
    requestedSkinInstanceId: grantB.body.instance.id,
  });
  assert.equal(offer.status, 200);

  const accept = await request(app).post("/api/trade/accept").send({
    offerId: offer.body.offer.id,
    userId: "trade-user-b",
  });
  assert.equal(accept.status, 200);
  assert.equal(accept.body.ok, true);

  const invA = await request(app).get("/api/skins/inventory/trade-user-a");
  const invB = await request(app).get("/api/skins/inventory/trade-user-b");
  assert.equal(invA.status, 200);
  assert.equal(invB.status, 200);
  const aTradeSkin = invA.body.items.find((item) => item.skin_id === "golden-shard");
  const bTradeSkin = invB.body.items.find((item) => item.skin_id === "void-emperor");
  assert.equal(Boolean(aTradeSkin), true);
  assert.equal(Boolean(bTradeSkin), true);

  const duel = await request(app).post("/api/duel/create").send({
    challengerUserId: "trade-user-b",
    opponentUserId: "trade-user-a",
    challengerSkinInstanceId: bTradeSkin.id,
    opponentSkinInstanceId: aTradeSkin.id,
  });
  assert.equal(duel.status, 200);

  const resolve = await request(app).post("/api/duel/resolve").send({
    duelId: duel.body.duel.id,
  });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.ok, true);
  assert.equal(typeof resolve.body.winnerUserId, "string");
});
