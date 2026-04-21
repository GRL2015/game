[index.html](https://github.com/user-attachments/files/26920352/index.html)
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
  />
  <title>Tap Target Mini Game</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg: #17212b;
      --card: #232e3c;
      --text: #ffffff;
      --subtext: #aab7c4;
      --button: #2ea6ff;
      --button-text: #ffffff;
      --accent: #5ad1ff;
      --danger: #ff6b6b;
      --success: #52d273;
      --muted-btn: rgba(255,255,255,.08);
    }

    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .app {
      width: 100%;
      max-width: 480px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 14px;
    }

    .topbar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .stat {
      background: var(--card);
      border-radius: 16px;
      padding: 12px;
      text-align: center;
      box-shadow: 0 4px 18px rgba(0,0,0,.18);
    }

    .stat-label {
      font-size: 12px;
      color: var(--subtext);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.1;
    }

    .panel {
      background: var(--card);
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 4px 18px rgba(0,0,0,.18);
    }

    .title {
      font-size: 24px;
      font-weight: 900;
      margin: 0 0 6px;
    }

    .subtitle {
      margin: 0;
      color: var(--subtext);
      font-size: 14px;
      line-height: 1.45;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }

    button {
      border: 0;
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform .08s ease, opacity .2s ease;
    }

    button:active {
      transform: scale(0.98);
    }

    .primary {
      background: var(--button);
      color: var(--button-text);
      flex: 1;
      min-width: 140px;
    }

    .secondary {
      background: var(--muted-btn);
      color: var(--text);
      flex: 1;
      min-width: 120px;
    }

    .arena-wrap {
      flex: 1;
      min-height: 320px;
    }

    .arena {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 330px;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.05), transparent 30%),
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.08)),
        var(--card);
      border-radius: 22px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 4px 18px rgba(0,0,0,.18);
    }

    .target {
      position: absolute;
      border-radius: 999px;
      background:
        radial-gradient(circle at 30% 30%, #ffffff, var(--accent) 35%, #1197d8 100%);
      box-shadow:
        0 0 0 10px rgba(90,209,255,.08),
        0 14px 24px rgba(0,0,0,.28);
      display: none;
      touch-action: manipulation;
    }

    .target::after {
      content: "";
      position: absolute;
      inset: 25%;
      border-radius: 999px;
      background: rgba(255,255,255,.9);
      opacity: .28;
    }

    .center-message {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
      color: var(--subtext);
      font-weight: 700;
      pointer-events: none;
    }

    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(82,210,115,.12);
      color: var(--success);
      font-size: 12px;
      font-weight: 800;
      margin-top: 10px;
    }

    .danger {
      color: var(--danger) !important;
    }

    .support-panel {
      display: none;
    }

    .support-note {
      margin-top: 8px;
      font-size: 12px;
      color: var(--subtext);
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--subtext);
      padding-bottom: max(4px, env(safe-area-inset-bottom));
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="topbar">
      <div class="stat">
        <div class="stat-label">Score</div>
        <div class="stat-value" id="score">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">Time</div>
        <div class="stat-value" id="time">15</div>
      </div>
      <div class="stat">
        <div class="stat-label">Best</div>
        <div class="stat-value" id="best">0</div>
      </div>
    </div>

    <div class="panel">
      <h1 class="title">Tap Target</h1>
      <p class="subtitle">
        Hit as many targets as you can in 15 seconds.
        Free to play. Optional support only.
      </p>

      <div class="actions">
        <button id="startBtn" class="primary">Start Game</button>
        <button id="resetBtn" class="secondary">Reset Best</button>
      </div>

      <div class="badge" id="status">Ready to play</div>
    </div>

    <div class="panel support-panel" id="supportPanel">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:800">Support the game</h2>
      <p class="subtitle">
        Optional support helps fund updates. Sponsored links are clearly disclosed.
      </p>

      <div class="actions">
        <button id="tip1Btn" class="secondary">Tip $1</button>
        <button id="tip3Btn" class="secondary">Tip $3</button>
        <button id="sponsorBtn" class="secondary">Sponsored</button>
      </div>

      <div class="support-note">
        No pay-to-win. Payments open in an external checkout page.
      </div>
    </div>

    <div class="arena-wrap">
      <div class="arena" id="arena">
        <div class="center-message" id="message">Press <b>Start Game</b></div>
        <div class="target" id="target"></div>
      </div>
    </div>

    <div class="footer">One file only • static hosting • Telegram Mini App ready</div>
  </div>

  <script>
    // Replace these with your real links.
    const LINKS = {
      tip1: "https://your-stripe-or-kofi-link-here",
      tip3: "https://your-stripe-or-kofi-link-here",
      sponsor: "https://your-affiliate-or-sponsor-link-here"
    };

    const tg = window.Telegram?.WebApp;

    const scoreEl = document.getElementById("score");
    const timeEl = document.getElementById("time");
    const bestEl = document.getElementById("best");
    const startBtn = document.getElementById("startBtn");
    const resetBtn = document.getElementById("resetBtn");
    const target = document.getElementById("target");
    const arena = document.getElementById("arena");
    const message = document.getElementById("message");
    const statusEl = document.getElementById("status");
    const supportPanel = document.getElementById("supportPanel");
    const tip1Btn = document.getElementById("tip1Btn");
    const tip3Btn = document.getElementById("tip3Btn");
    const sponsorBtn = document.getElementById("sponsorBtn");

    let score = 0;
    let timeLeft = 15;
    let best = Number(localStorage.getItem("tap-target-best") || 0);
    let gameRunning = false;
    let timerId = null;
    let size = 84;

    if (tg) {
      tg.ready();
      tg.expand();
    }

    function applyTelegramTheme() {
      if (!tg || !tg.themeParams) return;
      const p = tg.themeParams;
      const root = document.documentElement;

      if (p.bg_color) root.style.setProperty("--bg", p.bg_color);
      if (p.secondary_bg_color) root.style.setProperty("--card", p.secondary_bg_color);
      if (p.text_color) root.style.setProperty("--text", p.text_color);
      if (p.hint_color) root.style.setProperty("--subtext", p.hint_color);
      if (p.button_color) root.style.setProperty("--button", p.button_color);
      if (p.button_text_color) root.style.setProperty("--button-text", p.button_text_color);
      if (p.link_color) root.style.setProperty("--accent", p.link_color);
    }

    function updateUI() {
      scoreEl.textContent = String(score);
      timeEl.textContent = String(timeLeft);
      bestEl.textContent = String(best);
    }

    function setStatus(text, danger = false) {
      statusEl.textContent = text;
      statusEl.classList.toggle("danger", danger);
    }

    function haptic(type = "light") {
      try {
        tg?.HapticFeedback?.impactOccurred?.(type);
      } catch {}
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function positionTarget() {
      const rect = arena.getBoundingClientRect();
      const maxX = Math.max(0, rect.width - size);
      const maxY = Math.max(0, rect.height - size);

      target.style.width = size + "px";
      target.style.height = size + "px";
      target.style.left = randomInt(0, Math.floor(maxX)) + "px";
      target.style.top = randomInt(0, Math.floor(maxY)) + "px";
    }

    function showSupport() {
      supportPanel.style.display = "block";
    }

    function hideSupport() {
      supportPanel.style.display = "none";
    }

    function startGame() {
      score = 0;
      timeLeft = 15;
      size = 84;
      gameRunning = true;

      updateUI();
      hideSupport();
      setStatus("Game started");
      startBtn.textContent = "Restart";
      message.style.display = "none";
      target.style.display = "block";
      positionTarget();

      try {
        tg?.MainButton?.hide();
      } catch {}

      clearInterval(timerId);
      timerId = setInterval(() => {
        timeLeft -= 1;
        updateUI();

        if (timeLeft <= 5 && timeLeft > 0) {
          setStatus("Hurry up: " + timeLeft + "s left", true);
        }

        if (timeLeft <= 0) {
          endGame();
        }
      }, 1000);
    }

    function endGame() {
      gameRunning = false;
      clearInterval(timerId);
      target.style.display = "none";

      if (score > best) {
        best = score;
        localStorage.setItem("tap-target-best", String(best));
      }

      updateUI();
      showSupport();

      message.style.display = "flex";
      message.innerHTML = "Game over<br><span style='font-size:14px;color:var(--subtext)'>Your score: <b>" + score + "</b></span>";

      if (score === best && score > 0) {
        setStatus("New high score. Optional support helps fund updates.");
      } else if (score >= 10) {
        setStatus("Nice run. Optional support keeps the game free.");
      } else {
        setStatus("Round finished");
      }

      try {
        if (tg?.MainButton) {
          tg.MainButton.setText("Send score: " + score);
          tg.MainButton.show();
          tg.MainButton.offClick(sendScore);
          tg.MainButton.onClick(sendScore);
        }
      } catch {}
    }

    function sendScore() {
      const payload = {
        type: "tap_target_score",
        score,
        best,
        playedAt: new Date().toISOString()
      };

      if (tg?.sendData) {
        tg.sendData(JSON.stringify(payload));
        setStatus("Score sent to bot");
      } else {
        navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => {});
        setStatus("Opened outside Telegram");
      }
    }

    function openExternal(url, label) {
      if (!url || url.includes("your-")) {
        alert("Add your real " + label + " link in the LINKS object first.");
        return;
      }

      try {
        if (tg?.openLink) {
          tg.openLink(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }

    target.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!gameRunning) return;

      score += 1;
      size = Math.max(46, 84 - Math.floor(score / 2) * 2);
      updateUI();
      positionTarget();

      haptic(score % 10 === 0 ? "medium" : "light");

      if (score % 5 === 0) {
        setStatus("Nice: " + score + " hits");
      }
    });

    startBtn.addEventListener("click", startGame);

    resetBtn.addEventListener("click", () => {
      best = 0;
      localStorage.removeItem("tap-target-best");
      updateUI();
      setStatus("Best score reset");
    });

    tip1Btn.addEventListener("click", () => {
      openExternal(LINKS.tip1, "tip");
      setStatus("Opened tip checkout");
    });

    tip3Btn.addEventListener("click", () => {
      openExternal(LINKS.tip3, "support");
      setStatus("Opened support checkout");
    });

    sponsorBtn.addEventListener("click", () => {
      openExternal(LINKS.sponsor, "sponsor");
      setStatus("Opened sponsored link");
    });

    applyTelegramTheme();
    updateUI();

    if (tg) {
      setStatus("Telegram Mini App connected");
      tg.onEvent?.("themeChanged", applyTelegramTheme);
    }
  </script>
</body>
</html>
