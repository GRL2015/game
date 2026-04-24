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
