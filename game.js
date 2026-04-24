const STORAGE_KEY = "nova-blitz-arena-v3";
const USER_KEY = "nba-user-id";
const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8787/api" : "/api";

const RARITY_META = {
  common: { label: "Common", color: "#22c55e", salvage: 24, buyCost: 180, sort: 0 },
  rare: { label: "Rare", color: "#3b82f6", salvage: 80, buyCost: 460, sort: 1 },
  epic: { label: "Epic", color: "#9333ea", salvage: 260, buyCost: 1300, sort: 2 },
  legendary: { label: "Legendary", color: "#fbbf24", salvage: 900, buyCost: 4400, sort: 3 },
  mythic: { label: "Mythic", color: "#14b8a6", salvage: 2900, buyCost: 17000, sort: 4 },
  godly: { label: "Godly", color: "#111111", salvage: 15000, buyCost: 99000, sort: 5 },
};

const CRATE_ODDS = {
  street: {
    common: 6500,
    rare: 2200,
    epic: 900,
    legendary: 320,
    mythic: 75,
    godly: 5,
  },
  premium: {
    common: 4500,
    rare: 2800,
    epic: 1600,
    legendary: 800,
    mythic: 270,
    godly: 30,
  },
};

const SKINS = [
  { id: "pulse-runner", name: "Pulse Runner", rarity: "common", body: "#7cf8ae", glow: "#2dcf74" },
  { id: "garden-shift", name: "Garden Shift", rarity: "common", body: "#79f09e", glow: "#2abb65" },
  { id: "deep-sonar", name: "Deep Sonar", rarity: "rare", body: "#8eb7ff", glow: "#3877ef" },
  { id: "blue-lattice", name: "Blue Lattice", rarity: "rare", body: "#7ba8ff", glow: "#2f66db" },
  { id: "violet-vortex", name: "Violet Vortex", rarity: "epic", body: "#cc86ff", glow: "#8e34e6" },
  { id: "purple-static", name: "Purple Static", rarity: "epic", body: "#c274ff", glow: "#822ed6" },
  { id: "golden-shard", name: "Golden Shard", rarity: "legendary", body: "#ffdf92", glow: "#efaf34" },
  { id: "crown-arc", name: "Crown Arc", rarity: "legendary", body: "#ffd66f", glow: "#dd9928" },
  { id: "tidal-phantom", name: "Tidal Phantom", rarity: "mythic", body: "#84fff7", glow: "#20b6b0" },
  { id: "neon-empress", name: "Neon Empress", rarity: "mythic", body: "#6ff2e8", glow: "#22a89f" },
  { id: "void-emperor", name: "Void Emperor", rarity: "godly", body: "#2a2c30", glow: "#07080a" },
  { id: "black-halo", name: "Black Halo", rarity: "godly", body: "#232529", glow: "#030304" },
];

const ALL_MISSIONS = [
  { id: "score-500", text: "Score 500 in one round", target: 500, type: "bestRoundScore", rewardXp: 70, rewardCredits: 180, premium: false },
  { id: "orbs-40", text: "Collect 40 orbs total", target: 40, type: "orbs", rewardXp: 60, rewardCredits: 160, premium: false },
  { id: "dodges-120", text: "Dodge 120 hazards total", target: 120, type: "dodges", rewardXp: 65, rewardCredits: 170, premium: false },
  { id: "wins-4", text: "Win 4 rounds", target: 4, type: "wins", rewardXp: 80, rewardCredits: 220, premium: false },
  { id: "premium-score-900", text: "Premium: score 900 in one round", target: 900, type: "bestRoundScore", rewardXp: 120, rewardCredits: 320, premium: true },
];

const EVENTS = [
  { id: "double-xp-weekend", name: "Double XP Weekend", active: true, xpMultiplier: 2 },
  { id: "legendary-week", name: "Legendary Week", active: false, legendaryBonus: true },
];

const TOURNAMENTS = [
  { id: "weekly-open", name: "Weekly Open", premiumOnly: false, entryFeeCredits: 0 },
  { id: "weekly-premium", name: "Weekly Premium Cup", premiumOnly: true, entryFeeCredits: 250 },
];

const PAYPAL_CONFIG = {
  clientId: "REPLACE_WITH_YOUR_PAYPAL_CLIENT_ID",
  currency: "USD",
  packs: {
    starter: { id: "starter", gems: 100, price: "2.99", label: "100 Gems Pack" },
    racer: { id: "racer", gems: 250, price: "6.99", label: "250 Gems Pack" },
    legend: { id: "legend", gems: 700, price: "14.99", label: "700 Gems Pack" },
  },
};

