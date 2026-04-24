const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const levelValue = document.getElementById("levelValue");
const bestValue = document.getElementById("bestValue");
const creditsValue = document.getElementById("creditsValue");
const gemsValue = document.getElementById("gemsValue");
const rankValue = document.getElementById("rankValue");
const xpValue = document.getElementById("xpValue");
const statusPill = document.getElementById("statusPill");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const abilityBoostButton = document.getElementById("abilityBoostButton");
const abilityShieldButton = document.getElementById("abilityShieldButton");
const abilityMagnetButton = document.getElementById("abilityMagnetButton");

const missionList = document.getElementById("missionList");
const upgradeEngineBtn = document.getElementById("upgradeEngineBtn");
const upgradeArmorBtn = document.getElementById("upgradeArmorBtn");
const upgradeMagnetBtn = document.getElementById("upgradeMagnetBtn");
const buyReviveBtn = document.getElementById("buyReviveBtn");
const buySkinBtn = document.getElementById("buySkinBtn");
const buyBoosterBtn = document.getElementById("buyBoosterBtn");
const paypalStatus = document.getElementById("paypalStatus");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const STORAGE_KEY = "neon-drift-core-loop-save";

// Replace with your own PayPal Client ID from developer.paypal.com.
// If left unchanged, PayPal buttons are disabled with guidance text.
const PAYPAL_CONFIG = {
  clientId: "REPLACE_WITH_YOUR_PAYPAL_CLIENT_ID",
  currency: "USD",
  packs: {
    starter: { id: "starter", gems: 100, price: "2.99", label: "100 Gems Pack" },
    racer: { id: "racer", gems: 250, price: "6.99", label: "250 Gems Pack" },
    legend: { id: "legend", gems: 700, price: "14.99", label: "700 Gems Pack" },
  },
};

const defaultSave = {
  best: 0,
  credits: 120,
  gems: 0,
  xp: 0,
  rank: 1,
  upgrades: {
    engine: 1,
    armor: 0,
    magnet: 0,
  },
  cosmetics: {
    neonSkinUnlocked: false,
  },
  inventory: {
    reviveToken: 0,
    xpBooster: 0,
  },
  missionProgress: {},
};

const missions = [
  { id: "score-500", title: "Score 500 in one run", target: 500, type: "runScore", rewardCredits: 140, rewardXp: 45 },
  { id: "collect-40-orbs", title: "Collect 40 orbs total", target: 40, type: "totalOrbs", rewardCredits: 120, rewardXp: 35 },
  { id: "dodge-180", title: "Dodge 180 meteors total", target: 180, type: "totalDodges", rewardCredits: 160, rewardXp: 50 },
];

const skins = [
  { body: "#6cf9ff", glow: "#21f3d0" },
  { body: "#ff7be8", glow: "#d06bff" },
];

const state = {
  running: false,
  paused: false,
  score: 0,
  lives: 3,
  level: 1,
  elapsed: 0,
  levelClock: 0,
  spawnClock: 0,
  orbClock: 0,
  keys: { left: false, right: false },
  lastFrame: 0,
  totalOrbs: 0,
  totalDodges: 0,
  save: structuredClone(defaultSave),
  activeSkin: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height - 56,
  width: 48,
  height: 20,
  baseSpeed: 360,
};

const hazards = [];
const orbs = [];
const abilities = {
  boost: { cooldown: 0, duration: 0 },
  shield: { cooldown: 0, duration: 0 },
  magnet: { cooldown: 0, duration: 0 },
};

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function loadSave() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (parsed && typeof parsed === "object") {
    state.save = {
      ...defaultSave,
      ...parsed,
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades || {}) },
      cosmetics: { ...defaultSave.cosmetics, ...(parsed.cosmetics || {}) },
      inventory: { ...defaultSave.inventory, ...(parsed.inventory || {}) },
      missionProgress: { ...(parsed.missionProgress || {}) },
    };
  } else {
    state.save = structuredClone(defaultSave);
  }
}

function persistSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
}

function setStatus(text) {
  statusPill.textContent = text;
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function xpForNextRank(rank) {
  return 80 + (rank - 1) * 65;
}

function grantXp(amount) {
  state.save.xp += amount;
  while (state.save.xp >= xpForNextRank(state.save.rank)) {
    state.save.xp -= xpForNextRank(state.save.rank);
    state.save.rank += 1;
    state.save.credits += 50;
    setStatus(`Rank up! You reached Rank ${state.save.rank} (+50 credits).`);
  }
}

function updateHud() {
  scoreValue.textContent = String(state.score);
  livesValue.textContent = String(state.lives);
  levelValue.textContent = String(state.level);
  bestValue.textContent = String(state.save.best);
  creditsValue.textContent = String(state.save.credits);
  gemsValue.textContent = String(state.save.gems);
  rankValue.textContent = String(state.save.rank);
  xpValue.textContent = `${state.save.xp}/${xpForNextRank(state.save.rank)}`;
}

function currentSpeed() {
  const boostMultiplier = abilities.boost.duration > 0 ? 1.62 : 1;
  return (player.baseSpeed + state.save.upgrades.engine * 28) * boostMultiplier;
}

function armorBlockChance() {
  return Math.min(0.45, state.save.upgrades.armor * 0.11);
}

function magnetStrength() {
  const activeBonus = abilities.magnet.duration > 0 ? 1.25 : 0;
  return 1 + state.save.upgrades.magnet * 0.45 + activeBonus;
}

function missionCurrentValue(mission) {
  if (mission.type === "runScore") {
    return state.score;
  }
  if (mission.type === "totalOrbs") {
    return state.save.missionProgress.totalOrbs || 0;
  }
  if (mission.type === "totalDodges") {
    return state.save.missionProgress.totalDodges || 0;
  }
  return 0;
}

function updateMissionProgressCounters() {
  state.save.missionProgress.totalOrbs = (state.save.missionProgress.totalOrbs || 0) + state.totalOrbs;
  state.save.missionProgress.totalDodges = (state.save.missionProgress.totalDodges || 0) + state.totalDodges;
}

function renderMissions() {
  missionList.innerHTML = "";
  for (const mission of missions) {
    const current = Math.min(missionCurrentValue(mission), mission.target);
    const completedKey = `${mission.id}-claimed`;
    const claimed = state.save.missionProgress[completedKey] === true;
    const li = document.createElement("li");
    li.className = "mission-item";

    const title = document.createElement("div");
    title.className = "mission-title";
    title.textContent = mission.title;

    const progress = document.createElement("div");
    progress.className = "mission-progress";
    progress.textContent = `${current}/${mission.target}`;

    const reward = document.createElement("div");
    reward.className = "mission-reward";
    reward.textContent = `Reward: +${mission.rewardCredits} credits, +${mission.rewardXp} XP`;

    const claimBtn = document.createElement("button");
    claimBtn.type = "button";
    claimBtn.className = "button";
    claimBtn.textContent = claimed ? "Claimed" : "Claim";
    claimBtn.disabled = claimed || current < mission.target;
    claimBtn.addEventListener("click", () => {
      if (claimBtn.disabled) {
        return;
      }
      state.save.credits += mission.rewardCredits;
      grantXp(mission.rewardXp);
      state.save.missionProgress[completedKey] = true;
      persistSave();
      updateHud();
      renderMissions();
      setStatus(`Mission completed: ${mission.title}`);
    });

    li.append(title, progress, reward, claimBtn);
    missionList.appendChild(li);
  }
}

function resetRun() {
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.elapsed = 0;
  state.levelClock = 0;
  state.spawnClock = 0;
  state.orbClock = 0;
  state.totalOrbs = 0;
  state.totalDodges = 0;
  state.paused = false;
  hazards.length = 0;
  orbs.length = 0;
  player.x = canvas.width / 2;
  abilities.boost.cooldown = 0;
  abilities.boost.duration = 0;
  abilities.shield.cooldown = 0;
  abilities.shield.duration = 0;
  abilities.magnet.cooldown = 0;
  abilities.magnet.duration = 0;
  updateAbilityButtons();
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
  setStatus("Run started");
  requestAnimationFrame(loop);
}

function finishRun() {
  state.running = false;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";

  if (state.score > state.save.best) {
    state.save.best = state.score;
  }

  const creditsEarned = Math.floor(state.score / 12) + state.level * 4;
  const xpEarned = Math.floor(state.score / 18) + state.level * 3;
  state.save.credits += creditsEarned;
  grantXp(xpEarned);
  updateMissionProgressCounters();
  persistSave();
  updateHud();
  renderMissions();

  showOverlay(
    "Run complete",
    `Score ${state.score}. You earned +${creditsEarned} credits and +${xpEarned} XP.`
  );
  setStatus("Run ended");
}

function takeHit() {
  if (abilities.shield.duration > 0) {
    setStatus("Shield absorbed the hit");
    return;
  }
  const blocked = Math.random() < armorBlockChance();
  if (blocked) {
    setStatus("Armor blocked damage");
    return;
  }
  state.lives -= 1;
  updateHud();
  if (state.lives <= 0) {
    if (state.save.inventory.reviveToken > 0) {
      const revive = window.confirm("Use a Revive Token to continue this run?");
      if (revive) {
        state.save.inventory.reviveToken -= 1;
        state.lives = 2;
        persistSave();
        updateHud();
        setStatus("Revived with token");
        return;
      }
    }
    finishRun();
  } else {
    setStatus(`Hit taken. ${state.lives} lives left`);
  }
}

function togglePause() {
  if (!state.running) {
    return;
  }
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  if (state.paused) {
    showOverlay("Paused", "Take a break or resume the run.");
  } else {
    hideOverlay();
    state.lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function activateBoost() {
  if (!state.running || abilities.boost.cooldown > 0 || abilities.boost.duration > 0) {
    return;
  }
  abilities.boost.duration = 3.2 + state.save.upgrades.engine * 0.3;
  abilities.boost.cooldown = 17 - Math.min(4, state.save.upgrades.engine);
  setStatus("Boost activated");
  updateAbilityButtons();
}

function activateShield() {
  if (!state.running || abilities.shield.cooldown > 0 || abilities.shield.duration > 0) {
    return;
  }
  abilities.shield.duration = 2.2 + state.save.upgrades.armor * 0.4;
  abilities.shield.cooldown = 21 - Math.min(6, state.save.upgrades.armor * 2);
  setStatus("Shield activated");
  updateAbilityButtons();
}

function activateMagnet() {
  if (!state.running || abilities.magnet.cooldown > 0 || abilities.magnet.duration > 0) {
    return;
  }
  abilities.magnet.duration = 4.5 + state.save.upgrades.magnet * 0.35;
  abilities.magnet.cooldown = 24 - Math.min(5, state.save.upgrades.magnet * 1.5);
  setStatus("Magnet activated");
  updateAbilityButtons();
}

function updateAbilityButtons() {
  const boostLabel =
    abilities.boost.duration > 0
      ? `Boost ${abilities.boost.duration.toFixed(1)}s`
      : abilities.boost.cooldown > 0
      ? `Boost ${abilities.boost.cooldown.toFixed(0)}s`
      : "Boost (E)";
  const shieldLabel =
    abilities.shield.duration > 0
      ? `Shield ${abilities.shield.duration.toFixed(1)}s`
      : abilities.shield.cooldown > 0
      ? `Shield ${abilities.shield.cooldown.toFixed(0)}s`
      : "Shield (Q)";
  const magnetLabel =
    abilities.magnet.duration > 0
      ? `Magnet ${abilities.magnet.duration.toFixed(1)}s`
      : abilities.magnet.cooldown > 0
      ? `Magnet ${abilities.magnet.cooldown.toFixed(0)}s`
      : "Magnet";

  abilityBoostButton.textContent = boostLabel;
  abilityShieldButton.textContent = shieldLabel;
  abilityMagnetButton.textContent = magnetLabel;
}

function spawnHazard() {
  const size = Math.random() * 24 + 16;
  hazards.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    size,
    speed: 120 + Math.random() * 150 + state.level * 18,
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
    speed: 150 + state.level * 15,
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
  player.x += moveDirection * currentSpeed() * dt;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

  state.elapsed += dt;
  state.levelClock += dt;
  state.spawnClock += dt;
  state.orbClock += dt;

  if (state.levelClock >= 18) {
    state.level += 1;
    state.levelClock = 0;
  }

  for (const ability of Object.values(abilities)) {
    ability.cooldown = Math.max(0, ability.cooldown - dt);
    ability.duration = Math.max(0, ability.duration - dt);
  }
  updateAbilityButtons();

  const hazardRate = Math.max(0.22, 0.66 - state.level * 0.035);
  if (state.spawnClock >= hazardRate) {
    state.spawnClock = 0;
    spawnHazard();
  }

  const orbRate = Math.max(0.7, 1.9 - state.level * 0.04);
  if (state.orbClock >= orbRate) {
    state.orbClock = 0;
    spawnOrb();
  }

  for (let i = hazards.length - 1; i >= 0; i -= 1) {
    const h = hazards[i];
    h.y += h.speed * dt;
    h.x += Math.sin(state.elapsed * h.wobbleRate + h.wobble) * 36 * dt;

    const hazardRect = { x: h.x, y: h.y, width: h.size, height: h.size };
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    if (intersects(hazardRect, playerRect)) {
      hazards.splice(i, 1);
      takeHit();
      if (!state.running) {
        return;
      }
      continue;
    }

    if (h.y > canvas.height + h.size) {
      hazards.splice(i, 1);
      state.score += 2;
      state.totalDodges += 1;
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const orb = orbs[i];
    const pull = magnetStrength();
    const targetX = player.x + player.width / 2 - orb.size / 2;
    orb.x += (targetX - orb.x) * (0.5 + pull * 0.15) * dt;
    orb.y += orb.speed * dt;
    orb.pulse += 4 * dt;

    const orbRect = { x: orb.x, y: orb.y, width: orb.size, height: orb.size };
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    if (intersects(orbRect, playerRect)) {
      orbs.splice(i, 1);
      state.score += 12;
      state.totalOrbs += 1;
      continue;
    }
    if (orb.y > canvas.height + orb.size) {
      orbs.splice(i, 1);
    }
  }

  updateHud();
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
  const skin = skins[state.activeSkin] || skins[0];
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  ctx.fillStyle = skin.body;
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-player.width / 2, player.height / 2);
  ctx.lineTo(0, -player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();
  if (abilities.shield.duration > 0) {
    ctx.strokeStyle = "rgba(120, 200, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.width * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  }
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

function spendCredits(amount) {
  if (state.save.credits < amount) {
    setStatus(`Need ${amount} credits`);
    return false;
  }
  state.save.credits -= amount;
  return true;
}

function spendGems(amount) {
  if (state.save.gems < amount) {
    setStatus(`Need ${amount} gems`);
    return false;
  }
  state.save.gems -= amount;
  return true;
}

function buyUpgrade(type) {
  const level = state.save.upgrades[type];
  const cost = 90 + level * 110;
  if (!spendCredits(cost)) {
    return;
  }
  state.save.upgrades[type] += 1;
  persistSave();
  updateHud();
  setStatus(`${type} upgraded to level ${state.save.upgrades[type]}`);
}

function buyGemItem(item) {
  if (item === "revive") {
    if (!spendGems(60)) {
      return;
    }
    state.save.inventory.reviveToken += 1;
    setStatus("Bought Revive Token");
  } else if (item === "skin") {
    if (state.save.cosmetics.neonSkinUnlocked) {
      state.activeSkin = state.activeSkin === 0 ? 1 : 0;
      setStatus("Switched skin");
    } else {
      if (!spendGems(140)) {
        return;
      }
      state.save.cosmetics.neonSkinUnlocked = true;
      state.activeSkin = 1;
      setStatus("Unlocked Neon Skin");
    }
  } else if (item === "boost") {
    if (!spendGems(90)) {
      return;
    }
    state.save.inventory.xpBooster += 1;
    setStatus("Bought XP Booster");
  }
  persistSave();
  updateHud();
}

function paypalClientConfigured() {
  return PAYPAL_CONFIG.clientId && !PAYPAL_CONFIG.clientId.includes("REPLACE_WITH");
}

function loadPayPalSdk() {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CONFIG.clientId)}&currency=${encodeURIComponent(PAYPAL_CONFIG.currency)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.head.appendChild(script);
  });
}

function renderPayPalPack(pack, selectorId) {
  const container = document.getElementById(selectorId);
  if (!container || !window.paypal) {
    return;
  }
  container.innerHTML = "";
  window.paypal.Buttons({
    style: { layout: "horizontal", color: "gold", shape: "pill", label: "paypal", height: 38 },
    createOrder(_data, actions) {
      return actions.order.create({
        purchase_units: [
          {
            amount: {
              currency_code: PAYPAL_CONFIG.currency,
              value: pack.price,
            },
            description: `Neon Drift - ${pack.label}`,
          },
        ],
      });
    },
    onApprove(_data, actions) {
      return actions.order.capture().then(() => {
        state.save.gems += pack.gems;
        persistSave();
        updateHud();
        setStatus(`Payment successful: +${pack.gems} gems`);
      });
    },
    onError() {
      setStatus("PayPal payment error. Try again.");
    },
  }).render(`#${selectorId}`);
}

async function setupPayPalButtons() {
  if (!paypalClientConfigured()) {
    paypalStatus.textContent = "Set PAYPAL_CONFIG.clientId in game.js to enable real PayPal payments.";
    return;
  }
  try {
    await loadPayPalSdk();
    renderPayPalPack(PAYPAL_CONFIG.packs.starter, "paypal-pack-starter");
    renderPayPalPack(PAYPAL_CONFIG.packs.racer, "paypal-pack-racer");
    renderPayPalPack(PAYPAL_CONFIG.packs.legend, "paypal-pack-legend");
    paypalStatus.textContent = "PayPal checkout ready.";
  } catch {
    paypalStatus.textContent = "Could not initialize PayPal checkout.";
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a" || key === "arrowleft") {
    state.keys.left = true;
  }
  if (key === "d" || key === "arrowright") {
    state.keys.right = true;
  }
  if (key === "e") {
    activateBoost();
  }
  if (key === "q") {
    activateShield();
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
abilityBoostButton.addEventListener("click", activateBoost);
abilityShieldButton.addEventListener("click", activateShield);
abilityMagnetButton.addEventListener("click", activateMagnet);
upgradeEngineBtn.addEventListener("click", () => buyUpgrade("engine"));
upgradeArmorBtn.addEventListener("click", () => buyUpgrade("armor"));
upgradeMagnetBtn.addEventListener("click", () => buyUpgrade("magnet"));
buyReviveBtn.addEventListener("click", () => buyGemItem("revive"));
buySkinBtn.addEventListener("click", () => buyGemItem("skin"));
buyBoosterBtn.addEventListener("click", () => buyGemItem("boost"));

loadSave();
if (state.save.cosmetics.neonSkinUnlocked) {
  state.activeSkin = 1;
}
updateHud();
renderMissions();
updateAbilityButtons();
draw();
setStatus("Ready to start");
showOverlay(
  "Thread the neon lanes.",
  "Move with A / D or arrow keys. On touch, drag left/right. Upgrade your rig and complete missions."
);
setupPayPalButtons();
