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
const streetCratesValue = document.getElementById("streetCratesValue");
const premiumCratesValue = document.getElementById("premiumCratesValue");
const vaultValue = document.getElementById("vaultValue");
const dropResult = document.getElementById("dropResult");
const collectionList = document.getElementById("collectionList");

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

const openStreetCrateBtn = document.getElementById("openStreetCrateBtn");
const openPremiumCrateBtn = document.getElementById("openPremiumCrateBtn");
const buyStreetCrateBtn = document.getElementById("buyStreetCrateBtn");
const buyPremiumCrateBtn = document.getElementById("buyPremiumCrateBtn");
const rarityBuyButtons = Array.from(document.querySelectorAll("[data-buy-rarity]"));

const buyReviveBtn = document.getElementById("buyReviveBtn");
const buySkinBtn = document.getElementById("buySkinBtn");
const buyBoosterBtn = document.getElementById("buyBoosterBtn");
const paypalStatus = document.getElementById("paypalStatus");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const STORAGE_KEY = "neon-drift-economy-save";

const RARITY = {
  common: { name: "Common", color: "#22c55e", salvage: 24, buyCost: 170, order: 0 },
  rare: { name: "Rare", color: "#3b82f6", salvage: 75, buyCost: 420, order: 1 },
  epic: { name: "Epic", color: "#9333ea", salvage: 240, buyCost: 1200, order: 2 },
  legendary: { name: "Legendary", color: "#fbbf24", salvage: 880, buyCost: 4200, order: 3 },
  mythic: { name: "Mythic", color: "#14b8a6", salvage: 2800, buyCost: 16000, order: 4 },
  godly: { name: "Godly", color: "#111111", salvage: 14000, buyCost: 95000, order: 5 },
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
  { id: "metro-green", name: "Metro Green", rarity: "common", body: "#8fffbe", glow: "#32c175" },
  { id: "deep-sonar", name: "Deep Sonar", rarity: "rare", body: "#8eb7ff", glow: "#3877ef" },
  { id: "blue-lattice", name: "Blue Lattice", rarity: "rare", body: "#7ba8ff", glow: "#2f66db" },
  { id: "arc-racer", name: "Arc Racer", rarity: "rare", body: "#95bcff", glow: "#4d80e3" },
  { id: "violet-vortex", name: "Violet Vortex", rarity: "epic", body: "#cc86ff", glow: "#8e34e6" },
  { id: "purple-static", name: "Purple Static", rarity: "epic", body: "#c274ff", glow: "#822ed6" },
  { id: "night-wisp", name: "Night Wisp", rarity: "epic", body: "#d294ff", glow: "#9741e9" },
  { id: "golden-shard", name: "Golden Shard", rarity: "legendary", body: "#ffdf92", glow: "#efaf34" },
  { id: "crown-arc", name: "Crown Arc", rarity: "legendary", body: "#ffd66f", glow: "#dd9928" },
  { id: "tidal-phantom", name: "Tidal Phantom", rarity: "mythic", body: "#84fff7", glow: "#20b6b0" },
  { id: "neon-empress", name: "Neon Empress", rarity: "mythic", body: "#6ff2e8", glow: "#22a89f" },
  { id: "void-emperor", name: "Void Emperor", rarity: "godly", body: "#2a2c30", glow: "#07080a" },
  { id: "black-halo", name: "Black Halo", rarity: "godly", body: "#232529", glow: "#030304" },
];