const ui = {
  canvas: document.getElementById("gameCanvas"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  round: document.getElementById("roundValue"),
  best: document.getElementById("bestValue"),
  credits: document.getElementById("creditsValue"),
  gems: document.getElementById("gemsValue"),
  rank: document.getElementById("rankValue"),
  xp: document.getElementById("xpValue"),
  premium: document.getElementById("premiumValue"),
  status: document.getElementById("statusPill"),
  xpFill: document.getElementById("xpFill"),
  streakLabel: document.getElementById("dailyStreakLabel"),
  missionList: document.getElementById("missionList"),
  rotatingShop: document.getElementById("rotatingShop"),
  streetCrates: document.getElementById("streetCratesValue"),
  premiumCrates: document.getElementById("premiumCratesValue"),
  vaultValue: document.getElementById("vaultValue"),
  dropResult: document.getElementById("dropResult"),
  profileCard: document.getElementById("profileCard"),
  collectionList: document.getElementById("collectionList"),
  leaderboardList: document.getElementById("leaderboardList"),
  paypalStatus: document.getElementById("paypalStatus"),
};

const ctx = ui.canvas.getContext("2d");

const state = {
  userId: "",
  running: false,
  paused: false,
  score: 0,
  best: 0,
  level: 1,
  lives: 3,
  roundSeconds: 20,
  timeLeft: 20,
  matchCount: 0,
  wins: 0,
  xp: 0,
  rank: 1,
  credits: 300,
  gems: 80,
  premium: false,
  premiumUntil: null,
  eventPassPremium: false,
  streakDays: 0,
  dailyClaimAt: "",
  lastInviteClaimAt: "",
  adCooldownMatches: 0,
  missionLedger: {},
  missionsForToday: [],
  inventory: {
    streetCrates: 2,
    premiumCrates: 0,
    reviveToken: 0,
    xpBooster: 0,
    ownedSkins: { "pulse-runner": 1 },
    equippedSkin: "pulse-runner",
  },
  metrics: {
    totalOrbs: 0,
    totalDodges: 0,
    bestRoundScore: 0,
  },
  lastDrop: "",
  firstPurchaseDone: false,
  matchBoosts: {
    xpMultiplier: 1,
  },
  keys: { left: false, right: false },
};

const world = {
  player: { x: ui.canvas.width / 2, y: ui.canvas.height - 45, width: 46, height: 18, speed: 420 },
  hazards: [],
  orbs: [],
  elapsed: 0,
  levelClock: 0,
  spawnClock: 0,
  orbClock: 0,
  lastFrame: 0,
  abilities: {
    boost: { cooldown: 0, duration: 0 },
    shield: { cooldown: 0, duration: 0 },
    magnet: { cooldown: 0, duration: 0 },
  },
};

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      best: state.best,
      xp: state.xp,
      rank: state.rank,
      credits: state.credits,
      gems: state.gems,
      premium: state.premium,
      premiumUntil: state.premiumUntil,
      eventPassPremium: state.eventPassPremium,
      streakDays: state.streakDays,
      dailyClaimAt: state.dailyClaimAt,
      lastInviteClaimAt: state.lastInviteClaimAt,
      missionLedger: state.missionLedger,
      inventory: state.inventory,
      metrics: state.metrics,
      firstPurchaseDone: state.firstPurchaseDone,
      wins: state.wins,
      matchCount: state.matchCount,
      lastDrop: state.lastDrop,
    })
  );
}

