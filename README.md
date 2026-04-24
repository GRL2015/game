# Neon Drift: Ascension

Neon Drift is a static HTML5 arcade game designed for upload to browser game hubs.
This version includes a deeper progression loop and optional PayPal gem pack support.

## Core Loop

- Fast dodge gameplay with scaling difficulty.
- Multi-life runs with armor/block and revive options.
- Mission board with claimable rewards.
- Persistent progression:
  - Credits
  - Gems
  - XP / rank
  - Upgrades (engine, armor, magnet)
  - Cosmetic unlocks
- Ability buttons and keybinds:
  - `Boost` (`E`)
  - `Shield` (`Q`)
  - `Magnet`

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
- `game.js` - gameplay, progression, mission, and PayPal logic

## Run Locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

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

## Ethical Monetization Notes

- Paid items are optional and not required to play.
- Core progression remains available through gameplay rewards.
- No loot-box randomness in paid purchases.

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