const missions = [
  { id: "score-500", title: "Score 500 in one run", target: 500, type: "runScore", rewardCredits: 140, rewardXp: 45 },
  { id: "collect-40-orbs", title: "Collect 40 orbs total", target: 40, type: "totalOrbs", rewardCredits: 120, rewardXp: 35 },
  { id: "dodge-180", title: "Dodge 180 meteors total", target: 180, type: "totalDodges", rewardCredits: 160, rewardXp: 50 },
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

const defaultSave = {
  best: 0,
  credits: 260,
  gems: 0,
  xp: 0,
  rank: 1,
  upgrades: { engine: 1, armor: 0, magnet: 0 },
  inventory: { reviveToken: 0, xpBooster: 0, streetCrates: 2, premiumCrates: 0 },
  cosmetics: { equipped: "pulse-runner", owned: { "pulse-runner": 1 }, lastDrop: "" },
  missionProgress: {},
};

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

function getRarityMeta(rarity) {
  return RARITY[rarity] || RARITY.common;
}

function getSkinById(id) {
  return SKINS.find((skin) => skin.id === id) || SKINS[0];
}

function getSkinsByRarity(rarity) {
  return SKINS.filter((skin) => skin.rarity === rarity);
}

function ensureSaveShape() {
  state.save = {
    ...defaultSave,
    ...state.save,
    upgrades: { ...defaultSave.upgrades, ...(state.save.upgrades || {}) },
    inventory: { ...defaultSave.inventory, ...(state.save.inventory || {}) },
    missionProgress: { ...(state.save.missionProgress || {}) },
    cosmetics: { ...defaultSave.cosmetics, ...(state.save.cosmetics || {}) },
  };
  state.save.cosmetics.owned = { ...(state.save.cosmetics.owned || {}) };
  if (!state.save.cosmetics.owned["pulse-runner"]) {
    state.save.cosmetics.owned["pulse-runner"] = 1;
  }
  if (!SKINS.some((skin) => skin.id === state.save.cosmetics.equipped)) {
    state.save.cosmetics.equipped = "pulse-runner";
  }
}

function loadSave() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  state.save = parsed && typeof parsed === "object" ? parsed : structuredClone(defaultSave);
  ensureSaveShape();
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
    if (state.save.rank % 4 === 0) {
      state.save.inventory.premiumCrates += 1;
      setStatus(`Rank ${state.save.rank}! +50 credits and +1 premium crate.`);
    } else {
      setStatus(`Rank up! Reached Rank ${state.save.rank}.`);
    }
  }
}

function getEquippedSkin() {
  return getSkinById(state.save.cosmetics.equipped);
}

function vaultCreditValue() {
  return SKINS.reduce((sum, skin) => {
    const count = state.save.cosmetics.owned[skin.id] || 0;
    const meta = getRarityMeta(skin.rarity);
    return sum + count * meta.buyCost;
  }, 0);
}