function loadState() {
  const user = localStorage.getItem(USER_KEY);
  if (user) {
    state.userId = user;
  } else {
    state.userId = `u-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(USER_KEY, state.userId);
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
    state.inventory = { ...state.inventory, ...(parsed.inventory || {}) };
    state.inventory.ownedSkins = { "pulse-runner": 1, ...(parsed.inventory?.ownedSkins || {}) };
    state.metrics = { ...state.metrics, ...(parsed.metrics || {}) };
    state.matchBoosts = { xpMultiplier: 1 };
  } catch {
    // ignore corrupt saves
  }
}

function setStatus(text) {
  ui.status.textContent = text;
}

function showOverlay(title, text) {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
}

function xpForNextRank(rank) {
  return 110 + (rank - 1) * 80;
}

function grantXp(amount) {
  const multiplier = state.premium ? 2 : 1;
  const boosted = Math.floor(amount * multiplier * state.matchBoosts.xpMultiplier);
  state.xp += boosted;
  while (state.xp >= xpForNextRank(state.rank)) {
    state.xp -= xpForNextRank(state.rank);
    state.rank += 1;
    state.credits += 90;
    if (state.rank % 3 === 0) {
      state.inventory.streetCrates += 1;
    }
  }
}

function rarityMeta(rarity) {
  return RARITY_META[rarity] || RARITY_META.common;
}

function rarityOrder(a, b) {
  return rarityMeta(a.rarity).sort - rarityMeta(b.rarity).sort;
}

function skinById(id) {
  return SKINS.find((skin) => skin.id === id) || SKINS[0];
}

function vaultValue() {
  return SKINS.reduce((sum, skin) => {
    const owned = state.inventory.ownedSkins[skin.id] || 0;
    return sum + owned * rarityMeta(skin.rarity).buyCost;
  }, 0);
}

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.lives.textContent = String(state.lives);
  ui.round.textContent = String(Math.max(0, state.timeLeft));
  ui.best.textContent = String(state.best);
  ui.credits.textContent = String(state.credits);
  ui.gems.textContent = String(state.gems);
  ui.rank.textContent = String(state.rank);
  ui.xp.textContent = `${state.xp}/${xpForNextRank(state.rank)}`;
  ui.premium.textContent = state.premium ? "Yes" : "No";
  ui.streakLabel.textContent = `Streak: ${state.streakDays}`;
  ui.xpFill.style.width = `${Math.min(100, (state.xp / xpForNextRank(state.rank)) * 100)}%`;
  ui.streetCrates.textContent = String(state.inventory.streetCrates);
  ui.premiumCrates.textContent = String(state.inventory.premiumCrates);
  ui.vaultValue.textContent = String(vaultValue());
}

function renderProfileCard() {
  ui.profileCard.innerHTML = `
    <div><b>User:</b> ${state.userId}</div>
    <div><b>Wins:</b> ${state.wins} / <b>Matches:</b> ${state.matchCount}</div>
    <div><b>Equipped Skin:</b> ${skinById(state.inventory.equippedSkin).name}</div>
    <div><b>Premium:</b> ${state.premium ? "Active" : "Free"}</div>
    <div><b>Event Pass:</b> ${state.eventPassPremium ? "Premium Track" : "Free Track"}</div>
    <div><b>Last Drop:</b> ${state.lastDrop || "None"}</div>
  `;
}

function renderCollection() {
  ui.collectionList.innerHTML = "";
  const skins = [...SKINS].sort(rarityOrder);
  for (const skin of skins) {
    const li = document.createElement("li");
    li.className = "collection-item";
    li.style.borderColor = rarityMeta(skin.rarity).color;
    const owned = state.inventory.ownedSkins[skin.id] || 0;

    const left = document.createElement("div");
    left.className = "collection-left";
    const swatch = document.createElement("span");
    swatch.className = "collection-swatch";
    swatch.style.background = `linear-gradient(135deg, ${skin.body}, ${skin.glow})`;
    const text = document.createElement("div");
    text.className = "collection-text";
    const title = document.createElement("strong");
    title.textContent = skin.name;
    const meta = document.createElement("span");
    meta.className = "collection-meta";
    meta.textContent = `${rarityMeta(skin.rarity).label} • Owned: ${owned}`;
    meta.style.color = rarityMeta(skin.rarity).color;
    text.append(title, meta);
    left.append(swatch, text);

    const btn = document.createElement("button");
    btn.className = "button small-button";
    btn.type = "button";
    btn.textContent = state.inventory.equippedSkin === skin.id ? "Equipped" : "Equip";
    btn.disabled = owned <= 0 || state.inventory.equippedSkin === skin.id;
    btn.addEventListener("click", () => {
      state.inventory.equippedSkin = skin.id;
      saveState();
      renderCollection();
      renderProfileCard();
      setStatus(`Equipped ${skin.name}`);
    });

    li.append(left, btn);
    ui.collectionList.appendChild(li);
  }
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function rotateMissionsIfNeeded() {
  const key = dayKey();
  if (state.missionLedger.day === key && state.missionsForToday.length > 0) return;
  const offset = new Date().getDate() % ALL_MISSIONS.length;
  const freePool = ALL_MISSIONS.filter((m) => !m.premium);
  const premiumPool = ALL_MISSIONS.filter((m) => m.premium);
  state.missionsForToday = [
    freePool[offset % freePool.length],
    freePool[(offset + 1) % freePool.length],
    freePool[(offset + 2) % freePool.length],
    premiumPool[offset % premiumPool.length],
  ];
  state.missionLedger = { day: key, progress: {}, claimed: {} };
  saveState();
}

function missionProgressFor(id) {
  return state.missionLedger.progress[id] || 0;
}

function missionClaimed(id) {
  return state.missionLedger.claimed[id] === true;
}

function renderMissions() {
  ui.missionList.innerHTML = "";
  for (const mission of state.missionsForToday) {
    const li = document.createElement("li");
    li.className = "mission-item";
    const title = document.createElement("div");
    title.className = "mission-title";
    title.textContent = mission.premium ? `${mission.text} (Premium)` : mission.text;
    const progress = Math.min(mission.target, missionProgressFor(mission.id));
    const progressEl = document.createElement("div");
    progressEl.className = "mission-progress";
    progressEl.textContent = `${progress}/${mission.target}`;
    const reward = document.createElement("div");
    reward.className = "mission-reward";
    reward.textContent = `+${mission.rewardCredits} credits • +${mission.rewardXp} XP`;
    const claim = document.createElement("button");
    claim.type = "button";
    claim.className = "button small-button";
    claim.textContent = missionClaimed(mission.id) ? "Claimed" : "Claim";
    claim.disabled = missionClaimed(mission.id) || progress < mission.target || (mission.premium && !state.premium);
    claim.addEventListener("click", () => {
      if (claim.disabled) return;
      state.credits += mission.rewardCredits;
      grantXp(mission.rewardXp);
      state.missionLedger.claimed[mission.id] = true;
      saveState();
      updateHud();
      renderMissions();
      setStatus(`Claimed mission: ${mission.text}`);
    });
    li.append(title, progressEl, reward, claim);
    ui.missionList.appendChild(li);
  }
}

function updateMissionStats(roundWon) {
  for (const mission of state.missionsForToday) {
    if (mission.type === "bestRoundScore") {
      state.missionLedger.progress[mission.id] = Math.max(missionProgressFor(mission.id), state.score);
    } else if (mission.type === "orbs") {
      state.missionLedger.progress[mission.id] = (state.missionLedger.progress[mission.id] || 0) + world.roundOrbs;
    } else if (mission.type === "dodges") {
      state.missionLedger.progress[mission.id] = (state.missionLedger.progress[mission.id] || 0) + world.roundDodges;
    } else if (mission.type === "wins") {
      state.missionLedger.progress[mission.id] = (state.missionLedger.progress[mission.id] || 0) + (roundWon ? 1 : 0);
    }
  }
}

function claimDaily() {
  const today = dayKey();
  if (state.dailyClaimAt === today) {
    setStatus("Daily reward already claimed.");
    return;
  }
  const y = new Date();
  y.setDate(y.getDate() - 1);
  state.streakDays = state.dailyClaimAt === dayKey(y) ? state.streakDays + 1 : 1;
  state.dailyClaimAt = today;
  const rewardCredits = 120 + state.streakDays * 18;
  const rewardGems = state.streakDays % 7 === 0 ? 25 : 6;
  state.credits += rewardCredits;
  state.gems += rewardGems;
  saveState();
  updateHud();
  setStatus(`Daily claimed: +${rewardCredits} credits, +${rewardGems} gems`);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function resetRound() {
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.timeLeft = state.roundSeconds;
  world.elapsed = 0;
  world.levelClock = 0;
  world.spawnClock = 0;
  world.orbClock = 0;
  world.hazards = [];
  world.orbs = [];
  world.roundOrbs = 0;
  world.roundDodges = 0;
  world.player.x = ui.canvas.width / 2;
  world.abilities.boost = { cooldown: 0, duration: 0 };
  world.abilities.shield = { cooldown: 0, duration: 0 };
  world.abilities.magnet = { cooldown: 0, duration: 0 };
}

function startMatch() {
  if (state.running) return;
  resetRound();
  state.running = true;
  state.paused = false;
  world.lastFrame = performance.now();
  hideOverlay();
  setStatus("Match started");
  requestAnimationFrame(loop);
  setTimeout(() => {
    if (state.running) {
      state.timeLeft = Math.max(0, state.timeLeft - 1);
      if (state.timeLeft <= 0) endMatch(state.lives > 0);
    }
  }, 1000);
}

function endMatch(win) {
  if (!state.running) return;
  state.running = false;
  state.matchCount += 1;
  if (win) state.wins += 1;
  state.best = Math.max(state.best, state.score);
  state.metrics.bestRoundScore = Math.max(state.metrics.bestRoundScore, state.score);
  state.metrics.totalOrbs += world.roundOrbs;
  state.metrics.totalDodges += world.roundDodges;
  const credits = Math.floor(state.score / 5) + (win ? 130 : 60);
  const xp = Math.floor(state.score / 7) + (win ? 90 : 45);
  state.credits += credits;
  grantXp(xp);
  updateMissionStats(win);
  if (win && (state.score >= 700 || state.level >= 5)) {
    state.inventory.streetCrates += 1;
  }
  if (win && state.premium && Math.random() < 0.2) {
    state.inventory.premiumCrates += 1;
  }
  maybeShowInterstitial();
  saveState();
  updateHud();
  renderMissions();
  renderProfileCard();
  renderCollection();
  setStatus(win ? `Win! +${credits} credits +${xp} XP` : `Loss. +${credits} credits +${xp} XP`);
  showOverlay("Round Complete", "Instant rematch is ready.");
  submitScore(state.score, win);
}

function maybeShowInterstitial() {
  if (state.premium) return;
  if (state.adCooldownMatches > 0) {
    state.adCooldownMatches -= 1;
    return;
  }
  if (state.matchCount % 3 === 0) {
    setStatus("Interstitial ad shown (simulated). Premium removes ads.");
    state.adCooldownMatches = 2;
  }
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  setStatus(state.paused ? "Paused" : "Resumed");
  if (!state.paused) {
    world.lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function activateBoost() {
  const a = world.abilities.boost;
  if (!state.running || a.cooldown > 0 || a.duration > 0) return;
  a.duration = 3.2;
  a.cooldown = 15;
}

function activateShield() {
  const a = world.abilities.shield;
  if (!state.running || a.cooldown > 0 || a.duration > 0) return;
  a.duration = 2.2;
  a.cooldown = 18;
}

function activateMagnet() {
  const a = world.abilities.magnet;
  if (!state.running || a.cooldown > 0 || a.duration > 0) return;
  a.duration = 4.5;
  a.cooldown = 22;
}

function spawnHazard() {
  const size = randomInt(16, 34);
  world.hazards.push({
    x: randomInt(0, ui.canvas.width - size),
    y: -size,
    width: size,
    height: size,
    speed: 140 + state.level * 16 + randomInt(0, 80),
  });
}

function spawnOrb() {
  const size = 12;
  world.orbs.push({
    x: randomInt(0, ui.canvas.width - size),
    y: -size,
    width: size,
    height: size,
    speed: 160 + state.level * 10,
  });
}

function updateWorld(dt) {
  if (!state.running || state.paused) return;
  world.elapsed += dt;
  world.levelClock += dt;
  world.spawnClock += dt;
  world.orbClock += dt;
  if (world.elapsed >= 1) {
    world.elapsed = 0;
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      endMatch(state.lives > 0);
      return;
    }
  }
  if (world.levelClock >= 5) {
    world.levelClock = 0;
    state.level += 1;
  }
  for (const ability of Object.values(world.abilities)) {
    ability.cooldown = Math.max(0, ability.cooldown - dt);
    ability.duration = Math.max(0, ability.duration - dt);
  }

  const speedMultiplier = world.abilities.boost.duration > 0 ? 1.65 : 1;
  const dir = Number(state.keys.right) - Number(state.keys.left);
  world.player.x += dir * world.player.speed * speedMultiplier * dt;
  world.player.x = Math.max(0, Math.min(ui.canvas.width - world.player.width, world.player.x));

  if (world.spawnClock >= Math.max(0.22, 0.6 - state.level * 0.02)) {
    world.spawnClock = 0;
    spawnHazard();
  }
  if (world.orbClock >= Math.max(0.65, 1.7 - state.level * 0.03)) {
    world.orbClock = 0;
    spawnOrb();
  }

  const playerRect = { ...world.player };
  for (let i = world.hazards.length - 1; i >= 0; i -= 1) {
    const h = world.hazards[i];
    h.y += h.speed * dt;
    if (intersects(h, playerRect)) {
      world.hazards.splice(i, 1);
      if (world.abilities.shield.duration <= 0) {
        state.lives -= 1;
        if (state.lives <= 0) {
          if (state.inventory.reviveToken > 0 && window.confirm("Use Revive Token?")) {
            state.inventory.reviveToken -= 1;
            state.lives = 1;
          } else {
            endMatch(false);
            return;
          }
        }
      }
      continue;
    }
    if (h.y > ui.canvas.height + h.height) {
      world.hazards.splice(i, 1);
      state.score += 2;
      world.roundDodges += 1;
    }
  }

  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const orb = world.orbs[i];
    if (world.abilities.magnet.duration > 0) {
      orb.x += (world.player.x - orb.x) * 1.6 * dt;
    }
    orb.y += orb.speed * dt;
    if (intersects(orb, playerRect)) {
      world.orbs.splice(i, 1);
      state.score += 16;
      world.roundOrbs += 1;
      continue;
    }
    if (orb.y > ui.canvas.height + orb.height) {
      world.orbs.splice(i, 1);
    }
  }
}

function drawWorld() {
  const g = ctx.createLinearGradient(0, 0, 0, ui.canvas.height);
  g.addColorStop(0, "#0d1120");
  g.addColorStop(1, "#05070d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);

  for (const h of world.hazards) {
    ctx.fillStyle = "#ff5a80";
    ctx.beginPath();
    ctx.arc(h.x + h.width / 2, h.y + h.height / 2, h.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const orb of world.orbs) {
    ctx.fillStyle = "#76ff99";
    ctx.beginPath();
    ctx.arc(orb.x + orb.width / 2, orb.y + orb.height / 2, orb.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const skin = skinById(state.inventory.equippedSkin);
  ctx.save();
  ctx.translate(world.player.x + world.player.width / 2, world.player.y + world.player.height / 2);
  ctx.fillStyle = skin.body;
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(-world.player.width / 2, world.player.height / 2);
  ctx.lineTo(0, -world.player.height / 2);
  ctx.lineTo(world.player.width / 2, world.player.height / 2);
  ctx.closePath();
  ctx.fill();
  if (world.abilities.shield.duration > 0) {
    ctx.strokeStyle = "rgba(140,210,255,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, world.player.width * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function loop(now) {
  if (!state.running || state.paused) return;
  const dt = Math.min(0.033, (now - world.lastFrame) / 1000);
  world.lastFrame = now;
  updateWorld(dt);
  drawWorld();
  updateHud();
  if (state.running) requestAnimationFrame(loop);
}

function rollRarity(table) {
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return "common";
}

function openCrate(type) {
  const invKey = type === "premium" ? "premiumCrates" : "streetCrates";
  if (state.inventory[invKey] <= 0) {
    setStatus(`No ${type} crates`);
    return;
  }
  state.inventory[invKey] -= 1;
  const rarity = rollRarity(CRATE_ODDS[type]);
  const pool = SKINS.filter((skin) => skin.rarity === rarity);
  const skin = pool[randomInt(0, pool.length - 1)];
  const owned = state.inventory.ownedSkins[skin.id] || 0;
  state.inventory.ownedSkins[skin.id] = owned + 1;
  if (owned > 0) {
    state.credits += rarityMeta(rarity).salvage;
    ui.dropResult.textContent = `${rarityMeta(rarity).label} duplicate: ${skin.name} • +${rarityMeta(rarity).salvage} credits`;
  } else {
    ui.dropResult.textContent = `${rarityMeta(rarity).label} unlocked: ${skin.name}`;
  }
  state.lastDrop = `${skin.name} (${rarityMeta(rarity).label})`;
  saveState();
  updateHud();
  renderCollection();
  renderProfileCard();
}

function buyCrate(type) {
  if (type === "street") {
    if (state.credits < 420) return setStatus("Need 420 credits");
    state.credits -= 420;
    state.inventory.streetCrates += 1;
  } else {
    if (state.gems < 55) return setStatus("Need 55 gems");
    state.gems -= 55;
    state.inventory.premiumCrates += 1;
  }
  saveState();
  updateHud();
}

function buySkinByRarity(rarity) {
  if (!RARITY_META[rarity]) return;
  const cost = rarityMeta(rarity).buyCost;
  if (state.credits < cost) {
    setStatus(`Need ${cost} credits`);
    return;
  }
  state.credits -= cost;
  const pool = SKINS.filter((skin) => skin.rarity === rarity);
  const unowned = pool.filter((skin) => !state.inventory.ownedSkins[skin.id]);
  const pick = (unowned.length ? unowned : pool)[randomInt(0, (unowned.length ? unowned : pool).length - 1)];
  state.inventory.ownedSkins[pick.id] = (state.inventory.ownedSkins[pick.id] || 0) + 1;
  setStatus(`Bought ${rarityMeta(rarity).label} skin: ${pick.name}`);
  saveState();
  updateHud();
  renderCollection();
}

function buyGemItem(item) {
  if (item === "revive") {
    if (state.gems < 60) return setStatus("Need 60 gems");
    state.gems -= 60;
    state.inventory.reviveToken += 1;
  } else if (item === "boost") {
    if (state.gems < 90) return setStatus("Need 90 gems");
    state.gems -= 90;
    state.inventory.xpBooster += 1;
  } else if (item === "skin") {
    if (state.gems < 140) return setStatus("Need 140 gems");
    state.gems -= 140;
    state.inventory.ownedSkins["neon-empress"] = (state.inventory.ownedSkins["neon-empress"] || 0) + 1;
  }
  saveState();
  updateHud();
  renderCollection();
  renderProfileCard();
}

function buyStarterPack() {
  if (state.firstPurchaseDone) {
    setStatus("Starter pack already purchased.");
    return;
  }
  if (state.gems < 40) {
    setStatus("Need 40 gems for starter pack.");
    return;
  }
  state.gems -= 40;
  state.credits += 1200;
  state.inventory.streetCrates += 3;
  state.inventory.premiumCrates += 1;
  state.firstPurchaseDone = true;
  saveState();
  updateHud();
  setStatus("Starter pack purchased.");
}

function buyPremiumSubscription() {
  if (state.premium) {
    setStatus("Premium already active.");
    return;
  }
  if (state.gems < 299) {
    setStatus("Need 299 gems for premium subscription.");
    return;
  }
  state.gems -= 299;
  state.premium = true;
  state.premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  saveState();
  updateHud();
  renderProfileCard();
  setStatus("Premium activated: no ads + double XP + premium perks.");
}

function buyEventPass() {
  if (state.eventPassPremium) return setStatus("Event pass already unlocked.");
  if (state.gems < 180) return setStatus("Need 180 gems for event pass.");
  state.gems -= 180;
  state.eventPassPremium = true;
  saveState();
  updateHud();
  renderProfileCard();
  setStatus("Premium event track unlocked.");
}

function watchRewardAd() {
  if (state.premium) {
    setStatus("Premium users do not need rewarded ads.");
    return;
  }
  state.matchBoosts.xpMultiplier = 2;
  setStatus("Rewarded ad watched (simulated): next match XP x2.");
}

function shareScore() {
  const text = encodeURIComponent(`I scored ${state.best} in Nova Blitz Arena. Beat my score: ${location.href}?challenge=${state.best}`);
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${text}`);
  } else {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${text}`, "_blank", "noopener,noreferrer");
  }
}

function challengeFriend() {
  const rival = ["NovaWolf", "PixelRider", "SkyHex"][randomInt(0, 2)];
  const text = `Challenge sent to ${rival}: beat ${state.best}`;
  setStatus(text);
}

function inviteReward() {
  const today = dayKey();
  if (state.lastInviteClaimAt === today) return setStatus("Invite reward already claimed today.");
  state.lastInviteClaimAt = today;
  state.credits += 320;
  state.gems += 10;
  saveState();
  updateHud();
  setStatus("Invite reward claimed: +320 credits, +10 gems");
}

function joinTournament() {
  const open = TOURNAMENTS[0];
  const premiumCup = TOURNAMENTS[1];
  const tournament = state.premium ? premiumCup : open;
  if (tournament.premiumOnly && !state.premium) {
    setStatus("Premium tournament requires premium subscription.");
    return;
  }
  if (tournament.entryFeeCredits > 0 && state.credits < tournament.entryFeeCredits) {
    setStatus(`Need ${tournament.entryFeeCredits} credits to join.`);
    return;
  }
  if (tournament.entryFeeCredits > 0) state.credits -= tournament.entryFeeCredits;
  saveState();
  updateHud();
  setStatus(`Joined ${tournament.name}`);
  postJSON("/tournament/join", { userId: state.userId, tournamentId: tournament.id, paidEntry: tournament.entryFeeCredits > 0 });
}

function renderRotatingShop() {
  ui.rotatingShop.innerHTML = "";
  const day = new Date().getDate();
  const entries = [SKINS[day % SKINS.length], SKINS[(day + 2) % SKINS.length], SKINS[(day + 5) % SKINS.length]];
  for (const skin of entries) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shop-btn";
    const cost = Math.floor(rarityMeta(skin.rarity).buyCost * 0.75);
    btn.textContent = `Daily: ${skin.name} (${cost} credits)`;
    btn.addEventListener("click", () => {
      if (state.credits < cost) return setStatus(`Need ${cost} credits`);
      state.credits -= cost;
      state.inventory.ownedSkins[skin.id] = (state.inventory.ownedSkins[skin.id] || 0) + 1;
      saveState();
      updateHud();
      renderCollection();
      setStatus(`Bought daily item: ${skin.name}`);
    });
    ui.rotatingShop.appendChild(btn);
  }
}

function renderLeaderboard() {
  const local = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-local-leaderboard`) || "[]");
  ui.leaderboardList.innerHTML = "";
  if (local.length === 0) {
    ui.leaderboardList.textContent = "No scores yet.";
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "mission-list";
  for (const row of local.slice(0, 10)) {
    const li = document.createElement("li");
    li.className = "mission-item";
    li.textContent = `${row.user} • ${row.score}`;
    ul.appendChild(li);
  }
  ui.leaderboardList.appendChild(ul);
}

