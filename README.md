# Neon Drift

Neon Drift is a lightweight browser arcade game built for static hosting.  
You can upload it directly to popular internet game hubs.

## Gameplay

- Dodge falling meteors.
- Collect green orbs for bonus points.
- Controls:
  - Keyboard: `A` / `D` or `←` / `→`
  - Touch: drag left/right on the game canvas
  - Pause/Resume: `Space` or Pause button

## Project Files

- `index.html` - game page and UI
- `style.css` - styling and responsive layout
- `game.js` - gameplay logic and rendering loop

## Run Locally

Any static server works. Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Build Upload Package

From the project root:

```bash
zip -r neon-drift.zip index.html style.css game.js
```

## Upload to itch.io (HTML game)

1. Go to **Create new project**.
2. Choose **Kind of project -> HTML**.
3. Upload `neon-drift.zip`.
4. Enable **This file will be played in the browser**.
5. Save and publish.

Recommended itch.io embed options:
- Viewport width: `960`
- Viewport height: `640`
- Fullscreen button: enabled

## Upload to Newgrounds

1. Create a new game submission.
2. Choose HTML5/Web upload.
3. Upload the same zip (`neon-drift.zip`) with `index.html` in the root.
4. Set dimensions near `960 x 640` (or platform defaults).
5. Publish your submission page.

## Notes for Game Hubs

- No backend is required.
- High score uses browser local storage (per player browser/device).
- Keep `index.html` at the archive root so platforms detect entry automatically.
