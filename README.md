# Neon Drift: Ascension

Neon Drift is a static HTML5 arcade game designed for upload to browser game hubs.
This version includes a full cosmetic economy with rarity tiers, loot crates, duplicate salvage,
and optional PayPal gem packs.

## Core Loop

- Fast dodge gameplay with scaling difficulty.
- Multi-life runs with armor/block and revive options.
- Mission board with claimable rewards.
- Persistent progression:
  - Credits
  - Gems
  - XP / rank
  - Upgrades (engine, armor, magnet)
  - Cosmetic inventory
- Ability buttons and keybinds:
  - `Boost` (`E`)
  - `Shield` (`Q`)
  - `Magnet`

## Cosmetic Economy (CS-style inspiration)

The game now includes a full skin economy with six rarities:

- **Common** (green)
- **Rare** (blue)
- **Epic** (purple)
- **Legendary** (gold)
- **Mythic** (teal)
- **Godly** (black, extremely rare)

### Loot crate types

- **Street Crate** (earnable + buyable with credits)
- **Premium Crate** (earnable + buyable with gems)

### Drop weighting

Street Crates are tuned to keep top-tier drops scarce:
- Common: 65.00%
- Rare: 22.00%
- Epic: 9.00%
- Legendary: 3.20%
- Mythic: 0.75%
- Godly: **0.05%**

Premium Crates have better odds but still keep Godly rare:
- Common: 45.00%
- Rare: 28.00%
- Epic: 16.00%
- Legendary: 8.00%
- Mythic: 2.70%
- Godly: **0.30%**

### Duplicate handling

Duplicate skin drops are automatically salvaged into credits based on rarity.
Higher rarity duplicates return significantly higher credit value.

### Acquisition paths

- Earn crates from gameplay/rank progression.
- Buy crates using in-game currencies.
- Buy skins directly by rarity using credits.
- Equip any owned skin from the Skin Vault.

## Controls

- Keyboard:
  - Move: `A` / `D` or `←` / `→`
  - Pause/Resume: `Space`
  - Abilities: `E`, `Q`
- Touch:
  - Drag left/right on the canvas

## Project Files

- `index.html` - game layout and UI
- `style.css` - visuals and responsive layout
- `game.js` - gameplay, progression, cosmetics, crates, and PayPal logic

## Run Locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Prompt-Only Publishing Automation (GitHub Actions -> itch.io)

You can configure one-time credentials so future deploys happen from prompts.

### 1) One-time repo setup (GitHub UI)

Add this secret:

- `ITCH_API_KEY` = your itch.io API key (from https://itch.io/user/settings/api-keys)

Add these repository variables:

- `ITCH_IO_USER` = your itch username (example: `yourname`)
- `ITCH_IO_GAME` = your game slug (example: `neon-drift-ascension`)
- `ITCH_IO_CHANNEL` = target channel (example: `html5`)

Final target format used by automation:

`ITCH_IO_USER/ITCH_IO_GAME:ITCH_IO_CHANNEL`

Example:

`yourname/neon-drift-ascension:html5`

### 2) How deploy works

Workflow file: `.github/workflows/deploy-itch.yml`

- packages: `index.html`, `style.css`, `game.js`, `README.md` into `neon-drift.zip`
- deploys with butler to your itch target
- runs automatically on pushes to `main`
- can be manually triggered from Actions tab (`workflow_dispatch`)

### 3) Deploy from prompts

After you add secret/variables once, you can simply prompt:

- "release latest to itch"
- "publish this update"
- "ship v1.1"

and I can handle the code/update side while the workflow publishes.

## PayPal Setup (Payments to Your Account)

The game uses the PayPal JavaScript SDK for checkout.

1. Go to PayPal Developer Dashboard:
   - https://developer.paypal.com/
2. Create an app under your PayPal business account.
3. Copy your **Client ID** (Sandbox for testing, Live for production).
4. In `game.js`, update:

```js
const PAYPAL_CONFIG = {
  clientId: "YOUR_REAL_CLIENT_ID",
  currency: "USD",
  ...
};
```

5. Re-upload your files to your game host.

When players purchase packs, funds settle to the PayPal account connected to that client ID.

### Important payment/security note

This demo is static-only. It grants gems client-side after `onApprove`.
For production anti-fraud, use a backend to verify orders via PayPal API before granting currency.

## Build Upload Package

From project root:

```bash
zip -r neon-drift.zip index.html style.css game.js
```

## Upload to itch.io

1. Create a new project.
2. Select **HTML** as project type.
3. Upload `neon-drift.zip`.
4. Enable browser play.
5. Publish.

Recommended viewport:
- Width: `960`
- Height: `640`

## Upload to Newgrounds

1. Start a new HTML5 game submission.
2. Upload `neon-drift.zip` (with `index.html` at archive root).
3. Set game dimensions near `960x640`.
4. Publish.

## Notes

- Static hosting only (no backend required for demo).
- Progress is stored in browser localStorage.
- Keep `index.html` at zip root for platform auto-detection.