function updateLocalLeaderboard() {
  const key = `${STORAGE_KEY}-local-leaderboard`;
  const rows = JSON.parse(localStorage.getItem(key) || "[]");
  rows.push({ user: state.userId, score: state.best });
  rows.sort((a, b) => b.score - a.score);
  localStorage.setItem(key, JSON.stringify(rows.slice(0, 50)));
  renderLeaderboard();
}

function bindInputs() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") state.keys.left = true;
    if (key === "d" || key === "arrowright") state.keys.right = true;
    if (key === "e") activateBoost();
    if (key === "q") activateShield();
    if (key === " ") {
      event.preventDefault();
      togglePause();
    }
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") state.keys.left = false;
    if (key === "d" || key === "arrowright") state.keys.right = false;
  });
  ui.canvas.addEventListener("pointerdown", (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    state.keys.left = x < rect.width * 0.45;
    state.keys.right = x > rect.width * 0.55;
    ui.canvas.setPointerCapture(event.pointerId);
  });
  const clear = () => {
    state.keys.left = false;
    state.keys.right = false;
  };
  ui.canvas.addEventListener("pointerup", clear);
  ui.canvas.addEventListener("pointercancel", clear);
  ui.canvas.addEventListener("pointerleave", clear);
}

function bindUI() {
  document.getElementById("startButton").addEventListener("click", startMatch);
  document.getElementById("pauseButton").addEventListener("click", togglePause);
  document.getElementById("rematchButton").addEventListener("click", () => {
    if (!state.running) startMatch();
  });
  document.getElementById("abilityBoostButton").addEventListener("click", activateBoost);
  document.getElementById("abilityShieldButton").addEventListener("click", activateShield);
  document.getElementById("abilityMagnetButton").addEventListener("click", activateMagnet);
  document.getElementById("dailyClaimBtn").addEventListener("click", claimDaily);

  document.getElementById("upgradeEngineBtn").addEventListener("click", () => upgrade("engine"));
  document.getElementById("upgradeArmorBtn").addEventListener("click", () => upgrade("armor"));
  document.getElementById("upgradeMagnetBtn").addEventListener("click", () => upgrade("magnet"));
  document.getElementById("buyStreetCrateBtn").addEventListener("click", () => buyCrate("street"));
  document.getElementById("buyPremiumCrateBtn").addEventListener("click", () => buyCrate("premium"));
  document.getElementById("buyStarterPackBtn").addEventListener("click", buyStarterPack);
  document.getElementById("openStreetCrateBtn").addEventListener("click", () => openCrate("street"));
  document.getElementById("openPremiumCrateBtn").addEventListener("click", () => openCrate("premium"));
  document.getElementById("buyEventPassBtn").addEventListener("click", buyEventPass);
  document.getElementById("buyPremiumSubBtn").addEventListener("click", buyPremiumSubscription);

  document.getElementById("shareScoreBtn").addEventListener("click", shareScore);
  document.getElementById("challengeFriendBtn").addEventListener("click", challengeFriend);
  document.getElementById("inviteRewardBtn").addEventListener("click", inviteReward);
  document.getElementById("joinTournamentBtn").addEventListener("click", joinTournament);

  document.getElementById("watchRewardAdBtn").addEventListener("click", watchRewardAd);
  document.getElementById("buyReviveBtn").addEventListener("click", () => buyGemItem("revive"));
  document.getElementById("buyBoosterBtn").addEventListener("click", () => buyGemItem("boost"));
  document.getElementById("buySkinBtn").addEventListener("click", () => buyGemItem("skin"));

  document.querySelectorAll("[data-buy-rarity]").forEach((button) => {
    button.addEventListener("click", () => buySkinByRarity(button.dataset.buyRarity));
  });
}