function rarityTextColor(rarity) {
  return rarity === "godly" ? "#f3f6ff" : "#0b1020";
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
  streetCratesValue.textContent = String(state.save.inventory.streetCrates);
  premiumCratesValue.textContent = String(state.save.inventory.premiumCrates);
  vaultValue.textContent = String(vaultCreditValue());
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
  if (mission.type === "runScore") return state.score;
  if (mission.type === "totalOrbs") return state.save.missionProgress.totalOrbs || 0;
  if (mission.type === "totalDodges") return state.save.missionProgress.totalDodges || 0;
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
      if (claimBtn.disabled) return;
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

function rollFromWeights(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return "common";
}

function renderCollection() {
  collectionList.innerHTML = "";
  const sorted = [...SKINS].sort((a, b) => getRarityMeta(a.rarity).order - getRarityMeta(b.rarity).order);

  for (const skin of sorted) {
    const rarity = getRarityMeta(skin.rarity);
    const ownedCount = state.save.cosmetics.owned[skin.id] || 0;

    const li = document.createElement("li");
    li.className = "collection-item";
    li.style.borderColor = rarity.color;

    const left = document.createElement("div");
    left.className = "collection-left";

    const swatch = document.createElement("span");
    swatch.className = "collection-swatch";
    swatch.style.background = `linear-gradient(135deg, ${skin.body}, ${skin.glow})`;

    const text = document.createElement("div");
    text.className = "collection-text";

    const name = document.createElement("strong");
    name.textContent = skin.name;

    const meta = document.createElement("span");
    meta.className = "collection-meta";
    meta.style.color = rarity.color;
    meta.textContent = `${rarity.name} • Owned: ${ownedCount}`;

    text.append(name, meta);
    left.append(swatch, text);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "button small-button";
    action.textContent = state.save.cosmetics.equipped === skin.id ? "Equipped" : "Equip";
    action.disabled = ownedCount <= 0 || state.save.cosmetics.equipped === skin.id;
    action.addEventListener("click", () => {
      state.save.cosmetics.equipped = skin.id;
      persistSave();
      renderCollection();
      setStatus(`Equipped ${skin.name}`);
    });

    li.append(left, action);
    collectionList.appendChild(li);
  }
}

function setDropResult(skin, duplicated, salvageAmount) {
  const rarity = getRarityMeta(skin.rarity);
  dropResult.className = `drop-result rarity-${skin.rarity}`;
  dropResult.style.color = skin.rarity === "godly" ? "#f3f6ff" : rarity.color;
  if (duplicated) {
    dropResult.textContent = `${rarity.name} ${skin.name} (Duplicate) • +${salvageAmount} credits salvage`;
  } else {
    dropResult.textContent = `${rarity.name} ${skin.name} unlocked`;
  }
}

function grantSkinDrop(rarityKey) {
  const pool = getSkinsByRarity(rarityKey);
  const skin = pool[Math.floor(Math.random() * pool.length)];
  const rarity = getRarityMeta(skin.rarity);
  const owned = state.save.cosmetics.owned[skin.id] || 0;
  const duplicated = owned > 0;

  state.save.cosmetics.owned[skin.id] = owned + 1;
  state.save.cosmetics.lastDrop = `${skin.name} (${rarity.name})`;

  if (duplicated) {
    state.save.credits += rarity.salvage;
    setStatus(`Duplicate ${skin.name}. Salvaged for +${rarity.salvage} credits.`);
    setDropResult(skin, true, rarity.salvage);
  } else {
    setStatus(`Unlocked ${skin.name} (${rarity.name}).`);
    setDropResult(skin, false, 0);
  }
}

function openCrate(type) {
  const key = type === "premium" ? "premiumCrates" : "streetCrates";
  if (state.save.inventory[key] <= 0) {
    setStatus(`No ${type} crates available`);
    return;
  }

  state.save.inventory[key] -= 1;
  const rolledRarity = rollFromWeights(CRATE_ODDS[type]);
  grantSkinDrop(rolledRarity);
  persistSave();
  updateHud();
  renderCollection();
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

function buyByRarity(rarityKey) {
  const rarity = getRarityMeta(rarityKey);
  if (!spendCredits(rarity.buyCost)) return;

  const pool = getSkinsByRarity(rarityKey);
  const unowned = pool.filter((skin) => !state.save.cosmetics.owned[skin.id]);
  const pickFrom = unowned.length > 0 ? unowned : pool;
  const skin = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  state.save.cosmetics.owned[skin.id] = (state.save.cosmetics.owned[skin.id] || 0) + 1;
  persistSave();
  updateHud();
  renderCollection();
  setStatus(`Bought ${rarity.name} skin: ${skin.name}`);
}

function buyUpgrade(type) {
  const level = state.save.upgrades[type];
  const cost = 90 + level * 110;
  if (!spendCredits(cost)) return;
  state.save.upgrades[type] += 1;
  persistSave();
  updateHud();
  setStatus(`${type} upgraded to level ${state.save.upgrades[type]}`);
}

function buyGemItem(item) {
  if (item === "revive") {
    if (!spendGems(60)) return;
    state.save.inventory.reviveToken += 1;
    setStatus("Bought Revive Token");
  } else if (item === "skin") {
    if (!spendGems(140)) return;
    const neon = SKINS.find((skin) => skin.id === "neon-empress");
    state.save.cosmetics.owned[neon.id] = (state.save.cosmetics.owned[neon.id] || 0) + 1;
    setStatus("Bought Neon Empress skin");
  } else if (item === "boost") {
    if (!spendGems(90)) return;
    state.save.inventory.xpBooster += 1;
    setStatus("Bought XP Booster");
  }
  persistSave();
  updateHud();
  renderCollection();
}

function buyStreetCrate() {
  const cost = 420;
  if (!spendCredits(cost)) return;
  state.save.inventory.streetCrates += 1;
  persistSave();
  updateHud();
  setStatus("Bought 1 Street Crate");
}

function buyPremiumCrate() {
  const cost = 55;
  if (!spendGems(cost)) return;
  state.save.inventory.premiumCrates += 1;
  persistSave();
  updateHud();
  setStatus("Bought 1 Premium Crate");
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
  abilityBoostButton.disabled = false;
  abilityShieldButton.disabled = false;
  abilityMagnetButton.disabled = false;
  pauseButton.textContent = "Pause";
  hideOverlay();
  setStatus("Run started");
  requestAnimationFrame(loop);
}

function finishRun() {
  state.running = false;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";
  abilityBoostButton.disabled = true;
  abilityShieldButton.disabled = true;
  abilityMagnetButton.disabled = true;

  if (state.score > state.save.best) state.save.best = state.score;

  const creditsEarned = Math.floor(state.score / 12) + state.level * 4;
  const xpEarned = Math.floor(state.score / 18) + state.level * 3;
  state.save.credits += creditsEarned;
  grantXp(xpEarned);
  updateMissionProgressCounters();

  if (state.level >= 5 || state.score >= 900) {
    state.save.inventory.streetCrates += 1;
    setStatus(`Run reward: +1 Street Crate, +${creditsEarned} credits, +${xpEarned} XP`);
  } else {
    setStatus(`Run ended: +${creditsEarned} credits, +${xpEarned} XP`);
  }

  if (state.level >= 10 && Math.random() < 0.18) {
    state.save.inventory.premiumCrates += 1;
    setStatus("Bonus reward: +1 Premium Crate");
  }

  persistSave();
  updateHud();
  renderMissions();
  renderCollection();
  showOverlay("Run complete", `Score ${state.score}. Keep running to earn crates and rare skins.`);
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
  if (!state.running) return;
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
  if (!state.running || abilities.boost.cooldown > 0 || abilities.boost.duration > 0) return;
  abilities.boost.duration = 3.2 + state.save.upgrades.engine * 0.3;
  abilities.boost.cooldown = 17 - Math.min(4, state.save.upgrades.engine);
  setStatus("Boost activated");
  updateAbilityButtons();
}

function activateShield() {
  if (!state.running || abilities.shield.cooldown > 0 || abilities.shield.duration > 0) return;
  abilities.shield.duration = 2.2 + state.save.upgrades.armor * 0.4;
  abilities.shield.cooldown = 21 - Math.min(6, state.save.upgrades.armor * 2);
  setStatus("Shield activated");
  updateAbilityButtons();
}

function activateMagnet() {
  if (!state.running || abilities.magnet.cooldown > 0 || abilities.magnet.duration > 0) return;
  abilities.magnet.duration = 4.5 + state.save.upgrades.magnet * 0.35;
  abilities.magnet.cooldown = 24 - Math.min(5, state.save.upgrades.magnet * 1.5);
  setStatus("Magnet activated");
  updateAbilityButtons();
}

function updateAbilityButtons() {
  abilityBoostButton.textContent =
    abilities.boost.duration > 0
      ? `Boost ${abilities.boost.duration.toFixed(1)}s`
      : abilities.boost.cooldown > 0
      ? `Boost ${abilities.boost.cooldown.toFixed(0)}s`
      : "Boost (E)";
  abilityShieldButton.textContent =
    abilities.shield.duration > 0
      ? `Shield ${abilities.shield.duration.toFixed(1)}s`
      : abilities.shield.cooldown > 0
      ? `Shield ${abilities.shield.cooldown.toFixed(0)}s`
      : "Shield (Q)";
  abilityMagnetButton.textContent =
    abilities.magnet.duration > 0
      ? `Magnet ${abilities.magnet.duration.toFixed(1)}s`
      : abilities.magnet.cooldown > 0
      ? `Magnet ${abilities.magnet.cooldown.toFixed(0)}s`
      : "Magnet";
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
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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
      if (!state.running) return;
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
  const skin = getEquippedSkin();
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
  if (!state.running || state.paused) return;
  const dt = Math.min(0.033, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  update(dt);
  draw();
  if (state.running) requestAnimationFrame(loop);
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
  if (!container || !window.paypal) return;
  container.innerHTML = "";
  window.paypal
    .Buttons({
      style: { layout: "horizontal", color: "gold", shape: "pill", label: "paypal", height: 38 },
      createOrder(_data, actions) {
        return actions.order.create({
          purchase_units: [
            {
              amount: { currency_code: PAYPAL_CONFIG.currency, value: pack.price },
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
    })
    .render(`#${selectorId}`);
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
  if (key === "a" || key === "arrowleft") state.keys.left = true;
  if (key === "d" || key === "arrowright") state.keys.right = true;
  if (key === "e") activateBoost();
  if (key === "q") activateShield();
  if (key === " " && state.running) {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a" || key === "arrowleft") state.keys.left = false;
  if (key === "d" || key === "arrowright") state.keys.right = false;
});

canvas.addEventListener("pointerdown", (event) => {
  setTouchControl(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pressure > 0) setTouchControl(event);
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

openStreetCrateBtn.addEventListener("click", () => openCrate("street"));
openPremiumCrateBtn.addEventListener("click", () => openCrate("premium"));
buyStreetCrateBtn.addEventListener("click", buyStreetCrate);
buyPremiumCrateBtn.addEventListener("click", buyPremiumCrate);

rarityBuyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const rarity = button.dataset.buyRarity;
    if (rarity && RARITY[rarity]) {
      buyByRarity(rarity);
    }
  });
});

buyReviveBtn.addEventListener("click", () => buyGemItem("revive"));
buySkinBtn.addEventListener("click", () => buyGemItem("skin"));
buyBoosterBtn.addEventListener("click", () => buyGemItem("boost"));

loadSave();
updateHud();
renderMissions();
renderCollection();
updateAbilityButtons();
draw();
if (state.save.cosmetics.lastDrop) {
  dropResult.textContent = `Last drop: ${state.save.cosmetics.lastDrop}`;
}
setStatus("Ready to start");
showOverlay(
  "Thread the neon lanes.",
  "Move with A / D or arrow keys. On touch, drag left/right. Earn crates, unbox skins, and grow your collection."
);
setupPayPalButtons();
