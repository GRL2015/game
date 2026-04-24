const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const levelValue = document.getElementById("levelValue");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const STORAGE_KEY = "neon-drift-best-score";

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  level: 1,
  levelClock: 0,
  elapsed: 0,
  spawnClock: 0,
  orbClock: 0,
  keys: { left: false, right: false },
  lastFrame: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height - 56,
  width: 44,
  height: 18,
  speed: 390,
};

const hazards = [];
const orbs = [];

function updateHud() {
  scoreValue.textContent = String(state.score);
  bestValue.textContent = String(state.best);
  levelValue.textContent = String(state.level);
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function resetRun() {
  state.score = 0;
  state.level = 1;
  state.levelClock = 0;
  state.elapsed = 0;
  state.spawnClock = 0;
  state.orbClock = 0;
  state.gameOver = false;
  state.paused = false;
  hazards.length = 0;
  orbs.length = 0;
  player.x = canvas.width / 2;
  updateHud();
}

function startGame() {
  resetRun();
  state.running = true;
  state.lastFrame = performance.now();
  pauseButton.disabled = false;
  restartButton.disabled = false;
  pauseButton.textContent = "Pause";
  hideOverlay();
  requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }

  updateHud();
  showOverlay(
    "Run ended.",
    `Score: ${state.score}. Press restart to jump back in and beat ${state.best}.`
  );
}

function togglePause() {
  if (!state.running) {
    return;
  }

  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  if (state.paused) {
    showOverlay("Paused", "Press resume to continue drifting through meteor lanes.");
  } else {
    hideOverlay();
    state.lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function spawnHazard() {
  const size = Math.random() * 22 + 18;
  hazards.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    size,
    speed: 120 + Math.random() * 140 + state.level * 20,
    wobble: Math.random() * Math.PI * 2,
    wobbleRate: 1 + Math.random() * 2,
  });
}

function spawnOrb() {
  const size = 12;
  orbs.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    size,
    speed: 145 + state.level * 18,
    pulse: Math.random() * Math.PI * 2,
  });
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update(dt) {
  const moveDirection = Number(state.keys.right) - Number(state.keys.left);
  player.x += moveDirection * player.speed * dt;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

  state.elapsed += dt;
  state.levelClock += dt;
  state.spawnClock += dt;
  state.orbClock += dt;

  if (state.levelClock >= 16) {
    state.level += 1;
    state.levelClock = 0;
    updateHud();
  }

  const hazardRate = Math.max(0.22, 0.65 - state.level * 0.04);
  if (state.spawnClock >= hazardRate) {
    state.spawnClock = 0;
    spawnHazard();
  }

  const orbRate = Math.max(0.7, 2 - state.level * 0.05);
  if (state.orbClock >= orbRate) {
    state.orbClock = 0;
    spawnOrb();
  }

  for (let i = hazards.length - 1; i >= 0; i -= 1) {
    const h = hazards[i];
    h.y += h.speed * dt;
    h.x += Math.sin(state.elapsed * h.wobbleRate + h.wobble) * 38 * dt;

    const hazardRect = { x: h.x, y: h.y, width: h.size, height: h.size };
    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    if (intersects(hazardRect, playerRect)) {
      endGame();
      return;
    }

    if (h.y > canvas.height + h.size) {
      hazards.splice(i, 1);
      state.score += 2;
      updateHud();
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const orb = orbs[i];
    orb.y += orb.speed * dt;
    orb.pulse += 4 * dt;
    const orbRect = { x: orb.x, y: orb.y, width: orb.size, height: orb.size };
    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    if (intersects(orbRect, playerRect)) {
      orbs.splice(i, 1);
      state.score += 12;
      updateHud();
      continue;
    }

    if (orb.y > canvas.height + orb.size) {
      orbs.splice(i, 1);
    }
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0d1120");
  gradient.addColorStop(1, "#05070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0, 255, 208, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  ctx.fillStyle = "#6cf9ff";
  ctx.shadowColor = "#21f3d0";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-player.width / 2, player.height / 2);
  ctx.lineTo(0, -player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHazards() {
  for (const h of hazards) {
    const gradient = ctx.createRadialGradient(
      h.x + h.size / 2,
      h.y + h.size / 2,
      2,
      h.x + h.size / 2,
      h.y + h.size / 2,
      h.size
    );
    gradient.addColorStop(0, "#ffd7a1");
    gradient.addColorStop(1, "#ff4f77");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(h.x + h.size / 2, h.y + h.size / 2, h.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrbs() {
  for (const orb of orbs) {
    const pulseScale = 1 + Math.sin(orb.pulse) * 0.12;
    const radius = (orb.size / 2) * pulseScale;
    ctx.fillStyle = "#7cff8d";
    ctx.shadowColor = "#7cff8d";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(orb.x + orb.size / 2, orb.y + orb.size / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function draw() {
  drawBackground();
  drawPlayer();
  drawHazards();
  drawOrbs();
}

function loop(now) {
  if (!state.running || state.paused) {
    return;
  }

  const dt = Math.min(0.033, (now - state.lastFrame) / 1000);
  state.lastFrame = now;

  update(dt);
  draw();

  if (state.running) {
    requestAnimationFrame(loop);
  }
}

function setTouchControl(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const leftZone = rect.width * 0.45;
  const rightZone = rect.width * 0.55;
  state.keys.left = x < leftZone;
  state.keys.right = x > rightZone;
}

function clearTouchControl() {
  state.keys.left = false;
  state.keys.right = false;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a" || key === "arrowleft") {
    state.keys.left = true;
  }
  if (key === "d" || key === "arrowright") {
    state.keys.right = true;
  }
  if (key === " " && state.running) {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a" || key === "arrowleft") {
    state.keys.left = false;
  }
  if (key === "d" || key === "arrowright") {
    state.keys.right = false;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  setTouchControl(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pressure > 0) {
    setTouchControl(event);
  }
});

canvas.addEventListener("pointerup", clearTouchControl);
canvas.addEventListener("pointercancel", clearTouchControl);
canvas.addEventListener("pointerleave", clearTouchControl);

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);

updateHud();
draw();
showOverlay(
  "Dodge the meteors.",
  "Move with A / D, arrow keys, or drag on touch. Collect glowing orbs for points."
);