function upgrade(type) {
  const level = state.inventory[`${type}Level`] || 0;
  const cost = 90 + level * 120;
  if (state.credits < cost) return setStatus(`Need ${cost} credits`);
  state.credits -= cost;
  state.inventory[`${type}Level`] = level + 1;
  saveState();
  updateHud();
  setStatus(`${type} upgraded to ${state.inventory[`${type}Level`]}`);
}

async function postJSON(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchJSON(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function submitScore(score, win) {
  updateLocalLeaderboard();
  await postJSON("/score/submit", {
    userId: state.userId,
    score,
    roundDurationSec: state.roundSeconds,
    level: state.level,
    won: win,
  });
  await postJSON("/analytics/track", {
    userId: state.userId,
    eventType: "round_complete",
    payload: { score, win, premium: state.premium },
  });
}

async function loadRemoteLeaderboard() {
  const data = await fetchJSON("/leaderboard/global?limit=20");
  if (!data?.rows?.length) return;
  ui.leaderboardList.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "mission-list";
  data.rows.forEach((row, idx) => {
    const li = document.createElement("li");
    li.className = "mission-item";
    li.textContent = `#${idx + 1} ${row.userId || row.user_id} • ${row.score || row.best_score}`;
    ul.appendChild(li);
  });
  ui.leaderboardList.appendChild(ul);
}

function paypalConfigured() {
  return PAYPAL_CONFIG.clientId && !PAYPAL_CONFIG.clientId.includes("REPLACE_WITH");
}

function loadPayPalSdk() {
  return new Promise((resolve, reject) => {
    if (window.paypal) return resolve();
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CONFIG.clientId)}&currency=${encodeURIComponent(PAYPAL_CONFIG.currency)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed"));
    document.head.appendChild(script);
  });
}

function renderPayPalPack(pack, id) {
  const target = document.getElementById(id);
  if (!target || !window.paypal) return;
  target.innerHTML = "";
  window.paypal
    .Buttons({
      style: { layout: "horizontal", shape: "pill", color: "gold", label: "paypal", height: 38 },
      createOrder(_data, actions) {
        return actions.order.create({
          purchase_units: [{ amount: { currency_code: PAYPAL_CONFIG.currency, value: pack.price }, description: `Nova Blitz ${pack.label}` }],
        });
      },
      onApprove(_data, actions) {
        return actions.order.capture().then(() => {
          state.gems += pack.gems;
          saveState();
          updateHud();
          setStatus(`PayPal success: +${pack.gems} gems`);
        });
      },
      onError() {
        setStatus("PayPal payment error.");
      },
    })
    .render(`#${id}`);
}

async function initPayPal() {
  if (!paypalConfigured()) {
    ui.paypalStatus.textContent = "Set PAYPAL_CONFIG.clientId to enable checkout.";
    return;
  }
  try {
    await loadPayPalSdk();
    renderPayPalPack(PAYPAL_CONFIG.packs.starter, "paypal-pack-starter");
    renderPayPalPack(PAYPAL_CONFIG.packs.racer, "paypal-pack-racer");
    renderPayPalPack(PAYPAL_CONFIG.packs.legend, "paypal-pack-legend");
    ui.paypalStatus.textContent = "PayPal checkout ready.";
  } catch {
    ui.paypalStatus.textContent = "PayPal SDK failed to initialize.";
  }
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  const delay = next.getTime() - now.getTime();
  setTimeout(() => {
    rotateMissionsIfNeeded();
    renderMissions();
    scheduleMidnightRefresh();
  }, Math.max(1000, delay));
}

function init() {
  loadState();
  rotateMissionsIfNeeded();
  bindUI();
  bindInputs();
  renderMissions();
  renderRotatingShop();
  renderCollection();
  renderProfileCard();
  renderLeaderboard();
  updateHud();
  showOverlay("20-second rounds", "Start match for instant results and fast rematch.");
  setStatus("Ready to queue");
  scheduleMidnightRefresh();
  initPayPal();
  loadRemoteLeaderboard();
  postJSON("/auth/session", { userId: state.userId, username: state.userId, fingerprint: navigator.userAgent.slice(0, 120) });
}

init();
