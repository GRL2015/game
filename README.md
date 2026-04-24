# Neon Drift: Ascension Platform

Neon Drift is now structured as a production-style game platform with:
- a rich Telegram-friendly web frontend,
- a Node.js + Express backend API,
- SQLite persistence (easy local start, upgrade path to Postgres),
- config-driven economy/event/mission tuning,
- itch.io deployment automation.

This foundation covers almost all requested systems. A few parts (real ad network SDKs, live subscription billing, hardened anti-cheat, production tournaments) are scaffolded and require external account/service setup to fully activate.

## 1) Feature Coverage

### Core game loop
- 20-second rounds
- instant results + rematch
- clear win/loss feedback
- short-session arcade flow with progression rewards

### Retention loop
- daily login rewards + streak tracking
- visible XP and rank progression
- rotating missions and reward popups
- progression tracks and unlockables

### Monetization layer
- cosmetic economy with rarity tiers
- street/premium loot crates
- direct rarity purchases with soft currency
- gem packs (PayPal integration in frontend)
- premium hooks in profile/state for subscription perks

### Cosmetics + economy
- 6 rarity tiers:
  - Common (green)
  - Rare (blue)
  - Epic (purple)
  - Legendary (gold)
  - Mythic (teal)
  - Godly (black)
- godly tuned to be extremely rare
- duplicate salvage returns rarity-scaled currency
- inventory + equip + vault value display

### Social + viral hooks
- Telegram share helper hooks
- score/rival challenge text generation
- friend/rival placeholders in profile state
- leaderboard views with weekly reset concepts

### Missions/events/tournaments
- rotating missions + premium mission slot model
- event config system (weekly/seasonal)
- event pass structure (free + premium track)
- tournament endpoints + optional paid-entry hooks

### Anti-cheat + integrity
- server score validation logic
- input sanity checks + suspicious pattern flags
- lightweight rate limiting
- device fingerprint field support
- leaderboard integrity controls scaffold

### Analytics + A/B
- analytics ingest endpoint
- basic funnel event logging table
- user experiment/variant assignment endpoint

---

## 2) Repository Structure

```text
.
├── index.html
├── style.css
├── game.js
├── config/
│   ├── cosmetics.json
│   ├── missions.json
│   ├── events.json
│   ├── pricing.json
│   └── xp-curve.json
├── server/
│   ├── package.json
│   ├── sql/
│   │   └── schema.sql
│   ├── src/
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── db.js
│   │   ├── index.js
│   │   ├── security.js
│   │   └── telemetry.js
│   └── tests/
│       └── smoke.test.js
├── scripts/
│   ├── dev.sh
│   ├── build.sh
│   └── test.sh
└── .github/workflows/
    └── deploy-itch.yml
```

---

## 3) Local Development

### Prerequisites
- Node.js 20+
- npm

### Install dependencies

```bash
cd server && npm install
```

### Start backend

```bash
npm run dev
```

Backend default: `http://localhost:8787`

### Start frontend (simple static server)

```bash
python3 -m http.server 8080
```

Frontend default: `http://localhost:8080`

---

## 4) Scripts

From repo root:

```bash
npm run dev
npm run test
npm run build
```

- `dev` starts backend (`server/`)
- `test` runs backend smoke tests + frontend syntax check
- `build` packages frontend assets into zip

---

## 5) Backend API Overview

Base URL: `/api`

Representative endpoints:
- `GET /health`
- `POST /auth/telegram`
- `POST /score/submit`
- `GET /leaderboard/global`
- `POST /analytics/track`

These provide a foundation for profile, inventory, missions, events, tournaments, purchases, and analytics.

---

## 6) Config-Driven Balancing

Tune systems without changing code:
- `config/cosmetics.json` -> skin pool, rarity, salvage
- `config/missions.json` -> mission definitions and rewards
- `config/events.json` -> events, passes, themed modifiers
- `config/pricing.json` -> crate pricing, packs, offers
- `config/xp-curve.json` -> rank thresholds and XP pacing

---

## 7) PayPal Setup (Gem Packs)

In `game.js`:

```js
const PAYPAL_CONFIG = {
  clientId: "YOUR_REAL_CLIENT_ID",
  currency: "USD",
  ...
};
```

Use your PayPal Developer app client ID.

Security note:
- Frontend grants are demo-friendly.
- For production, verify completed orders server-side before granting premium currency.

---

## 8) itch.io Prompt-Only Deployment

Workflow: `.github/workflows/deploy-itch.yml`

### One-time GitHub setup

Secret:
- `ITCH_API_KEY`

Variables:
- `ITCH_IO_USER`
- `ITCH_IO_GAME`
- `ITCH_IO_CHANNEL` (optional, defaults to `html5`)

After setup, pushing to `main` deploys automatically, and manual dispatch is available in Actions.

---

## 9) What Still Requires External Services

These are intentionally scaffolded and need integration credentials/services:
- real ad network SDK wiring (rewarded/interstitial delivery)
- production subscription billing/provider sync
- hardened anti-cheat (server authoritative gameplay + replay proofs)
- large-scale tournament orchestration and prize payouts
- production observability stack (hosted logs/metrics/alerts)

---

## 10) Deployment Targets

Recommended:
- Frontend: static host (Cloudflare Pages / Netlify / Vercel static / GitHub Pages)
- Backend: Render / Railway / Fly.io
- DB: SQLite for development, Postgres for scale

HTTPS is required for Telegram WebApp production flows.
