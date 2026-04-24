const fs = require("node:fs");
const path = require("node:path");

function readJson(relativePath) {
  const file = path.join(__dirname, "..", "..", "config", relativePath);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const cosmetics = readJson("cosmetics.json");
const missions = readJson("missions.json");
const events = readJson("events.json");
const pricing = readJson("pricing.json");
const xpCurve = readJson("xp-curve.json");

module.exports = {
  CONFIG: {
    port: Number(process.env.PORT || 8787),
    corsOrigin: process.env.CORS_ORIGIN || "*",
    telegramValidationEnabled: process.env.TELEGRAM_VALIDATION_ENABLED === "true",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    purchaseWebhookSecret: process.env.PURCHASE_WEBHOOK_SECRET || "",
    challengeBaseUrl: process.env.CHALLENGE_BASE_URL || "https://t.me/share/url",
  },
  cosmetics,
  missions,
  events,
  pricing,
  xpCurve,
};
