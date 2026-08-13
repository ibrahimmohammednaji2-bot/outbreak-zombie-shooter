import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  SKINS,
  RARITIES,
  rarityOf,
  skinById,
  wallet,
  owns,
  buy,
  equip,
  earnCoins,
  saveWallet,
  redeemCode,
  setCodeActive,
  reloadWallet,
  resetWallet,
  keepCurrentProgress,
  COINS_PER_WAVE,
} from "./skins.js";
import { bank, saveBank } from "./bank.js";
import {
  account,
  signedIn,
  signIn,
  signOut,
  profiles,
  profileExists,
} from "./account.js";
import {
  party,
  createParty,
  joinParty,
  leaveParty,
  kickMember,
  refreshParty,
} from "./party.js";
import {
  PERKS,
  LETHALS,
  TACTICALS,
  ATTACHMENTS,
  WILDCARDS,
  MAX_POINTS,
  loadClasses,
  saveClasses,
  pointsUsed,
  attachmentLimit,
} from "./mp.js";
import {
  shop,
  saveShop,
  TOKEN_PACKS,
  DAILY_COINS,
  MAX_REVIVES,
  offerOfTheDay,
  freebieReady,
  claimFreebie,
  hasToken,
  spendToken,
  grantUnlimited,
  priceOf,
  buyPack,
} from "./shop.js";
import "./style.css";

/* ════════════════════════════════════════════════════════════════
   ZOMBIE ATTACK — a playable prototype
   Single player, wave survival. Multiplayer and the weapon store are
   deliberately absent: this build exists to answer one question —
   is shooting these zombies fun on its own?
   ════════════════════════════════════════════════════════════════ */

let HALF = 31; // arena half-width — set by the chosen map

// Speeds are defined against each other on purpose: you out-walk a walker by
// a hair, and out-run a runner by a hair. Both margins are razor thin.
const WALKER_SPEED = 1.75;
const RUN_SPEED = 7.6;
const WALK_SPEED = WALKER_SPEED + 0.25; // 2.0 — barely faster than a shambler
const CROUCH_SPEED = 1; // sitting low: steady aim, no escape
const CROUCH_EYE = 0.95;
const DOUBLE_TAP = 0.32; // seconds between W presses that counts as a run
const EYE = 1.7;
const PLAYER_R = 0.42;
const GRAVITY = 22;

// ── points ───────────────────────────────────────────────────────
const PTS_HIT = 10; // per shot that lands on a zombie
const PTS_KILL = 60; // on top, when it drops
const PTS_KNIFE_KILL = 130; // knifing one is worth far more
const BOX_COST = 950;

// ── weapons ──────────────────────────────────────────────────────
// You start with two pistols and a knife. Everything else comes out of
// the mystery box upstairs.
const WEAPONS = [
  {
    id: "pistol",
    name: "Pistol",
    damage: 34,
    headMult: 3,
    rpm: 0.26,
    mag: 12,
    reserve: 90,
    pellets: 1,
    spread: 0.008,
    auto: false,
    reload: 1.1,
    recoil: 0.055,
    pickup: 6,
    volume: 0.5,
    tone: 780,
  },
  {
    // Damage is worked out at the moment it lands: always exactly enough
    // that wave N takes N hits.
    id: "knife",
    name: "Knife",
    melee: true,
    range: 2.6,
    headMult: 1,
    rpm: 0.42,
    mag: 0,
    reserve: 0,
    pellets: 1,
    spread: 0,
    auto: true,
    reload: 0,
    recoil: 0.07,
    pickup: 0,
    volume: 0.3,
    tone: 240,
  },
  // ── submachine guns ──
  {
    id: "mp5",
    name: "MP5",
    damage: 25,
    headMult: 2.5,
    rpm: 0.075,
    mag: 30,
    reserve: 210,
    pellets: 1,
    spread: 0.018,
    auto: true,
    reload: 1.5,
    recoil: 0.028,
    pickup: 16,
    volume: 0.42,
    tone: 640,
  },
  {
    id: "vector",
    name: "Vector",
    damage: 18,
    headMult: 2.5,
    rpm: 0.049,
    mag: 25,
    reserve: 225,
    pellets: 1,
    spread: 0.022,
    auto: true,
    reload: 1.4,
    recoil: 0.019,
    pickup: 20,
    volume: 0.38,
    tone: 700,
  },
  {
    id: "uzi",
    name: "Uzi",
    damage: 20,
    headMult: 2.5,
    rpm: 0.058,
    mag: 32,
    reserve: 224,
    pellets: 1,
    spread: 0.027,
    auto: true,
    reload: 1.6,
    recoil: 0.024,
    pickup: 18,
    volume: 0.4,
    tone: 610,
  },

  // ── assault rifles ──
  {
    id: "ak47",
    name: "AK-47",
    damage: 38,
    headMult: 3,
    rpm: 0.1,
    mag: 30,
    reserve: 210,
    pellets: 1,
    spread: 0.017,
    auto: true,
    reload: 1.9,
    recoil: 0.05,
    pickup: 14,
    volume: 0.55,
    tone: 480,
  },
  {
    id: "m4",
    name: "M4",
    damage: 31,
    headMult: 3,
    rpm: 0.084,
    mag: 30,
    reserve: 210,
    pellets: 1,
    spread: 0.013,
    auto: true,
    reload: 1.7,
    recoil: 0.033,
    pickup: 15,
    volume: 0.5,
    tone: 560,
  },
  {
    id: "scar",
    name: "SCAR-H",
    damage: 48,
    headMult: 3,
    rpm: 0.13,
    mag: 20,
    reserve: 160,
    pellets: 1,
    spread: 0.012,
    auto: true,
    reload: 2,
    recoil: 0.062,
    pickup: 11,
    volume: 0.6,
    tone: 440,
  },

  // ── shotguns ──
  {
    id: "shotgun",
    name: "Shotgun",
    damage: 19,
    headMult: 2,
    rpm: 0.78,
    mag: 6,
    reserve: 42,
    pellets: 9,
    spread: 0.075,
    auto: false,
    reload: 2.2,
    recoil: 0.13,
    pickup: 4,
    volume: 0.75,
    tone: 300,
  },
  {
    // Two barrels, both of them at once, and then a long wait. Off the wall
    // for 500 — cheap, brutal up close, useless past a room's length.
    id: "dbarrel",
    name: "Double Barrel",
    damage: 27,
    headMult: 2,
    rpm: 0.55,
    mag: 2,
    reserve: 28,
    pellets: 12,
    spread: 0.105,
    auto: false,
    reload: 2.4,
    recoil: 0.22,
    pickup: 4,
    volume: 0.9,
    tone: 240,
  },
  {
    // Built, not bought. A wall of moving air that shreds whatever is close
    // and nothing that is not, and it has to be let go of before it cooks.
    id: "jetgun",
    name: "Jet Gun",
    damage: 260,
    headMult: 1,
    rpm: 0.06,
    mag: 90, // seconds of running, near enough
    reserve: 900,
    pellets: 3,
    spread: 0.16,
    auto: true,
    reload: 4.5, // cooling down, not reloading
    recoil: 0.02,
    pickup: 0,
    volume: 0.85,
    tone: 140,
    built: true,
  },
  {
    id: "auto12",
    name: "Auto Shotgun",
    damage: 14,
    headMult: 2,
    rpm: 0.29,
    mag: 8,
    reserve: 48,
    pellets: 8,
    spread: 0.086,
    auto: true,
    reload: 2.6,
    recoil: 0.1,
    pickup: 4,
    volume: 0.7,
    tone: 330,
  },

  // ── precision ──
  {
    id: "magnum",
    name: "Magnum",
    damage: 90,
    headMult: 2.6,
    rpm: 0.5,
    mag: 6,
    reserve: 42,
    pellets: 1,
    spread: 0.01,
    auto: false,
    reload: 2.2,
    recoil: 0.16,
    pickup: 4,
    volume: 0.78,
    tone: 420,
  },
  {
    id: "sniper",
    name: "Sniper",
    damage: 190,
    headMult: 3,
    rpm: 1.2,
    mag: 5,
    reserve: 35,
    pellets: 1,
    spread: 0.002,
    auto: false,
    reload: 2.6,
    recoil: 0.22,
    pickup: 3,
    volume: 0.85,
    tone: 260,
  },

  // ── light machine guns ──
  {
    id: "rpd",
    name: "RPD",
    damage: 33,
    headMult: 2.5,
    rpm: 0.088,
    mag: 100,
    reserve: 300,
    pellets: 1,
    spread: 0.029,
    auto: true,
    reload: 4.2,
    recoil: 0.042,
    pickup: 24,
    volume: 0.62,
    tone: 400,
  },
  {
    id: "dingo",
    name: "Dingo",
    damage: 36,
    headMult: 2.5,
    rpm: 0.105,
    mag: 75,
    reserve: 300,
    pellets: 1,
    spread: 0.023,
    auto: true,
    reload: 3.8,
    recoil: 0.046,
    pickup: 22,
    volume: 0.6,
    tone: 430,
  },
  {
    id: "mg42",
    name: "MG-42",
    damage: 29,
    headMult: 2.5,
    rpm: 0.062,
    mag: 125,
    reserve: 375,
    pellets: 1,
    spread: 0.034,
    auto: true,
    reload: 5,
    recoil: 0.038,
    pickup: 30,
    volume: 0.66,
    tone: 380,
  },

  // ── launchers ──
  {
    id: "rpg",
    name: "RPG",
    damage: 60,
    headMult: 1,
    rpm: 1.4,
    mag: 1,
    reserve: 9,
    pellets: 1,
    spread: 0.004,
    auto: false,
    reload: 3.2,
    recoil: 0.28,
    pickup: 1,
    volume: 0.9,
    tone: 190,
    projectile: { speed: 44, gravity: 3, radius: 9, damage: 320, colour: 0x8a7a6a },
  },

  // ── grenade launchers ──
  {
    id: "m32",
    name: "M32 Launcher",
    damage: 30,
    headMult: 1,
    rpm: 0.7,
    mag: 6,
    reserve: 24,
    pellets: 1,
    spread: 0.009,
    auto: false,
    reload: 3.6,
    recoil: 0.18,
    pickup: 2,
    volume: 0.78,
    tone: 240,
    projectile: { speed: 28, gravity: 14, radius: 7, damage: 210, colour: 0x4a5a3a },
  },
  {
    id: "gl40",
    name: "GL-40",
    damage: 30,
    headMult: 1,
    rpm: 1.1,
    mag: 1,
    reserve: 14,
    pellets: 1,
    spread: 0.007,
    auto: false,
    reload: 2.4,
    recoil: 0.2,
    pickup: 2,
    volume: 0.8,
    tone: 220,
    projectile: { speed: 32, gravity: 12, radius: 8, damage: 250, colour: 0x5a5240 },
  },

  // ── wonder weapons ──
  {
    id: "raygun",
    name: "Ray Gun",
    damage: 40,
    headMult: 1,
    rpm: 0.18,
    mag: 20,
    reserve: 160,
    pellets: 1,
    spread: 0.006,
    auto: false,
    reload: 2.4,
    recoil: 0.09,
    pickup: 6,
    volume: 0.6,
    tone: 900,
    projectile: { speed: 38, gravity: 0, radius: 5, damage: 220, colour: 0x6bff8a },
  },
  {
    // The best gun in the game: a three round burst that kills anything
    // outright until wave 15, after which it merely hits very hard.
    id: "raygun2",
    name: "Ray Gun Mk 2",
    damage: 460,
    headMult: 1.5,
    rpm: 0.42,
    burst: 3,
    burstDelay: 0.075,
    oneShotUntil: 15,
    mag: 21,
    reserve: 168,
    pellets: 1,
    spread: 0.004,
    auto: false,
    reload: 2.2,
    recoil: 0.05,
    pickup: 7,
    volume: 0.55,
    tone: 1180,
  },
];

const weaponById = (id) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

/*
 * What the mystery box can hand you — never a pistol, never the knife.
 * Repeats are the weighting: the Mark 2 appears once, so it is rare.
 */
/* ── aiming down the sights ──────────────────────────────────── */

/*
 * A pistol is meant to be quick and a shotgun does not care where it is
 * pointed, so neither gets sights. Everything else does, and how far it pulls
 * the world in depends on what it is: a sniper brings it right up, a submachine
 * gun barely at all.
 */
const NO_SIGHTS = new Set(["knife"]); // everything but the knife has sights

/*
 * How much closer each gun brings the world, as a magnification. A pistol or a
 * shotgun barely bothers — you are lining up, not reaching out — and a sniper
 * does what a sniper is for.
 */
const MAGNIFY = {
  pistol: 1.5, magnum: 1.5, shotgun: 1.5, dbarrel: 1.5, auto12: 1.5,
  sniper: 6,
};
const hasSights = (w) => !!w && !NO_SIGHTS.has(w.id);
const magnifyOf = (w) => (hasSights(w) ? (MAGNIFY[w.id] ?? 3) : 1);
const zoomOf = (w) => 1 / magnifyOf(w);

const AIM_SPREAD = 0.22; // what is left of the cone once you are on the sights
const AIM_WALK = 0.55; // you move like this while looking down them

const aim = { held: false, k: 0 }; // k eases 0 → 1 so nothing snaps
const aiming = () => aim.k > 0.02 && hasSights(curWeapon());
const setAiming = (on) => { aim.held = on; };

const BOX_POOL = [
  "mp5", "mp5", "vector", "vector", "uzi", "uzi",
  "ak47", "ak47", "m4", "m4", "scar", "scar",
  "shotgun", "shotgun", "auto12", "auto12",
  "magnum", "magnum", "sniper", "sniper",
  "rpd", "dingo", "mg42",
  "rpg", "m32", "gl40", "raygun",
  // one entry each: the box is the only way to either of these now
  "raygun2", "jetgun",
];

/** Two pistols and a knife — the same three every run starts with. */
function startingSlots() {
  const p = weaponById("pistol");
  return [
    { id: "pistol", mag: p.mag, reserve: p.reserve },
    { id: "pistol", mag: p.mag, reserve: p.reserve },
    { id: "knife", mag: 0, reserve: 0 },
  ];
}

/*
 * A slot holds an id, its ammo, and — once it has been through the
 * Pack-a-Punch — an `up` object of upgraded stats. Everything that wants to
 * know what a gun does asks here rather than looking the id up itself, so an
 * upgraded gun behaves like the upgrade everywhere at once.
 */
const weaponFor = (slot) => slot?.up ?? weaponById(slot?.id ?? "pistol");
const curSlot = () => game.slots[game.weapon];
const curWeapon = () => weaponFor(curSlot());

const PAP_COST = 5000;
const PAP_REFILL = 2500; // topping up a gun that has already been through it

// what the machine does to a gun
function packedVersion(id) {
  const w = weaponById(id);
  return {
    ...w,
    id: w.id,
    name: papName(w.name),
    damage: w.damage * 2,
    mag: Math.round(w.mag * 2),
    reserve: Math.round(w.reserve * 2),
    spread: w.spread * 0.75,
    recoil: w.recoil * 0.8,
    reload: w.reload * 0.85,
    pickup: Math.round(w.pickup * 1.6),
    packed: true,
  };
}

/*
 * Upgraded guns get a new name, the way they always have. Built rather than
 * listed: twenty-one weapons and a table would drift out of step the moment
 * one is added.
 */
const PAP_PREFIX = ["Ultra", "Widow", "Reaper", "Malice", "Vulture", "Havoc", "Cinder", "Warden"];
const PAP_SUFFIX = ["Maker", "Bringer", "Sting", "Wail", "Fang", "Roar", "Cutter", "Ruin"];
function papName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `${PAP_PREFIX[h % PAP_PREFIX.length]}-${PAP_SUFFIX[(h >> 5) % PAP_SUFFIX.length]}`;
}

/* ── crash reporting ──────────────────────────────────────────
 * A thrown error used to leave a dead screen with no explanation.
 * Now it says what broke, on screen and in the console.
 */
function fatal(what, err) {
  const msg = `${what}: ${err?.message ?? err}
${err?.stack ?? ""}`;
  console.error("[zombie attack]", msg);
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal";
    el.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:999;background:#5a0d0d;" +
      "color:#fff;font:12px/1.6 ui-monospace,monospace;padding:14px;" +
      "white-space:pre-wrap;max-height:50vh;overflow:auto;border-top:2px solid #ff5a5a";
    document.body.appendChild(el);
  }
  el.textContent = el.textContent ? `${el.textContent}

— then —
${msg}` : msg;
}

addEventListener("error", (e) =>
  fatal("uncaught", e.error ?? { message: `${e.message} @ ${e.filename}:${e.lineno}` }),
);
addEventListener("unhandledrejection", (e) => fatal("promise", e.reason));
// ── dom ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $("hud"),
  minimap: $("minimap"),
  crosshair: $("crosshair"),
  healthBar: $("health-bar"),
  healthText: $("health-text"),
  weaponName: $("weapon-name"),
  mag: $("mag"),
  reserve: $("reserve"),
  reloading: $("reloading"),
  wave: $("wave"),
  points: $("points"),
  prompt: $("prompt"),
  bonus: $("bonus"),
  flash: $("flash"),
  equip: $("equip-line"),
  scoreboard: $("scoreboard"),
  respawning: $("respawning"),
  kills: $("kills"),
  remaining: $("remaining"),
  loadout: $("loadout"),
  toast: $("toast"),
  banner: $("banner"),
  vignette: $("vignette"),
  lobby: $("lobby"),
  lobbyPanel: $("lobby-panel"),
  settingsSub: $("settings-sub"),
  pause: $("pause"),
  dead: $("dead"),
  deadWave: $("dead-wave"),
  deadKills: $("dead-kills"),
};

// ── audio (synthesised — no asset files to ship) ─────────────────
let actx = null;

function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}

function noiseBurst(duration, freq, gainValue, type = "lowpass") {
  const ctx = audio();
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // decaying white noise
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

function tone(freq, duration, gainValue, type = "sawtooth", slideTo = null) {
  const ctx = audio();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo)
    osc.frequency.exponentialRampToValueAtTime(
      slideTo,
      ctx.currentTime + duration,
    );
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

const sfx = {
  shot: (w) => {
    noiseBurst(0.13, w.tone * 2.4, w.volume);
    tone(w.tone, 0.09, w.volume * 0.5, "square", w.tone * 0.35);
  },
  dryFire: () => tone(180, 0.05, 0.18, "square"),
  reload: () => {
    noiseBurst(0.05, 2600, 0.28, "highpass");
    setTimeout(() => noiseBurst(0.06, 1500, 0.3, "highpass"), 220);
  },
  flesh: () => noiseBurst(0.09, 420, 0.34),
  headshot: () => {
    noiseBurst(0.14, 700, 0.5);
    tone(1400, 0.06, 0.12, "sine", 400);
  },
  growl: () => tone(70 + Math.random() * 40, 0.5, 0.055, "sawtooth", 45),
  hurt: () => {
    noiseBurst(0.22, 260, 0.4);
    tone(140, 0.2, 0.12, "square", 70);
  },
  unlock: () => {
    tone(520, 0.12, 0.14, "sine");
    setTimeout(() => tone(780, 0.18, 0.14, "sine"), 110);
  },
  waveClear: () => {
    tone(392, 0.18, 0.12, "triangle");
    setTimeout(() => tone(523, 0.28, 0.12, "triangle"), 150);
  },
  death: () => tone(200, 1.1, 0.22, "sawtooth", 40),
  swap: () => noiseBurst(0.05, 1800, 0.2, "highpass"),
  click: () => noiseBurst(0.03, 3000, 0.1, "highpass"),
  kill: () => {
    tone(660, 0.07, 0.1, "sine");
    setTimeout(() => tone(880, 0.1, 0.1, "sine"), 60);
  },
  /** Low body you feel, plus a crack that carries. */
  explosion: (distance = 0) => {
    const k = Math.max(0.1, 1 - distance / 50);
    noiseBurst(0.65, 220, 0.75 * k);
    noiseBurst(0.15, 1800, 0.32 * k, "highpass");
    tone(88, 0.5, 0.45 * k, "sine", 32);
  },
  /** Earth tearing open as something climbs out of it. */
  dig: (distance = 0) => {
    const k = Math.max(0.1, 1 - distance / 45);
    noiseBurst(0.5, 340, 0.3 * k);
    tone(58, 0.42, 0.16 * k, "sawtooth", 30);
  },
};

// ── renderer / scene ─────────────────────────────────────────────
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);
scene.fog = new THREE.FogExp2(0x0a1018, 0.021);

const HIP_FOV = 76;
const camera = new THREE.PerspectiveCamera(
  HIP_FOV,
  innerWidth / innerHeight,
  0.1,
  260,
);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

/*
 * Taking the mouse, without making a fuss if the browser says no.
 *
 * Chrome refuses a lock that is already held or asked for again too soon after
 * an Escape, and refuses by rejecting a promise — which surfaces as an
 * unhandled rejection and, before this, as an error the player could see. It
 * is never worth stopping for: the game plays on, the mouse is just free.
 */
let lockPending = false;
function grabMouse() {
  // pointerLockElement is still null while a request is in flight, so that
  // alone does not stop us asking twice — which is itself a refusal
  if (touchMode || document.pointerLockElement || lockPending) return;
  lockPending = true;
  setTimeout(() => (lockPending = false), 500);
  try {
    // asking the element directly: PointerLockControls returns nothing to
    // catch on, and an uncaught refusal used to reach the player as an error
    const p = document.body.requestPointerLock();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* the mouse stays free; nothing else changes */
  }
}

addEventListener("resize", () => {
  camera.aspect = lobbyCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  lobbyCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── difficulty ───────────────────────────────────────────────────
// Each level scales four independent things, so "hard" is not just
// "more health" — they hit harder, arrive sooner and move quicker.
const DIFFICULTIES = [
  { id: "easy", label: "EASY", blurb: "Fewer, slower, softer.", damage: 0.6, count: 0.7, speed: 0.85, health: 0.75, rate: 1.3, coins: 5 },
  { id: "normal", label: "NORMAL", blurb: "The intended fight.", damage: 1, count: 1, speed: 1, health: 1, rate: 1, coins: 10 },
  { id: "hard", label: "HARD", blurb: "Harder hits, bigger waves.", damage: 1.5, count: 1.35, speed: 1.15, health: 1.45, rate: 0.78, coins: 15 },
  { id: "insane", label: "INSANE", blurb: "You will die.", damage: 2.2, count: 1.8, speed: 1.38, health: 2.1, rate: 0.55, coins: 25 },
];

// ── maps ─────────────────────────────────────────────────────────
const obstacles = []; // collision volumes
const blockers = []; // meshes that stop bullets
const fires = [];
const mysteryBoxes = [];
let mapGroup = null;
let mapDef = null;

/*
 * Props. `y` is the bottom of the piece, so a roof can float above a doorway
 * and you walk underneath it. `clip:false` means no collision at all — used
 * for tree canopies well over your head.
 */
const box = (x, z, w, h, d, c, r = 0, y = 0, clip = true) => ({
  t: "box", x, z, w, h, d, c, r, y, clip,
});
const cyl = (x, z, rt, rb, h, c, y = 0, clip = true) => ({
  t: "cyl", x, z, rt, rb, h, c, y, clip,
});
const cone = (x, z, rad, h, c, y = 0, clip = false) => ({
  t: "cone", x, z, rad, h, c, y, clip,
});

// Real woodland is not one green: canopies, trunks and stone all vary, and
// nothing stands perfectly upright.
const CANOPY = [0x2f4a2b, 0x375733, 0x27401f, 0x3d5c34, 0x33502c, 0x2a4726];
const TRUNK = [0x3d2f22, 0x463527, 0x33281d, 0x4a3a2a];
const ROCK = [0x5f6167, 0x6b6d72, 0x54565b, 0x74766f, 0x646259];
const pickOf = (arr, rnd) => arr[Math.min(arr.length - 1, (rnd() * arr.length) | 0)];

/** A tree: leaning trunk, three stacked canopies, none of it colliding overhead. */
function tree(x, z, scale = 1, rnd = Math.random) {
  const trunkH = 3.4 * scale;
  const lean = (rnd() - 0.5) * 0.16;
  const near = pickOf(CANOPY, rnd);
  const far = pickOf(CANOPY, rnd);
  return [
    { ...cyl(x, z, 0.22 * scale, 0.44 * scale, trunkH, pickOf(TRUNK, rnd)), tilt: lean },
    { ...cone(x, z, 2.4 * scale, 3.5 * scale, near, trunkH * 0.66), tilt: lean },
    { ...cone(x, z, 1.8 * scale, 2.9 * scale, far, trunkH * 1.26), tilt: lean },
    { ...cone(x, z, 1.1 * scale, 2.2 * scale, near, trunkH * 1.86), tilt: lean },
  ];
}

/** A dead one — bare trunk, broken limbs, no canopy. */
function deadTree(x, z, scale = 1, rnd = Math.random) {
  const h = 4.2 * scale;
  return [
    { ...cyl(x, z, 0.14 * scale, 0.4 * scale, h, 0x3a3028), tilt: (rnd() - 0.5) * 0.3 },
    { ...box(x, z, 2.2 * scale, 0.16, 0.16, 0x3a3028, rnd() * 3, h * 0.62), tilt: 0.4, clip: false },
    { ...box(x, z, 1.6 * scale, 0.14, 0.14, 0x3a3028, rnd() * 3, h * 0.82), tilt: -0.5, clip: false },
  ];
}

/** A rock cluster: a few angled slabs of stone with moss on the crown. */
function rocks(x, z, scale, rnd) {
  const out = [];
  const count = 2 + ((rnd() * 4) | 0);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 1.7 * scale;
    const s = (0.6 + rnd() * 1.2) * scale;
    out.push({
      ...box(
        x + Math.cos(a) * d,
        z + Math.sin(a) * d,
        s * 1.5,
        s * (0.45 + rnd() * 0.85),
        s * 1.2,
        pickOf(ROCK, rnd),
        rnd() * 3,
      ),
      tilt: (rnd() - 0.5) * 0.22,
    });
  }
  // moss catches the light on top and breaks up the grey
  out.push(box(x, z, scale * 1.4, 0.12, scale * 1.2, 0x3f5a34, rnd() * 3, scale * 0.7));
  return out;
}

const rngFrom = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const pickR = (arr, rnd) => arr[Math.min(arr.length - 1, (rnd() * arr.length) | 0)];

const HOUSE_PALETTES = [
  [0xa89880, 0x8a6a52],
  [0x9c8f7a, 0x7d5a46],
  [0xb2a68e, 0x8f6b50],
  [0x8e8272, 0x6f5442],
  [0xc0b49c, 0x9a7358],
];

const CONCRETE = [0x9a9287, 0x8e8579, 0xa39a8d, 0x8a8478, 0xb0a89a];

/**
 * One run of ruined wall, divided into bays. Each bay comes out solid,
 * windowed, crumbled to waist height, or blown away entirely — so no two
 * facades in the game are the same.
 */
function ruinWall(cx, cz, axis, len, h, t, colour, rnd, opts = {}) {
  const gap = opts.gap ?? 0.18;
  const low = opts.low ?? 0.15;
  const y = opts.y ?? 0;
  const out = [];
  const bays = Math.max(3, Math.round(len / 2.6));
  const bw = len / bays;

  for (let i = 0; i < bays; i++) {
    const o = -len / 2 + bw * (i + 0.5);
    const px = axis === "x" ? cx + o : cx;
    const pz = axis === "x" ? cz : cz + o;
    const w = axis === "x" ? bw : t;
    const d = axis === "x" ? t : bw;
    const roll = rnd();

    if (roll < gap) continue; // blown open — walk straight through
    if (roll < gap + low) {
      out.push(box(px, pz, w, 1.3, d, colour, 0, y)); // crumbled to waist
    } else if (roll < gap + low + 0.44) {
      out.push(box(px, pz, w, 0.95, d, colour, 0, y)); // sill
      out.push(box(px, pz, w, Math.max(0.4, h - 2.25), d, colour, 0, y + 2.25));
    } else {
      out.push(box(px, pz, w, h, d, colour, 0, y)); // intact
    }
  }
  return out;
}

/* ── the buried town ─────────────────────────────────────────── */

const TIMBER = [0x4a3728, 0x55402e, 0x3d2e22, 0x5e4632];
const PLANK = 0x6b5233;
const ADOBE = 0x8a7355;

/*
 * A Western storefront. The false front is the whole trick of the style: a
 * flat parapet carried up past the roofline so a single-storey shed looks like
 * a two-storey building from the street. Underneath it is a porch on posts and
 * a boardwalk, then one room you can walk into.
 *
 * `face` is the direction the front looks: 0 towards +z, PI towards -z.
 */
function storefront(x, z, w, d, seed, face = 0, opts = {}) {
  const rnd = rngFrom(seed);
  const wall = pickOf(TIMBER, rnd);
  const H = opts.h ?? 3.4;
  const T = 0.4;
  const hw = w / 2;
  const hd = d / 2;
  const p = [];

  // which way is "out the front" in world terms
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  const sx = fz; // along the frontage
  const sz = -fx;
  const at = (along, out, y = 0, ...rest) => [x + sx * along + fx * out, z + sz * along + fz * out, ...rest, y];

  const axis = Math.abs(fz) > 0.5 ? "x" : "z";
  const cross = axis === "x" ? "z" : "x";

  // front wall, split around a doorway
  const doorW = 2.6;
  const run = (w - doorW) / 2;
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * (doorW / 2 + run / 2), hd);
    p.push(...ruinWall(px, pz, axis, run, H, T, wall, rnd, { gap: 0.1, low: 0.12 }));
  }
  // and the three that are not the front
  {
    const [bx, bz] = at(0, -hd);
    p.push(...ruinWall(bx, bz, axis, w, H, T, wall, rnd, { gap: 0.2, low: 0.16 }));
  }
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * hw, 0);
    p.push(...ruinWall(px, pz, cross, d, H, T, wall, rnd, { gap: 0.16, low: 0.14 }));
  }

  // the false front: a flat parapet carried up over the roofline
  {
    const [px, pz] = at(0, hd);
    p.push(box(px, pz, axis === "x" ? w + 0.5 : T, 1.9, axis === "x" ? T : w + 0.5, wall, 0, H));
    p.push(box(px, pz, axis === "x" ? w + 0.9 : 0.55, 0.28, axis === "x" ? 0.55 : w + 0.9, PLANK, 0, H + 1.9));
  }

  // roof over the room, and the porch out front on its posts
  {
    const [rx, rz] = at(0, 0);
    p.push({ ...box(rx, rz, w - 0.3, 0.26, d - 0.3, PLANK, 0, H), clip: true });
    const [px, pz] = at(0, hd + 1.5);
    p.push({ ...box(px, pz, axis === "x" ? w : 3.2, 0.22, axis === "x" ? 3.2 : w, PLANK, 0, 3.1), clip: false });
    // boardwalk — low enough to step straight onto
    p.push(box(px, pz, axis === "x" ? w + 1 : 3.4, 0.3, axis === "x" ? 3.4 : w + 1, PLANK));
    for (const side of [-1, 1]) {
      const [cx2, cz2] = at(side * (hw - 0.4), hd + 2.8);
      p.push(box(cx2, cz2, 0.28, 3.1, 0.28, wall));
    }
  }

  // something inside, so it is a room and not a shed
  const [ix, iz] = at(-hw * 0.45, -hd * 0.35);
  p.push(box(ix, iz, 2.4, 1.1, 0.7, PLANK)); // counter
  const [jx, jz] = at(hw * 0.5, -hd * 0.5);
  p.push(box(jx, jz, 0.5, 2.1, 1.6, wall)); // shelving
  if (rnd() > 0.4) {
    const [kx, kz] = at(hw * 0.2, hd * 0.2);
    p.push(box(kx, kz, 1.4, 0.75, 0.9, PLANK, rnd() * 3)); // table
  }
  return p;
}

/*
 * The church: a long nave under a pitched roof, a steeple over the door, and
 * pews you can break line of sight behind.
 */
function chapel(x, z, seed) {
  const rnd = rngFrom(seed);
  const HW = 7;
  const HD = 11;
  const H = 5;
  const T = 0.45;
  const wall = 0x6e5b45;
  const p = [];

  const doorW = 2.8;
  const run = HW - doorW / 2;
  for (const side of [-1, 1]) {
    p.push(...ruinWall(x + side * (doorW / 2 + run / 2), z + HD, "x", run, H, T, wall, rnd, { gap: 0.08, low: 0.1 }));
  }
  p.push(...ruinWall(x, z - HD, "x", HW * 2, H, T, wall, rnd, { gap: 0.18, low: 0.14 }));
  for (const side of [-1, 1]) {
    p.push(...ruinWall(x + side * HW, z, "z", HD * 2, H, T, wall, rnd, { gap: 0.14, low: 0.12 }));
  }

  // pitched roof, in rafters so nothing traps you underneath
  for (let i = 0; i < 9; i++) {
    const o = -HD * 0.85 + i * (HD * 0.21);
    p.push({ ...box(x, z + o, HW * 2.1, 0.24, 0.3, 0x4a3728), y: H + 0.9, tilt: 0.34, clip: false });
    p.push({ ...box(x, z + o, HW * 2.1, 0.24, 0.3, 0x4a3728), y: H + 0.9, tilt: -0.34, clip: false });
  }

  // the steeple over the door
  p.push(
    box(x, z + HD + 1.2, 4.2, H + 2.6, 4.2, wall),
    box(x, z + HD + 1.2, 3.4, 2.2, 3.4, 0x5b4a38, 0, H + 2.6),
    cone(x, z + HD + 1.2, 2.6, 4, 0x3f3a30, H + 4.8),
  );

  // pews down both sides, and an altar at the far end
  for (let i = 0; i < 7; i++) {
    const pz = z - HD * 0.72 + i * (HD * 0.2);
    for (const side of [-1, 1]) {
      p.push(box(x + side * HW * 0.45, pz, HW * 0.6, 0.55, 0.5, 0x4a3728));
    }
  }
  p.push(
    box(x, z - HD * 0.82, 3.2, 1.1, 1.1, 0x7a6a52),
    box(x, z - HD * 0.82, 0.35, 1.8, 0.35, 0xb0a894, 0, 1.1),
  );
  return p;
}

/** A grave: a slab, a mound, and sometimes a leaning cross. */
function grave(x, z, rnd) {
  const out = [
    box(x, z, 1.1, 0.9, 0.22, 0x8d8272, (rnd() - 0.5) * 0.5),
    box(x, z - 1.1, 1.5, 0.26, 2.1, 0x4a4034, (rnd() - 0.5) * 0.4),
  ];
  if (rnd() > 0.6) {
    out.push({ ...box(x + 0.9, z + 0.5, 0.18, 1.6, 0.18, 0x4a3728), tilt: 0.25, clip: false });
  }
  return out;
}

/*
 * The mine head: four legs leaning in over the shaft, a winding wheel on top,
 * and rails running away from it. The frame is scenery — you walk under it.
 */
function mineHead(x, z, seed) {
  const rnd = rngFrom(seed);
  const p = [];
  const R = 3.4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.78;
    p.push({
      ...box(x + Math.cos(a) * R, z + Math.sin(a) * R, 0.42, 9, 0.42, 0x4a3728),
      tilt: 0.14,
      clip: false,
    });
  }
  p.push({ ...box(x, z, 7.4, 0.36, 0.5, 0x4a3728), y: 8.6, clip: false });
  p.push({ ...box(x, z, 0.5, 0.36, 7.4, 0x4a3728), y: 8.6, clip: false });
  p.push({ ...cyl(x, z, 1.6, 1.6, 0.4, 0x3a3a3a, 9), clip: false });

  // the shaft mouth, boarded round the edge
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.push(box(x + Math.cos(a) * 2.6, z + Math.sin(a) * 2.6, 1.3, 0.7, 0.5, 0x55402e, -a));
  }
  // rails leading off towards the town
  for (let i = 0; i < 16; i++) {
    p.push(box(x + 5 + i * 2.2, z, 0.4, 0.16, 2.6, 0x3f3a30));
  }
  void rnd;
  return p;
}

/*
 * A crack in the street with lava in it. The glowing part is scenery you can
 * walk over — you have to be able to, or the streets stop being streets — and
 * standing in it is what hurts. `lavaPools` is what the damage checks read.
 */
const LAVA_DEEP = 0xd8140e;
const LAVA_HOT = 0xff3a24;
const lavaPools = []; // whichever map is standing
function lavaCrack(sink, x, z, w, d, r = 0) {
  sink.push({ x, z, hw: w / 2, hd: d / 2, cos: Math.cos(-r), sin: Math.sin(-r) });
  return [
    // red, with a hotter red down the middle of it
    { ...box(x, z, w, 0.12, d, LAVA_DEEP, r, 0.02), clip: false },
    { ...box(x, z, w * 0.72, 0.16, d * 0.72, LAVA_HOT, r, 0.05), clip: false },
    // the broken lip of the road either side
    box(x, z, w + 0.9, 0.34, d + 0.9, 0x2f2a26, r),
  ];
}

/** Is this spot standing in lava? */
function inLava(x, z) {
  for (const p of lavaPools) {
    const dx = x - p.x;
    const dz = z - p.z;
    const lx = dx * p.cos - dz * p.sin;
    const lz = dx * p.sin + dz * p.cos;
    if (Math.abs(lx) < p.hw && Math.abs(lz) < p.hd) return true;
  }
  return false;
}

/*
 * A barn: a big open timber shed with a hayloft over half of it, a ramp up to
 * the loft, and both ends open enough to run through.
 */
function barn(x, z, seed) {
  const rnd = rngFrom(seed);
  const HW = 11;
  const HD = 15;
  const H = 6.5;
  const T = 0.5;
  const wood = 0x6e3b2a;
  const LOFT = 3.4;
  const p = [];

  for (const side of [-1, 1]) {
    p.push(...ruinWall(x + side * HW, z, "z", HD * 2, H, T, wood, rnd, { gap: 0.16, low: 0.12 }));
  }
  // the two ends, each with a big doorway
  for (const end of [-1, 1]) {
    const doorW = 5;
    const run = HW - doorW / 2;
    for (const side of [-1, 1]) {
      p.push(...ruinWall(x + side * (doorW / 2 + run / 2), z + end * HD, "x", run, H, T, wood, rnd, { gap: 0.1, low: 0.1 }));
    }
    p.push(box(x, z + end * HD, doorW, 1.4, T, wood, 0, H - 1.4));
  }

  // the hayloft over the back half, and the ramp up to it
  p.push(box(x, z - HD * 0.45, HW * 2 - 0.6, 0.35, HD * 1.05, 0x8a6a3a, 0, LOFT));
  for (let i = 0; i < 10; i++) {
    p.push(box(x + HW - 1.6, z + HD * 0.5 - i * 0.9, 2.6, (LOFT / 10) * (i + 1), 0.95, 0x6b5233));
  }
  // bales up top and down below
  for (let i = 0; i < 5; i++) {
    p.push(box(x - HW * 0.5 + i * 2.2, z - HD * 0.7, 1.6, 1.1, 1.2, 0xb9973f, rnd() * 0.4, LOFT + 0.35));
    p.push(box(x - HW * 0.6 + rnd() * 8, z + HD * 0.3 - rnd() * 6, 1.6, 1.1, 1.2, 0xb9973f, rnd() * 3));
  }
  // a pitched roof in rafters, nothing to bump your head on
  for (let i = 0; i < 11; i++) {
    const o = -HD * 0.9 + i * (HD * 0.18);
    for (const t of [0.4, -0.4]) {
      p.push({ ...box(x, z + o, HW * 2.2, 0.24, 0.3, 0x4a3728), y: H + 1, tilt: t, clip: false });
    }
  }
  return p;
}

/** A grain silo: a tall drum with a cone on top. */
function silo(x, z) {
  return [
    cyl(x, z, 3.4, 3.6, 14, 0x8d8272),
    { ...cone(x, z, 4, 3.4, 0x6b6d72, 14), clip: false },
    box(x + 4.2, z, 0.4, 12, 0.4, 0x5a5f66), // the ladder cage
  ];
}

/** A run of mine timbering: two posts and a cap, repeated along a line. */
function timbering(x1, z1, x2, z2, count) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const k = i / count;
    const x = x1 + (x2 - x1) * k;
    const z = z1 + (z2 - z1) * k;
    const a = Math.atan2(z2 - z1, x2 - x1) + Math.PI / 2;
    for (const side of [-1, 1]) {
      out.push(box(x + Math.cos(a) * side * 2.4, z + Math.sin(a) * side * 2.4, 0.42, 3.4, 0.42, 0x4a3728));
    }
    out.push({ ...box(x, z, Math.abs(Math.cos(a)) * 5.4 + 0.5, 0.4, Math.abs(Math.sin(a)) * 5.4 + 0.5, 0x4a3728), y: 3.4, clip: false });
  }
  return out;
}

/*
 * A multi-storey concrete ruin: bombed-out apartment block with floor slabs
 * eaten away on one side, exposed joists, broken columns, and a rubble slope
 * you can climb to get inside.
 */
function ruinBlock(x, z, seed) {
  const rnd = rngFrom(seed);
  const HW = 6.5 + rnd() * 3;
  const HD = 5.5 + rnd() * 2.5;
  const FH = 3.1;
  const floors = 3 + (rnd() > 0.55 ? 1 : 0);
  const c = pickR(CONCRETE, rnd);
  const slab = 0x7d7770;
  const side = rnd() > 0.5 ? 1 : -1; // which side has come down
  const p = [];

  for (let f = 0; f < floors; f++) {
    const y = f * FH;
    const gap = 0.13 + f * 0.13;
    const low = 0.1 + f * 0.06;
    const t = 0.45;

    // the collapsed flank loses more of its facade the higher you go
    const runLen = HW * 2 * Math.max(0.34, 1 - f * 0.22);
    const runX = x - side * (HW - runLen / 2);
    p.push(...ruinWall(runX, z + HD, "x", runLen, FH - 0.35, t, c, rnd, { gap, low, y }));
    p.push(...ruinWall(runX, z - HD, "x", runLen, FH - 0.35, t, c, rnd, { gap, low, y }));
    p.push(...ruinWall(x - side * HW, z, "z", HD * 2, FH - 0.35, t, c, rnd, { gap: gap * 0.7, low, y }));
    if (f === 0) {
      p.push(...ruinWall(x + side * HW, z, "z", HD * 2, FH - 0.35, t, c, rnd, { gap: gap + 0.22, low: low + 0.12, y }));
    }

    // Floor slab, eaten back on the ruined side. Even the lowest one leaves
    // that flank open, so the rubble ramp climbs into daylight instead of
    // running into the underside of a ceiling.
    const slabW = HW * 2 * Math.max(0.38, 0.72 - f * 0.1);
    p.push(box(x - side * (HW - slabW / 2), z, slabW, 0.3, HD * 2, slab, 0, y + FH - 0.35));
    // joists left hanging over the hole
    p.push(box(x + side * (HW - 1.3), z, 2.6, 0.18, HD * 1.5, 0x6e675e, 0, y + FH - 0.3));

    for (const cx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        if (cx === side && rnd() > 0.45) continue; // column sheared off
        p.push(box(x + cx * (HW - 0.3), z + cz * (HD - 0.3), 0.6, FH, 0.6, c, 0, y));
      }
    }
  }

  // Rubble slope into the first floor. Each step rises less than a stride,
  // and they only jitter a little — scattering them widely broke the ramp
  // into disconnected lumps you could not actually climb.
  for (let i = 0; i < 9; i++) {
    p.push(
      box(
        x + side * (HW + 3.4 - i * 0.78),
        z + (rnd() - 0.5) * 1.4,
        4.4,
        0.35 + i * 0.34,
        4.2,
        0x7a6f62,
        (rnd() - 0.5) * 0.4,
      ),
    );
  }

  // debris apron and fallen slabs leaning on the wreck
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const d = HW + 1 + rnd() * 6;
    p.push(
      box(x + Math.cos(a) * d, z + Math.sin(a) * d, 1.4 + rnd() * 2, 0.3, 1.4 + rnd() * 2, 0x6f665b, rnd() * 3),
    );
  }
  p.push({ ...box(x + side * (HW + 2), z - HD * 0.5, 5, 0.35, 2.4, slab, 0.3), tilt: side * 0.5, y: 1.2, clip: false });
  p.push({ ...box(x + side * (HW + 1.4), z + HD * 0.6, 4.4, 0.3, 2, slab, -0.4), tilt: side * 0.65, y: 0.9, clip: false });

  return p;
}

/*
 * A ruined house. Every one is generated from its seed: different footprint,
 * different palette, different walls breached, one or two storeys, and its own
 * furniture arrangement. No two in the game are alike.
 */
/*
 * `markSink` collects the spots inside this house that the game wants to put
 * something on later — a perk machine, a gun on the wall, a doorway worth
 * charging for. The house knows where its rooms and its stairs ended up; the
 * placement code does not, so it asks.
 */
function house(x, z, seed = 1, boxSink = null, markSink = null) {
  const rnd = rngFrom(seed);
  const HW = 16.4 + rnd() * 5.2;
  const HD = 16.4 + rnd() * 5.2;
  const H = 3.2;
  const T = 0.5;
  const FLOOR = H + 0.1;
  const [wall, brick] = pickR(HOUSE_PALETTES, rnd);
  const wood = 0x4a3a28;
  const deck = 0x6b5540;
  const twoStorey = true; // every house has an upstairs worth reaching
  const side = rnd() > 0.5 ? 1 : -1; // which flank holds the stairs
  const p = [];

  // ── front wall, split around a doorway ──
  const doorW = 2.4;
  const runW = HW - doorW / 2;
  p.push(
    ...ruinWall(x - (doorW / 2 + runW / 2), z + HD, "x", runW, H, T, wall, rnd, { gap: 0.15, low: 0.14 }),
    ...ruinWall(x + (doorW / 2 + runW / 2), z + HD, "x", runW, H, T, wall, rnd, { gap: 0.15, low: 0.14 }),
    box(x, z + HD, doorW, 0.7, T, wall, 0, 2.5),
  );

  // ── the other three walls, each breached differently ──
  p.push(
    ...ruinWall(x, z - HD, "x", HW * 2, H, T, wall, rnd, { gap: 0.24, low: 0.16 }),
    ...ruinWall(x - HW, z, "z", HD * 2, H, T, wall, rnd, { gap: 0.2, low: 0.15 }),
    ...ruinWall(x + HW, z, "z", HD * 2, H, T, wall, rnd, { gap: 0.28, low: 0.2 }),
  );


  // ── interior partitions: real rooms, each with a doorway ──
  // A run split either side of a gap, so there is always a way through.
  const wallRun = (cx, cz, axis, span, gapAt, thickness, y = 0) => {
    const door = 3;
    const seg = span - door / 2;
    const off = door / 2 + seg / 2;
    const out = [];
    for (const dir of [-1, 1]) {
      const ax = axis === "x" ? cx + dir * off : cx;
      const az = axis === "x" ? cz : cz + dir * off;
      out.push(...ruinWall(ax, az, axis, seg, H, thickness, wall, rnd, { gap: 0.1, low: 0.08, y }));
    }
    void gapAt;
    return out;
  };

  // one wall down the middle, one across the back half: three rooms
  p.push(
    ...wallRun(x - HW * 0.12, z, "z", HD, 0, 0.4),
    ...wallRun(x + HW * 0.45, z - HD * 0.3, "x", HW * 0.55, 0, 0.4),
  );
  // ── kitchen along the back ──
  const kx = x - HW * 0.55;
  p.push(
    box(kx, z - HD + 0.9, 3.2, 0.9, 1.1, 0x7a6a52),
    box(kx, z - HD + 0.9, 3.2, 0.08, 1.15, 0x8d8272, 0, 0.9),
    box(kx + 2.2, z - HD + 0.8, 1, 0.92, 0.9, 0x3f4348),
    box(kx + 3.5, z - HD + 0.75, 0.85, 1.95, 0.8, 0xc4c9cc),
  );

  // ── living room, arranged differently each time ──
  const lz = z + (rnd() - 0.3) * 2;
  p.push(
    box(x - HW * 0.5, lz, 4.2, 0.05, 3.4, 0x6b4436),
    box(x - HW * 0.55, lz + 1, 2.8, 0.45, 1, 0x5a6150),
    box(x - HW * 0.55, lz + 1.55, 2.8, 0.55, 0.3, 0x646b59, 0, 0.45),
    box(x - HW * 0.55, lz - 1, 1.5, 0.44, 0.9, 0x6b5540),
  );
  if (rnd() > 0.3) {
    p.push(
      box(x - 1.2, lz + 0.8, 1.3, 0.5, 0.45, 0x5a4632),
      box(x - 1.2, lz + 0.8, 1, 0.65, 0.12, 0x1a1c20, 0, 0.5),
    );
  }
  if (rnd() > 0.35) p.push(box(x - HW + 0.6, z + HD * 0.6, 0.45, 2, 1.9, 0x5a4632));
  if (rnd() > 0.45) p.push(box(x + HW * 0.35, z + HD * 0.5, 1.6, 0.75, 0.9, 0x6b5540, rnd() * 3));
  if (rnd() > 0.5) p.push(box(x + HW * 0.4, z - HD * 0.4, 1.1, 1.5, 0.6, 0x4f3f2e, rnd()));

  // ── the room behind the partition: dining and storage ──
  const dx = x + HW * 0.5;
  const dz = z + HD * 0.25;
  p.push(
    box(dx, dz, 2.6, 0.75, 1.4, 0x6b5540), // dining table
    box(dx - 1.7, dz, 0.5, 0.9, 0.5, 0x5a4632, 0.2), // chairs
    box(dx + 1.7, dz, 0.5, 0.9, 0.5, 0x5a4632, -0.3),
    box(dx, dz - 1.4, 0.5, 0.9, 0.5, 0x5a4632),
    box(dx + HW * 0.28, dz + HD * 0.3, 0.5, 2.1, 2.4, 0x4f3f2e), // dresser
  );
  if (rnd() > 0.4) {
    p.push(box(dx - HW * 0.1, dz + HD * 0.42, 1.6, 1.1, 1.2, CRATE, rnd() * 3));
  }
  if (rnd() > 0.45) {
    p.push(box(dx + HW * 0.2, dz - HD * 0.42, 1.3, 0.9, 1.3, CRATE, rnd() * 3));
  }

  if (twoStorey) {
    // upper floor, part of it fallen in
    /*
     * The stairwell must stay open to the sky. The upper floor on the stair
     * side stops at the head of the stairs rather than running over them —
     * otherwise you climb two steps, your head meets the slab, and there is
     * no way up at all.
     */
    const stairTopZ = HD * 0.05; // where the stairs finish, relative to z
    const slabDepth = HD + stairTopZ;
    p.push(
      box(x - side * HW * 0.42, z, HW * 1.16, 0.35, HD * 2, deck, 0, FLOOR),
      box(
        x + side * HW * 0.5,
        z + (stairTopZ - HD) / 2,
        HW * 0.95,
        0.35,
        slabDepth,
        deck,
        0,
        FLOOR,
      ),
      // joists over the open well: scenery, nothing to bump your head on
      {
        ...box(x + side * (HW - 1.4), z + HD * 0.62, 2.6, 0.18, HD * 0.6, wood),
        y: FLOOR + 0.06,
        clip: false,
      },
    );

    // The rise is divided so the last step finishes exactly level with the
    // floor above, and the last tread overlaps the slab edge so there is no
    // gap to drop through.
    // the mystery box waits upstairs, on the intact half of the floor
    if (boxSink) {
      boxSink.push({ x: x - side * HW * 0.45, y: FLOOR + 0.35, z: z - HD * 0.15 });
    }

    const rise = (FLOOR + 0.35) / 12;
    const runStart = HD - 1.2;

    if (markSink) {
      // Speed Cola stands open in the living room — the one you can always get
      // to. Double Tap is boarded into the far corner of the dining room.
      markSink.push({ kind: "perk", id: "speed", x: x - HW * 0.58, z: z + HD * 0.62 });
      markSink.push({
        kind: "booth-perk", id: "dtap", cost: 750, r: 2.6,
        x: x + HW * 0.62, z: z - HD * 0.62,
        // the way in looks back into the room, not into the outside wall
        facing: Math.atan2(HD * 0.62, -HW * 0.62),
      });

      // the gun on the wall, hung on the inside of the west wall
      markSink.push({ kind: "wallbuy", x: x - HW + 0.75, z: z + HD * 0.15, face: 0 });

      /*
       * The box, and the walls round it. Charging at the foot of the stairs
       * did not work: the upstairs walls are half fallen down and there is
       * more than one way onto that floor, so the money bought nothing. The
       * boards go round the box itself, where there is only one way in.
       */
      markSink.push({
        kind: "booth-box", cost: 1250, r: 2.9,
        x: x - side * HW * 0.45, z: z - HD * 0.15, y: FLOOR + 0.35,
        facing: Math.atan2(HD * 0.15, side * HW * 0.45),
      });
    }
    const tread = (runStart - stairTopZ) / 11;
    for (let i = 0; i < 12; i++) {
      p.push(
        box(
          x + side * (HW - 1.5),
          z + runStart - i * tread,
          2.5,
          rise * (i + 1),
          tread + 0.06,
          brick,
        ),
      );
    }
    // upper walls, mostly gone
    p.push(
      ...ruinWall(x - HW, z, "z", HD * 2, 2.2, T, wall, rnd, { gap: 0.3, low: 0.25, y: FLOOR + 0.35 }),
      ...ruinWall(x, z - HD, "x", HW * 2, 2, T, wall, rnd, { gap: 0.38, low: 0.24, y: FLOOR + 0.35 }),
      ...ruinWall(x, z + HD, "x", HW * 2, 2, T, wall, rnd, { gap: 0.42, low: 0.26, y: FLOOR + 0.35 }),
    );
    // what is left of a bedroom
    p.push(
      box(x - HW * 0.6, z - HD * 0.5, 2.3, 0.35, 1.9, 0x5a4632, 0, FLOOR + 0.35),
      box(x - HW * 0.6, z - HD * 0.5, 2.2, 0.25, 1.8, 0xb0a894, 0, FLOOR + 0.7),
      box(x - HW * 0.6, z - HD * 0.5 - 0.7, 1, 0.15, 0.45, 0xd6d0be, 0, FLOOR + 0.95),
      box(x - HW + 0.7, z + HD * 0.2, 0.6, 2, 1.7, 0x4f3f2e, 0, FLOOR + 0.35),
    );
    if (rnd() > 0.4) {
      p.push(box(x - HW * 0.1, z + HD * 0.5, 0.6, 0.85, 0.6, 0x6b5540, rnd() * 3, FLOOR + 0.35));
    }

    // a partition and a second room up here too
    p.push(
      ...wallRun(x - HW * 0.12, z, "z", HD * 0.8, 0, 0.4, FLOOR + 0.35),
      box(x - HW * 0.62, z + HD * 0.55, 2.2, 0.4, 1.6, 0x5a4632, 0, FLOOR + 0.35),
      box(x - HW * 0.62, z + HD * 0.55, 2.1, 0.25, 1.5, 0xb0a894, 0, FLOOR + 0.75),
      box(x + HW * 0.3, z - HD * 0.5, 1.4, 1, 1.4, CRATE, rnd() * 3, FLOOR + 0.35),
    );
  }

  // ── collapsed roof: bare rafters, some fallen through ──
  const roofY = twoStorey ? FLOOR + 2.9 : H + 0.3;
  for (let i = 0; i < 4; i++) {
    const o = -HW * 0.7 + i * (HW * 0.45);
    p.push({
      ...box(x + o, z, 0.3, 0.3, HD * 2, wood),
      y: roofY - Math.abs(o) * 0.14,
      tilt: 0.3 + i * 0.04,
      clip: false,
    });
  }
  p.push({
    ...box(x - HW * 0.4, z - HD * 0.4, HW * 1.4, 0.28, 0.28, wood, 1.1),
    tilt: -0.5,
    y: roofY - 1.4,
    clip: false,
  });
  p.push({
    ...box(x + HW * 0.3, z + HD * 0.3, HW * 1.2, 0.26, 0.26, wood, 0.5),
    tilt: 0.9,
    y: roofY - 2.2,
    clip: false,
  });

  // ── rubble round the outside ──
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const d = HW + 0.5 + rnd() * 3.5;
    p.push(
      box(
        x + Math.cos(a) * d,
        z + Math.sin(a) * d,
        1.4 + rnd() * 2,
        rnd() > 0.6 ? 0.85 : 0.3,
        1.4 + rnd() * 1.6,
        brick,
        rnd() * 3,
      ),
    );
  }

  return p;
}

/** Deterministic scatter, so a map looks the same every time you load it. */
function scatter(count, seed, make) {
  const out = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  for (let i = 0; i < count; i++) out.push(make(rnd));
  return out;
}

const CRATE = 0x5a4632;

const forestBoxes = [];
const cityBoxes = [];

// Spots the main house on each map reports back: where its rooms, its wall and
// its doorways ended up, so perks and paid doors land somewhere sensible.
const forestMarks = [];
const cityMarks = [];
const townBoxes = [];
const farmBoxes = [];
const townLava = [];
const transitBoxes = [];
const transitMarks = [];
const transitLava = [];

/*
 * The bus route: five stops with a bend between each, in the order the bus
 * visits them. The road is drawn along these and the bus drives between them,
 * so moving a point moves both and they cannot come apart.
 *
 * These numbers are not hand-placed. The first route ran from the middle of
 * one area to the middle of the next and drove through everything in between —
 * seven to eleven units deep inside solid geometry on every leg. A search over
 * the map's own obstacle list moved the stops to the edges of their areas and
 * bent the legs around what was left, which is also how a bus stop works: you
 * get off at the edge of a place and walk in. test/smoke.mjs keeps it honest.
 */
const ROUTE = [
  [-13.5, 117.8], // the depot
  [-70.8, 46.3],
  [-93.5, 12],
  [-92, -10], // the diner
  [-56, -42],
  [-20, -46],
  [52, -60], // the farm
  [61, -9],
  [69, -17],
  [68, 68], // the power station
  [50, 60],
  [32, 52], // the town, on its outskirts
  [15, 78],
];

/*
 * Which of those points are places, as opposed to bends put in to get round a
 * building. The bus waits at a place and drives straight through a bend — it
 * was waiting at all thirteen, which is why it kept halting in open country
 * for no reason anyone could see.
 */
const STOPS = new Set([0, 3, 6, 9, 11]);

/*
 * Is this spot on the road? The bus is fifteen units long and turns, so
 * nothing solid may stand within about its own length of the centre line —
 * otherwise the ends of it sweep through whatever the middle missed. Used to
 * keep the scattered scenery off the route, because a road with a tree in it
 * is not a road.
 */
function onRoute(x, z, margin = 11) {
  for (let i = 0; i < ROUTE.length; i++) {
    const [ax, az] = ROUTE[i];
    const [bx, bz] = ROUTE[(i + 1) % ROUTE.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < margin) return true;
  }
  return false;
}

/** Drop anything a scatter put on the road. */
const offRoute = (list) => list.filter((prop) => !prop || !onRoute(prop.x, prop.z));
const farmMarks = [];
const townMarks = [];

const MAPS = [
  {
    id: "forest",
    name: "Forest",
    blurb: "Dense woodland around a lone cabin. Hold the house or take your chances in the trees.",
    half: 72,
    ground: 0x2f3d26,
    sky: 0x0d1710,
    fog: 0.0092,
    light: 0.85,
    start: [0, 22],
    boxes: forestBoxes,
    marks: forestMarks,
    fires: [[-22, -20], [24, 18], [0, 30], [-26, 22]],
    props: [
      ...house(0, 0, 91, forestBoxes, forestMarks),

      // Woodland grows in clumps with clearings between, not on a grid.
      // Each cluster is a handful of trees of varying size and shade.
      ...scatter(46, 5, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 27 + rnd() * 42;
        const cx = Math.cos(a) * d;
        const cz = Math.sin(a) * d;
        const out = [];
        const n = 4 + ((rnd() * 6) | 0);
        for (let i = 0; i < n; i++) {
          const ta = rnd() * Math.PI * 2;
          const td = rnd() * 8;
          out.push(
            ...tree(cx + Math.cos(ta) * td, cz + Math.sin(ta) * td, 0.7 + rnd() * 0.95, rnd),
          );
        }
        return out;
      }).flat(),

      // stragglers between the clumps, so no clearing looks cut out
      ...scatter(60, 311, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 24 + rnd() * 45;
        return tree(Math.cos(a) * d, Math.sin(a) * d, 0.6 + rnd() * 0.7, rnd);
      }).flat(),

      // dead ones, bare and leaning
      ...scatter(22, 733, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 26 + rnd() * 42;
        return deadTree(Math.cos(a) * d, Math.sin(a) * d, 0.8 + rnd() * 0.7, rnd);
      }).flat(),

      // rock clusters, from boulder to outcrop
      ...scatter(38, 149, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 20 + rnd() * 48;
        return rocks(Math.cos(a) * d, Math.sin(a) * d, 0.8 + rnd() * 1.6, rnd);
      }).flat(),

      // loose stones underfoot — low enough to walk straight over
      ...scatter(70, 907, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 18 + rnd() * 50;
        const s = 0.4 + rnd() * 0.7;
        return box(Math.cos(a) * d, Math.sin(a) * d, s, 0.28, s * 0.8, pickOf(ROCK, rnd), rnd() * 3);
      }),

      // fallen branches
      ...scatter(40, 613, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 22 + rnd() * 44;
        return box(Math.cos(a) * d, Math.sin(a) * d, 2 + rnd() * 3, 0.22, 0.24, 0x3a3028, rnd() * 3);
      }),
    ],
  },
  {
    /*
     * The town, after whatever it was that did this. The ground has split and
     * there is lava in the cracks: it lights the place, and standing in it
     * burns, so the streets are a question of where you put your feet. Tight
     * enough to be caught in, open enough to run rings in.
     */
    id: "town",
    name: "Town",
    blurb:
      "A burning town split open by lava. The bank, the bar, tight streets, and cracks in the road that will cook you.",
    half: 96,
    ground: 0x36302b,
    sky: 0x1a0d08,
    fog: 0.0075,
    light: 0.72,
    start: [0, 52],
    boxes: cityBoxes,
    marks: cityMarks,
    lava: townLava,
    fires: [[0, 0], [-34, -28], [36, 30], [-40, 34], [40, -32], [0, -54]],
    props: [
      // the bank: the big building, and the one with a vault under it
      ...house(-30, 6, 3, cityBoxes, cityMarks),
      // the bar, and the rest of the street
      ...house(34, 14, 7),
      ...house(-8, -48, 13),
      ...house(22, 52, 19),
      ...house(-60, -40, 29),
      ...house(62, -44, 41),
      ...house(-64, 46, 59),
      ...house(66, 48, 67),
      ...house(4, 78, 79),
      ...house(-30, -78, 97),
      ...house(38, -78, 103),
      ...house(-78, 4, 109),
      ...house(80, 2, 127),
      // the blocks behind them, floors caved in
      ...ruinBlock(-46, -12, 11),
      ...ruinBlock(48, -10, 23),
      ...ruinBlock(-14, 30, 37),
      ...ruinBlock(16, -28, 53),
      ...ruinBlock(-52, 70, 71),
      ...ruinBlock(54, 72, 89),
      ...ruinBlock(-2, -70, 101),
      ...ruinBlock(-82, -66, 113),
      ...ruinBlock(84, 66, 131),

      // ── the lava: what makes it this town and not any other ──
      ...lavaCrack(townLava, 0, 26, 26, 5, 0.1).flat(),
      ...lavaCrack(townLava, -18, -12, 6, 24, 0.2).flat(),
      ...lavaCrack(townLava, 20, -6, 7, 22, -0.15).flat(),
      ...lavaCrack(townLava, 0, -34, 30, 6, 0.05).flat(),
      ...lavaCrack(townLava, -44, 22, 20, 6, 1.1).flat(),
      ...lavaCrack(townLava, 46, 20, 18, 6, -1).flat(),
      ...lavaCrack(townLava, -24, 62, 22, 5, 0.4).flat(),
      ...lavaCrack(townLava, 28, 66, 20, 5, -0.5).flat(),
      ...lavaCrack(townLava, 0, 90, 34, 6, 0).flat(),
      ...lavaCrack(townLava, -70, -20, 6, 26, 0.1).flat(),
      ...lavaCrack(townLava, 72, -22, 6, 24, -0.1).flat(),
      ...scatter(14, 401, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 30 + rnd() * 55;
        return lavaCrack(townLava, Math.cos(a) * d, Math.sin(a) * d, 4 + rnd() * 5, 4 + rnd() * 5, rnd() * 3);
      }).flat().flat(),

      // burnt-out cars, barricades, rubble
      ...scatter(40, 23, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 10 + rnd() * 74;
        return box(Math.cos(a) * d, Math.sin(a) * d, 4.2, 1.4, 1.9, pickR([0x30292a, 0x2f3634, 0x3a2f28], rnd), rnd() * 3);
      }),
      ...scatter(44, 211, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 12 + rnd() * 74;
        const sz = 1.2 + rnd() * 1.6;
        return box(Math.cos(a) * d, Math.sin(a) * d, sz * 2, sz * 0.7, sz, 0x5f574e, rnd() * 3);
      }),
      ...scatter(34, 307, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 16 + rnd() * 70;
        const sz = 1 + rnd() * 0.9;
        return box(Math.cos(a) * d, Math.sin(a) * d, sz, sz, sz, CRATE, rnd() * 3);
      }),
    ],
  },
  {
    /*
     * Two buildings and a field. The point of it is the room: nothing here is
     * a corridor, so a crowd behind you stays a crowd behind you as long as
     * you keep moving. The farmhouse and the barn are where you stop being
     * able to do that.
     */
    id: "farm",
    name: "Farm",
    blurb:
      "A burnt-out farm. A house, a barn with a hayloft, a silo, and a wide open field to run rings in.",
    half: 78,
    ground: 0x4a4630,
    sky: 0x1b1a14,
    fog: 0.0105,
    light: 0.62,
    start: [0, 40],
    boxes: farmBoxes,
    marks: farmMarks,
    fires: [[-26, 22], [30, -18], [0, 8], [-34, -30]],
    props: [
      // the farmhouse: two floors, the perks and the box
      ...house(-26, 20, 211, farmBoxes, farmMarks),
      // the barn across the yard, and the silo between them
      ...barn(28, -14, 223),
      ...silo(2, -2),
      ...silo(11, -4),

      // fences round the fields, most of them down
      ...scatter(70, 233, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 52 + rnd() * 18;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        if (rnd() > 0.72) return [];
        return [
          box(x, z, 2.4, 1.25, 0.14, 0x5b4a38, a + Math.PI / 2),
          box(x, z, 0.2, 1.5, 0.2, 0x4a3728),
        ];
      }).flat(),

      // a tractor, a trailer, troughs, and things left where they stopped
      ...scatter(10, 241, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 18 + rnd() * 34;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        const r = rnd() * 3;
        return [
          box(x, z, 4.4, 1.8, 2.2, pickR([0x4a5a32, 0x6b3a2a, 0x3f4a48], rnd), r),
          { ...cyl(x + 1.8, z + 1.2, 1.2, 1.2, 0.5, 0x2a2622, 0.1), clip: false },
          { ...cyl(x - 1.8, z - 1.2, 1.2, 1.2, 0.5, 0x2a2622, 0.1), clip: false },
        ];
      }).flat(),
      ...scatter(16, 251, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 22 + rnd() * 36;
        return box(Math.cos(a) * d, Math.sin(a) * d, 3.2, 0.8, 1.1, 0x6b5233, rnd() * 3);
      }),
      // hay bales scattered over the field, low enough to vault
      ...scatter(34, 263, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 14 + rnd() * 50;
        return box(Math.cos(a) * d, Math.sin(a) * d, 1.7, 1.15, 1.3, 0xb9973f, rnd() * 3);
      }),
      // burnt stumps and dead hedgerow at the edges
      ...scatter(30, 271, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 44 + rnd() * 30;
        return deadTree(Math.cos(a) * d, Math.sin(a) * d, 0.7 + rnd() * 0.6, rnd);
      }).flat(),
      ...scatter(50, 281, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 16 + rnd() * 56;
        const sz = 0.4 + rnd() * 0.6;
        return box(Math.cos(a) * d, Math.sin(a) * d, sz, 0.26, sz * 0.8, 0x4a4034, rnd() * 3);
      }),
    ],
  },
  {
    /*
     * A mining town that went down with the ground under it: one street of
     * false-front buildings, a church and its graveyard at the top of it, and
     * the mine it was all built for out to the east. The rock closes over the
     * whole thing, which is why there is no sky and no horizon — just haze and
     * the next building along.
     */
    id: "buried",
    name: "Buried Town",
    blurb:
      "A Western mining town that the ground swallowed. One street, a church, a graveyard, and the mine it was built for.",
    half: 92,
    ground: 0x4a4034,
    sky: 0x0a0806,
    fog: 0.0115,
    light: 0.5,
    start: [0, 46],
    boxes: townBoxes,
    marks: townMarks,
    fires: [
      [0, 34], [0, 12], [0, -12], [0, -34],
      [-24, 4], [24, 30], [-6, -54], [50, -30], [0, 56],
    ],
    props: [
      // ── the saloon: two floors, the perks, and the box upstairs ──
      ...house(30, 0, 401, townBoxes, townMarks),

      // ── the west side of the street ──
      ...storefront(-24, 26, 15, 12, 11, Math.PI / 2), // general store
      ...storefront(-24, 4, 14, 13, 23, Math.PI / 2), // bank
      ...storefront(-24, -18, 12, 11, 37, Math.PI / 2), // miner's shack
      ...storefront(-25, -38, 13, 12, 53, Math.PI / 2), // gunsmith

      // ── the east side, either end of the saloon ──
      ...storefront(24, 34, 13, 11, 71, -Math.PI / 2),
      ...storefront(24, -32, 14, 12, 89, -Math.PI / 2),

      // ── the church, at the top of the street ──
      ...chapel(-4, -64, 101),

      // ── the graveyard between the church and the town ──
      ...scatter(26, 113, (rnd) => {
        const gx = -4 + (rnd() - 0.5) * 34;
        const gz = -46 + (rnd() - 0.5) * 16;
        return grave(gx, gz, rnd);
      }).flat(),
      // a fence of leaning pickets round it
      ...scatter(30, 127, (rnd) => {
        const k = rnd();
        const gx = -21 + k * 34;
        return box(gx, -37 + Math.sin(k * 9) * 0.5, 0.9, 1.5, 0.16, 0x4a3728, (rnd() - 0.5) * 0.3);
      }),

      // ── the mine, out east, and the way in from the town ──
      ...mineHead(64, -30, 131),
      ...timbering(44, -30, 14, -30, 9),
      ...timbering(64, -8, 64, 18, 7),

      // ── the street itself: boardwalk, water trough, wagons, crates ──
      ...scatter(22, 149, (rnd) => {
        const z = 44 - rnd() * 88;
        const side = rnd() > 0.5 ? 1 : -1;
        return box(side * 9.5, z, 1.6, 0.28, 3.4, PLANK, 0);
      }),
      ...scatter(9, 163, (rnd) => {
        const z = 40 - rnd() * 80;
        const side = rnd() > 0.5 ? 1 : -1;
        return box(side * 7, z, 3.4, 1, 1.5, 0x55402e, rnd() * 0.4);
      }),
      // wrecked wagons: a bed, and a wheel leaning off each end
      ...scatter(7, 181, (rnd) => {
        const x = (rnd() - 0.5) * 40;
        const z = (rnd() - 0.5) * 80;
        const r = rnd() * 3;
        return [
          box(x, z, 4.6, 1.2, 2.2, 0x55402e, r),
          { ...cyl(x + 2, z + 1, 1.1, 1.1, 0.3, 0x3d2e22, 0.2), clip: false },
          { ...cyl(x - 2, z - 1, 1.1, 1.1, 0.3, 0x3d2e22, 0.2), clip: false },
        ];
      }).flat(),
      // crates and barrels against the buildings
      ...scatter(40, 197, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 12 + rnd() * 56;
        const s = 0.9 + rnd() * 0.8;
        return rnd() > 0.5
          ? box(Math.cos(a) * d, Math.sin(a) * d, s, s, s, CRATE, rnd() * 3)
          : cyl(Math.cos(a) * d, Math.sin(a) * d, s * 0.5, s * 0.55, s * 1.3, 0x5e4632);
      }),

      // ── the cavern: rock heaped round the rim and pillars holding it up ──
      ...scatter(44, 211, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 70 + rnd() * 20;
        return rocks(Math.cos(a) * d, Math.sin(a) * d, 2.4 + rnd() * 2.6, rnd);
      }).flat(),
      ...scatter(16, 223, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 48 + rnd() * 32;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        // pillars of untouched rock, wide at the base, holding up the roof
        return [
          cyl(x, z, 2.2, 4.2, 16, pickOf(ROCK, rnd)),
          { ...cone(x, z, 5, 7, pickOf(ROCK, rnd), 15), clip: false },
        ];
      }).flat(),
      // rubble slopes you can walk up, banked against the rim
      ...scatter(26, 239, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 62 + rnd() * 14;
        const s = 2 + rnd() * 3;
        return box(Math.cos(a) * d, Math.sin(a) * d, s * 2.2, s * 0.5, s * 1.8, 0x5a5044, rnd() * 3);
      }),
      // and loose stone underfoot everywhere
      ...scatter(60, 251, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 14 + rnd() * 62;
        const s = 0.4 + rnd() * 0.7;
        return box(Math.cos(a) * d, Math.sin(a) * d, s, 0.26, s * 0.8, pickOf(ROCK, rnd), rnd() * 3);
      }),
    ],
  },
  {
    /*
     * The whole route on one map: five places, a road that joins them, and a
     * bus that drives it. Everything is a long way from everything else, which
     * is the point — the distance is what the bus is for, and walking it is
     * the choice you make when you have missed it.
     */
    id: "tranzit",
    name: "Bus",
    blurb:
      "Five places on one road: the depot, the diner, the farm, the power station and the town. A bus drives the route. Ride it or walk.",
    half: 190,
    ground: 0x3f3d33,
    sky: 0x14140f,
    fog: 0.006,
    light: 0.6,
    start: [0, 150],
    boxes: transitBoxes,
    marks: transitMarks,
    lava: transitLava,
    route: ROUTE,
    fires: [[0, 140], [-118, 34], [8, -12], [122, 40], [0, -140]],
    props: [
      /* ── the depot, where you start ───────────────────────────── */
      ...storefront(0, 152, 22, 16, 601, Math.PI),
      ...storefront(-20, 138, 12, 10, 607, Math.PI / 2),
      ...scatter(8, 613, (rnd) => {
        const x = -22 + rnd() * 44;
        return box(x, 128 + rnd() * 10, 4.6, 1.5, 2, 0x3a4a48, rnd() * 3);
      }),

      /* ── the diner, off to the west ───────────────────────────── */
      ...storefront(-118, 40, 20, 14, 619, -Math.PI / 2),
      ...house(-140, 22, 623),
      // the pumps and the canopy over them
      ...scatter(4, 629, (rnd) => {
        const x = -104 + rnd() * 8;
        const z = 26 + rnd() * 14;
        return [box(x, z, 1, 1.6, 1.4, 0xb8b0a2), box(x, z, 0.4, 0.5, 0.4, 0xd64545, 0, 1.6)];
      }).flat(),
      { ...box(-100, 33, 16, 0.5, 12, 0x8d8272), y: 4.4, clip: false },
      ...scatter(4, 631, (rnd) => box(-108 + rnd() * 16, 27 + rnd() * 12, 0.4, 4.4, 0.4, 0x8d8272)),

      /* ── the farm: the house, the barn, the silos ─────────────── */
      ...house(-30, -110, 211, transitBoxes, transitMarks),
      ...barn(20, -128, 223),
      ...silo(-2, -96),
      ...silo(7, -98),
      ...offRoute(scatter(40, 641, (rnd) => {
        const x = -60 + rnd() * 110;
        const z = -150 + rnd() * 70;
        return box(x, z, 1.7, 1.15, 1.3, 0xb9973f, rnd() * 3);
      })),

      /* ── the power station, east ──────────────────────────────── */
      ...ruinBlock(122, 46, 647),
      ...ruinBlock(140, 30, 653),
      ...storefront(108, 34, 16, 13, 659, -Math.PI / 2),
      // transformers and the pylons walking away from them
      ...scatter(9, 661, (rnd) => {
        const x = 100 + rnd() * 48;
        const z = 16 + rnd() * 44;
        return [box(x, z, 3, 3.4, 3, 0x5a5f66, rnd()), box(x, z, 0.3, 1.6, 0.3, 0x8d8272, 0, 3.4)];
      }).flat(),
      ...scatter(7, 673, (rnd) => {
        const z = -10 + rnd() * 100;
        const x = 150 + rnd() * 26;
        return [
          box(x, z, 0.5, 16, 0.5, 0x6b6d72),
          { ...box(x, z, 7, 0.4, 0.5, 0x6b6d72), y: 14, clip: false },
        ];
      }).flat(),

      /* ── the town, south, and the cracks through it ───────────── */
      ...house(-24, -8, 3, transitBoxes, transitMarks),
      ...house(26, -20, 7),
      ...house(-6, 26, 13),
      ...ruinBlock(-46, 10, 677),
      ...ruinBlock(44, 12, 683),
      ...lavaCrack(transitLava, 0, 6, 24, 5, 0.1).flat(),
      ...lavaCrack(transitLava, -18, -22, 6, 20, 0.2).flat(),
      ...lavaCrack(transitLava, 22, 4, 6, 18, -0.15).flat(),
      ...lavaCrack(transitLava, 0, -38, 26, 5, 0).flat(),

      /* ── the road that joins the five, and what lines it ──────── */
      ...ROUTE.flatMap(([rx, rz], i) => {
        const next = ROUTE[(i + 1) % ROUTE.length];
        const out = [];
        // kerb stones down both sides of each leg, thinly
        for (let k = 0; k <= 14; k++) {
          const t = k / 14;
          const x = rx + (next[0] - rx) * t;
          const z = rz + (next[1] - rz) * t;
          const a = Math.atan2(next[1] - rz, next[0] - rx) + Math.PI / 2;
          for (const side of [-1, 1]) {
            out.push(
              { ...box(x + Math.cos(a) * side * 12, z + Math.sin(a) * side * 12, 1.6, 0.3, 1.6, 0x55524a, a), clip: false },
            );
          }
        }
        return out;
      }),
      // wrecks and rubble out in the country between the stops
      ...offRoute(scatter(60, 691, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 60 + rnd() * 110;
        return box(Math.cos(a) * d, Math.sin(a) * d, 4.2, 1.4, 1.9, pickR([0x30292a, 0x2f3634, 0x3a2f28], rnd), rnd() * 3);
      })),
      // dead hedgerow and stumps, which is most of what is out there
      ...offRoute(scatter(90, 701, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 46 + rnd() * 130;
        return deadTree(Math.cos(a) * d, Math.sin(a) * d, 0.7 + rnd() * 0.8, rnd);
      }).flat()),
      ...offRoute(scatter(70, 709, (rnd) => {
        const a = rnd() * Math.PI * 2;
        const d = 40 + rnd() * 140;
        const sz = 0.5 + rnd() * 0.9;
        return box(Math.cos(a) * d, Math.sin(a) * d, sz, 0.28, sz * 0.8, pickOf(ROCK, rnd), rnd() * 3);
      })),
    ],
  },
];

const mapById = (id) => MAPS.find((m) => m.id === id) ?? MAPS[0];

function groundTexture(hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const base = new THREE.Color(hex);
  const rgb = (k) =>
    `${(base.r * 255 * k) | 0},${(base.g * 255 * k) | 0},${(base.b * 255 * k) | 0}`;
  g.fillStyle = `rgb(${rgb(1)})`;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = `rgba(${rgb(0.8 + Math.random() * 0.45)},${Math.random() * 0.6})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(HALF, HALF);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function clearMap() {
  if (!mapGroup) return;
  mapGroup.traverse((o) => {
    if (!o.isMesh) return;
    // the unit box, cylinder and cone are shared with every other map and
    // with the zombies — disposing them would blank the whole game
    if (!SHARED_GEO.includes(o.geometry)) o.geometry.dispose();
    o.material.dispose?.();
  });
  scene.remove(mapGroup);
  mapGroup = null;
  obstacles.length = 0;
  blockers.length = 0;
  fires.length = 0;
}

function buildMap(def) {
  lightsUsed = 0;
  lavaPools.length = 0;
  for (const p of def.lava ?? []) lavaPools.push(p); // a fresh map gets the whole light budget back
  clearMap();
  mapDef = def;
  HALF = def.half;
  mapGroup = new THREE.Group();
  scene.add(mapGroup);

  scene.background = new THREE.Color(def.sky);
  scene.fog = new THREE.FogExp2(def.sky, def.fog);

  mapGroup.add(new THREE.HemisphereLight(0x3d5273, 0x0a0d12, 0.9));

  const moon = new THREE.DirectionalLight(0xa8c0e0, def.light);
  moon.position.set(HALF * 0.8, HALF * 1.6, -HALF * 0.6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(768, 768);
  const s = HALF + 12;
  Object.assign(moon.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: s * 4 });
  moon.shadow.camera.updateProjectionMatrix();
  moon.shadow.bias = -0.0012;
  mapGroup.add(moon);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(def.ground), roughness: 0.96 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mapGroup.add(floor);
  blockers.push(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.92 });
  for (const [px, pz, sx, sz] of [
    [0, -HALF, HALF * 2, 1],
    [0, HALF, HALF * 2, 1],
    [-HALF, 0, 1, HALF * 2],
    [HALF, 0, 1, HALF * 2],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 7, sz), wallMat);
    wall.position.set(px, 3.5, pz);
    wall.castShadow = wall.receiveShadow = true;
    mapGroup.add(wall);
    blockers.push(wall);
  }

  // One material per colour, three shared geometries scaled per prop — a
  // forest is hundreds of pieces and they must not each allocate their own.
  const mats = new Map();
  /*
   * Lava is not lit by the map — it is the thing doing the lighting. Every
   * other prop is Lambert and takes its brightness from the moon and the
   * braziers, which in a dim street turns a red box into dark maroon. That is
   * why changing the colour alone did nothing: it was the right red, rendered
   * at a quarter brightness. These two are unlit, so they come out at exactly
   * the colour they are given.
   */
  const SELF_LIT = new Set([LAVA_DEEP, LAVA_HOT]);
  const matFor = (hex) => {
    if (!mats.has(hex)) {
      mats.set(
        hex,
        SELF_LIT.has(hex)
          ? new THREE.MeshBasicMaterial({ color: hex })
          : new THREE.MeshLambertMaterial({ color: hex }),
      );
    }
    return mats.get(hex);
  };

  /*
   * A city of ruins is a couple of thousand pieces. Drawing them one at a
   * time would sink the frame rate, so every piece sharing a colour is baked
   * into a single merged mesh — a whole map ends up as a handful of draw
   * calls. Bullets still raycast against them exactly as before.
   */
  const buckets = new Map();
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const vpos = new THREE.Vector3();
  const vscale = new THREE.Vector3();

  for (const p of def.props) {
    const src = p.t === "cyl" ? UNIT_CYL : p.t === "cone" ? UNIT_CONE : UNIT_BOX;
    const rad = p.t === "cone" ? p.rad : p.rb;
    const sx = p.t === "box" ? p.w : rad;
    const sz = p.t === "box" ? p.d : rad;

    euler.set(0, p.r ?? 0, p.tilt ?? 0);
    quat.setFromEuler(euler);
    vpos.set(p.x, (p.y ?? 0) + p.h / 2, p.z);
    vscale.set(sx, p.h, sz);
    mat4.compose(vpos, quat, vscale);

    const shaped = src.clone();
    shaped.applyMatrix4(mat4);

    const cast = p.clip !== false; // canopies and rafters cast nothing
    const key = `${p.c}:${cast}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { colour: p.c, cast, geos: [] }));
    bucket.geos.push(shaped);

    if (p.clip === false) continue;

    // A real oriented box, with a bottom as well as a top — that is what
    // lets you walk through a doorway and stand under a roof.
    const hw = p.t === "box" ? p.w / 2 : (p.t === "cone" ? p.rad : p.rb);
    const hd = p.t === "box" ? p.d / 2 : hw;
    obstacles.push({
      x: p.x,
      z: p.z,
      hw,
      hd,
      bottom: p.y ?? 0,
      top: (p.y ?? 0) + p.h,
      cos: Math.cos(p.r ?? 0),
      sin: Math.sin(p.r ?? 0),
    });
  }

  // bake each colour group into one mesh
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geos, false);
    for (const g of bucket.geos) g.dispose();
    const mesh = new THREE.Mesh(merged, matFor(bucket.colour));
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
    blockers.push(mesh);
  }

  for (const [bx, bz] of def.fires) {
    // the barrel always stands; whether it lights the street depends on how
    // many are already doing so
    const light = budgetLight(0xff7a2a, 2.6, 22);
    if (light) {
      light.position.set(bx, 1.6, bz);
      mapGroup.add(light);
      fires.push(light);
    }

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.45, 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.9 }),
    );
    barrel.position.set(bx, 0.55, bz);
    barrel.castShadow = true;
    mapGroup.add(barrel);
    blockers.push(barrel);
    obstacles.push({
      x: bx, z: bz, hw: 0.55, hd: 0.55, bottom: 0, top: 1.1, cos: 1, sin: 0,
    });
  }

  // ── mystery boxes ──
  mysteryBoxes.length = 0;
  for (const b of def.boxes ?? []) {
    const crate = new THREE.Mesh(
      UNIT_BOX,
      new THREE.MeshLambertMaterial({ color: 0x6b4f2a, emissive: 0x2a1c06 }),
    );
    crate.scale.set(1.7, 1.15, 1.2);
    crate.position.set(b.x, b.y + 0.58, b.z);
    crate.castShadow = crate.receiveShadow = true;
    mapGroup.add(crate);

    const glow = budgetLight(0xffb43c, 2.6, 9);
    if (glow) {
      glow.position.set(b.x, b.y + 1.3, b.z);
      mapGroup.add(glow);
    }

    mysteryBoxes.push({ x: b.x, y: b.y, z: b.z, mesh: crate, glow });
    obstacles.push({
      x: b.x, z: b.z, hw: 0.9, hd: 0.65,
      bottom: b.y, top: b.y + 1.15, cos: 1, sin: 0,
    });
  }

  placePerkMachines();
  buildBus();
  buildGrid(); // everything is placed — index it for fast lookups
}

const STEP = 0.35; // anything this low is stepped over, not bumped into

/*
 * Obstacle lookup grid. The forest is several hundred props, and twenty
 * zombies each probing several directions per frame would otherwise be tens
 * of thousands of box tests. Bucket the obstacles by cell and only ever look
 * at the handful nearby.
 */
const CELL = 5;
const NO_OBSTACLES = [];
let grid = new Map();

const cellKey = (x, z) =>
  Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);

function buildGrid() {
  grid = new Map();
  for (const o of obstacles) {
    const pad = Math.max(o.hw, o.hd) + 1.2;
    const x0 = Math.floor((o.x - pad) / CELL);
    const x1 = Math.floor((o.x + pad) / CELL);
    const z0 = Math.floor((o.z - pad) / CELL);
    const z1 = Math.floor((o.z + pad) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = cx * 100003 + cz;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(o);
      }
    }
  }
}

const near = (x, z) => grid.get(cellKey(x, z)) ?? NO_OBSTACLES;

/*
 * Something solid along this heading, within `reach`?
 *
 * The step has to stay under twice the probe radius or thin geometry slips
 * between two samples unnoticed — a house wall is only 0.6 thick, so a 2.2
 * step missed buildings entirely and the zombies walked straight into them.
 */
const PROBE_STEP = 1.2;

function pathBlocked(x, z, dx, dz, feetY, radius, reach) {
  const probe = { x: 0, z: 0 };
  for (let s = 0.9; s <= reach; s += PROBE_STEP) {
    probe.x = x + dx * s;
    probe.z = z + dz * s;
    for (const o of near(probe.x, probe.z)) {
      if (o.top <= feetY + STEP) continue; // low enough to walk over
      if (o.bottom >= feetY + 1.75) continue; // high enough to walk under
      if (overlapsBox(probe, radius, o)) return true;
    }
  }
  return false;
}

function overlapsBox(pos, radius, o) {
  const dx = pos.x - o.x;
  const dz = pos.z - o.z;
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  return Math.abs(lx) < o.hw + radius && Math.abs(lz) < o.hd + radius;
}

/**
 * Lowest solid surface above the feet — a ceiling. Without this, anything
 * moving upward passes straight through an upper floor, which is how zombies
 * were arriving inside the room above you.
 */
function ceilingAt(pos, radius, feetY, headroom = 1.75) {
  let low = Infinity;
  for (const o of near(pos.x, pos.z)) {
    if (o.bottom < feetY + 0.1) continue; // at or below us, not overhead
    if (o.bottom < low && overlapsBox(pos, radius * 0.6, o)) low = o.bottom;
  }
  void headroom;
  return low;
}

/** Highest surface at or below the feet. 0 is the floor. */
function groundHeightAt(pos, radius, feetY = 0) {
  let top = 0;
  // a smaller footprint here, so you fall off a crate at its edge rather
  // than hovering half a body-width past it
  for (const o of near(pos.x, pos.z)) {
    if (o.top > feetY + STEP) continue; // overhead — a roof, not a floor
    if (o.top > top && overlapsBox(pos, radius * 0.45, o)) top = o.top;
  }
  return top;
}

/**
 * Eject a circle of `radius` from any oriented box tall enough to matter.
 * Anything whose top is at or below the feet is something you stand on, not
 * something you walk into — that is what lets you jump onto crates and over
 * low cover. Returns the height of the tallest thing that blocked, or 0.
 */
function pushOut(pos, radius, feetY = 0, height = 1.75) {
  let blocked = 0;
  for (const o of near(pos.x, pos.z)) {
    if (o.top <= feetY + STEP) continue; // walk over it or stand on it
    if (o.bottom >= feetY + height) continue; // duck under it — doorways, roofs

    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const lx = dx * o.cos - dz * o.sin;
    const lz = dx * o.sin + dz * o.cos;
    const ex = o.hw + radius;
    const ez = o.hd + radius;
    if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;

    if (o.top > blocked) blocked = o.top;

    let nx = lx;
    let nz = lz;
    if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = (lx < 0 ? -1 : 1) * ex;
    else nz = (lz < 0 ? -1 : 1) * ez;

    pos.x = o.x + nx * o.cos + nz * o.sin;
    pos.z = o.z - nx * o.sin + nz * o.cos;
  }
  return blocked;
}

// ── weapon viewmodels ────────────────────────────────────────────
const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x24262b,
  roughness: 0.45,
  metalness: 0.75,
});
const gunGrip = new THREE.MeshStandardMaterial({
  color: 0x171a1f,
  roughness: 0.85,
});

function part(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildViewmodel(id) {
  const g = new THREE.Group();
  if (id === "knife") {
    g.add(part(0.05, 0.14, 0.44, 0, 0, -0.2, gunMetal)); // blade
    g.add(part(0.04, 0.05, 0.12, 0, -0.05, -0.44, gunMetal)); // point
    g.add(part(0.07, 0.09, 0.2, 0, -0.06, 0.06, gunGrip)); // handle
  } else if (id === "pistol" || id === "magnum") {
    g.add(part(0.09, 0.1, 0.36, 0, 0, -0.12, gunMetal)); // slide
    g.add(part(0.08, 0.2, 0.1, 0, -0.14, 0.03, gunGrip)); // grip
  } else if (id === "dbarrel") {
    g.add(part(0.06, 0.07, 0.86, -0.035, 0.01, -0.34, gunMetal)); // left barrel
    g.add(part(0.06, 0.07, 0.86, 0.035, 0.01, -0.34, gunMetal)); // right barrel
    g.add(part(0.1, 0.1, 0.2, 0, -0.02, 0.12, gunGrip)); // breech
    g.add(part(0.08, 0.19, 0.1, 0, -0.14, 0.16, gunGrip)); // grip
  } else if (id === "rifle" || id === "smg" || id === "lmg" || id === "sniper") {
    g.add(part(0.08, 0.1, 0.72, 0, 0, -0.28, gunMetal)); // receiver
    g.add(part(0.05, 0.05, 0.3, 0, 0.01, -0.78, gunMetal)); // barrel
    g.add(part(0.08, 0.19, 0.1, 0, -0.14, 0.02, gunGrip)); // grip
    g.add(part(0.07, 0.18, 0.12, 0, -0.13, -0.24, gunGrip)); // magazine
    g.add(part(0.07, 0.11, 0.26, 0, -0.02, 0.2, gunGrip)); // stock
  } else {
    g.add(part(0.11, 0.12, 0.8, 0, 0, -0.3, gunMetal)); // body
    g.add(part(0.07, 0.07, 0.34, 0, -0.09, -0.5, gunGrip)); // pump
    g.add(part(0.09, 0.2, 0.11, 0, -0.14, 0.06, gunGrip)); // grip
  }
  g.position.set(0.26, -0.24, -0.5);
  g.visible = false;
  g.traverse((o) => (o.castShadow = false));
  camera.add(g);
  return g;
}

const viewmodels = Object.fromEntries(
  WEAPONS.map((w) => [w.id, buildViewmodel(w.id)]),
);

/*
 * A budget for dynamic lights, because they are what was making the big maps
 * crawl.
 *
 * Three.js lights the scene in one pass: every light is worked out for every
 * lit pixel, so cost is lights × pixels whether the light reaches that pixel
 * or not. The city had ten braziers, four perk machines, the box, the
 * Pack-a-Punch, the bank, two benches, a socket and three glowing parts all
 * carrying one each — better than twenty, and a shader recompile every time
 * the count changed.
 *
 * Anything that only needs to be *seen* in the dark does not need a light at
 * all: an emissive material glows on its own for nothing. Lights are for
 * things that light their surroundings, and there is a hard ceiling on those.
 */
const LIGHT_BUDGET = 7;
let lightsUsed = 0;

/** A light, if there is room in the budget. Returns null when there is not. */
function budgetLight(colour, intensity, distance) {
  if (lightsUsed >= LIGHT_BUDGET) return null;
  lightsUsed++;
  return new THREE.PointLight(colour, intensity, distance, 2);
}

const muzzleLight = new THREE.PointLight(0xffd28a, 0, 9, 2);
muzzleLight.position.set(0.26, -0.2, -1.1);
camera.add(muzzleLight);

// ── effects pools ────────────────────────────────────────────────
const bloodGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e1414 });
const dirtMat = new THREE.MeshBasicMaterial({ color: 0x4a3a26 });
const blood = [];
for (let i = 0; i < 130; i++) {
  const m = new THREE.Mesh(bloodGeo, bloodMat);
  m.visible = false;
  scene.add(m);
  blood.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
}
let bloodCursor = 0;

function spatter(at, dir, count, mat = bloodMat) {
  for (let i = 0; i < count; i++) {
    const p = blood[bloodCursor];
    bloodCursor = (bloodCursor + 1) % blood.length;
    p.mesh.material = mat;
    p.mesh.position.copy(at);
    p.mesh.visible = true;
    p.life = 0.55 + Math.random() * 0.35;
    p.vel
      .copy(dir)
      .multiplyScalar(1.6 + Math.random() * 3)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3.4,
          (Math.random() - 0.5) * 4,
        ),
      );
  }
}

const tracers = [];
for (let i = 0; i < 14; i++) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffe0a0,
    transparent: true,
    opacity: 0,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}
let tracerCursor = 0;

function tracer(from, to) {
  const t = tracers[tracerCursor];
  tracerCursor = (tracerCursor + 1) % tracers.length;
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.life = 0.06;
  t.line.material.opacity = 0.85;
}

// ── zombies ──────────────────────────────────────────────────────
const zombies = [];
const hitboxes = []; // raycast targets, mapped back via userData

const ZOMBIE_TONES = [0x7f9b63, 0x8aa06b, 0x6f8f5c, 0x93a173];
const SHIRTS = [0xcfc3a4, 0xbdb191, 0xd6cdb2, 0xc2b79b];
const PANTS = [0x4a3b2e, 0x554438, 0x3f342a];

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const RISE_TIME = 1.9; // how long a zombie takes to climb out of the ground
const BURIED = 2.0; // how far below the floor it starts
const ZOMBIE_DAMAGE = 33; // a walker's bite: three of them and you are down
const FLOOR_RISE = 3.7; // a storey — the most they will leap in one go
const CLIMB_SPEED = 2.3; // how fast they haul themselves up a wall

// One shared cube, scaled per piece. Thirty zombies with twenty pieces each
// would otherwise mean six hundred separate geometries.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(0.62, 1, 1, 8); // tapered, for trunks
const UNIT_CONE = new THREE.ConeGeometry(1, 1, 7); // low-poly canopy
const SHARED_GEO = [UNIT_BOX, UNIT_CYL, UNIT_CONE];

function piece(parent, w, h, d, x, y, z, mat, shadow = false) {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

/*
 * Low-poly zombie: green skin, glowing eyes in dark sockets, hanging jaw,
 * a torn shirt over ragged trousers, bare feet, hunched with both arms
 * reaching forward.
 */
function buildZombie(kind) {
  // the roster reads at a glance: ninjas in black, bosses in their own colours
  const LOOK = {
    finisher: { skin: 0x6f7a68, shirt: 0x14161a, pants: 0x0d0f12 },
    fat:      { skin: 0x8aa06b, shirt: 0x9a8f6a, pants: 0x4a4030 },
    bigdude:  { skin: 0x6f8f5c, shirt: 0x5a4a3a, pants: 0x33291f },
    reviver:  { skin: 0x93a173, shirt: 0x6a3f5a, pants: 0x38243a },
    marksman: { skin: 0x74855f, shirt: 0x3f4a34, pants: 0x2e3626 },
    hopper:   { skin: 0x7f9b63, shirt: 0x4a5a3a, pants: 0x2f3a26 },
  };
  const look = LOOK[kind];

  const skin = new THREE.MeshLambertMaterial({
    color: look?.skin ?? pick(ZOMBIE_TONES),
    transparent: true,
    // the Marksman blends into the treeline until it fires
    opacity: kind === "marksman" ? 0.45 : 1,
  });
  const shirt = new THREE.MeshLambertMaterial({
    color: look?.shirt ?? pick(SHIRTS),
    transparent: true,
    opacity: kind === "marksman" ? 0.45 : 1,
  });
  const pants = new THREE.MeshLambertMaterial({
    color: look?.pants ?? pick(PANTS),
    transparent: true,
    opacity: kind === "marksman" ? 0.45 : 1,
  });
  const blood = new THREE.MeshLambertMaterial({ color: 0x6e1a16, transparent: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x141a10, transparent: true });
  const teeth = new THREE.MeshLambertMaterial({ color: 0xd8d2bc, transparent: true });
  const eye = new THREE.MeshLambertMaterial({
    color: 0x101010,
    emissive: 0xfff4c0,
    transparent: true,
  });

  const g = new THREE.Group();

  // ── legs: trousers to mid-shin, then bare green and bare feet ──
  const buildLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(0.15 * side, 0.95, 0);
    piece(hip, 0.25, 0.52, 0.27, 0, -0.25, 0, pants, true); // thigh
    piece(hip, 0.21, 0.3, 0.23, 0, -0.62, 0.01, pants, true); // shin, trouser
    // torn hem
    piece(hip, 0.22, 0.07, 0.24, 0, -0.76, 0.01, pants);
    piece(hip, 0.19, 0.18, 0.2, 0, -0.85, 0.01, skin); // bare shin
    piece(hip, 0.2, 0.1, 0.34, 0, -0.9, 0.09, skin, true); // foot
    piece(hip, 0.18, 0.05, 0.07, 0, -0.9, 0.27, skin); // toes
    g.add(hip);
    return hip;
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ── body, hunched forward ──────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.95, 0);
  body.rotation.x = 0.24;
  g.add(body);

  const torso = piece(body, 0.62, 0.5, 0.36, 0, 0.25, 0, shirt, true);
  piece(body, 0.68, 0.13, 0.37, 0, 0.52, 0, shirt, true); // shoulders
  piece(body, 0.2, 0.1, 0.2, 0, 0.6, 0, skin); // neck
  // torn shirt hem
  piece(body, 0.64, 0.09, 0.37, 0, -0.02, 0, shirt);
  piece(body, 0.18, 0.1, 0.37, -0.2, -0.08, 0, shirt);
  piece(body, 0.16, 0.08, 0.37, 0.18, -0.09, 0, shirt);
  // exposed midriff and bloodstains
  piece(body, 0.5, 0.12, 0.3, 0, -0.06, 0, skin);
  piece(body, 0.16, 0.13, 0.02, -0.13, 0.3, 0.185, blood);
  piece(body, 0.11, 0.09, 0.02, 0.16, 0.14, 0.185, blood);
  piece(body, 0.13, 0.1, 0.02, 0.1, 0.44, 0.185, blood);

  // ── head ───────────────────────────────────────────────────────
  const head = piece(body, 0.36, 0.38, 0.34, 0, 0.82, 0.01, skin, true);
  piece(body, 0.34, 0.07, 0.06, 0, 0.9, 0.16, skin); // brow ridge
  piece(body, 0.1, 0.09, 0.05, -0.09, 0.845, 0.16, dark); // sockets
  piece(body, 0.1, 0.09, 0.05, 0.09, 0.845, 0.16, dark);
  piece(body, 0.06, 0.055, 0.03, -0.09, 0.845, 0.185, eye); // glowing eyes
  piece(body, 0.06, 0.055, 0.03, 0.09, 0.845, 0.185, eye);
  piece(body, 0.19, 0.13, 0.05, 0, 0.7, 0.15, dark); // open mouth
  piece(body, 0.17, 0.025, 0.03, 0, 0.755, 0.165, teeth); // upper teeth
  piece(body, 0.17, 0.025, 0.03, 0, 0.655, 0.165, teeth); // lower teeth
  piece(body, 0.24, 0.1, 0.18, 0, 0.63, 0.08, skin); // hanging jaw

  // ── arms: reaching forward, fingers spread ─────────────────────
  const buildArm = (side, droop) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.36 * side, 0.46, 0);
    shoulder.rotation.x = droop;
    shoulder.rotation.z = 0.12 * side;
    piece(shoulder, 0.16, 0.42, 0.16, 0, -0.2, 0, skin, true); // upper arm
    piece(shoulder, 0.17, 0.14, 0.17, 0, -0.02, 0, shirt); // torn sleeve
    piece(shoulder, 0.14, 0.38, 0.14, 0, -0.58, 0, skin, true); // forearm
    piece(shoulder, 0.15, 0.1, 0.19, 0, -0.81, 0.03, skin); // palm
    for (let f = 0; f < 3; f++) {
      piece(shoulder, 0.035, 0.05, 0.13, -0.045 + f * 0.045, -0.82, 0.17, skin);
    }
    body.add(shoulder);
    return shoulder;
  };
  buildArm(-1, -1.32);
  buildArm(1, -1.02); // one arm lower, like the reference

  const mats = [skin, shirt, pants, blood, dark, teeth, eye];
  return {
    group: g,
    torso,
    head,
    legL,
    legR,
    skin,
    cloth: shirt,
    mats,
    flashMats: [skin, shirt, pants, blood],
  };
}

/*
 * The roster. Speeds and health are absolute; the wave scaling multiplies
 * them afterwards. `chance` is the flat roll per spawn — what is left over
 * is an ordinary walker.
 */
const ZOMBIE_TYPES = {
  fat:      { chance: 0.10,  hp: 200, speed: 0.88, dmg: 33,  scale: 1.4,  label: "a fat one" },
  runner:   { chance: 0.05,  hp: 60,  speed: 6,    dmg: 33,  scale: 0.92, label: "a runner" },
  hopper:   { chance: 0.025, hp: 70,  speed: 2.2,  dmg: 33,  scale: 0.9,  label: "a hopper" },
  finisher: { chance: 0.025, hp: 10,  speed: 3,    dmg: 100, scale: 0.95, label: "a finisher" },
  bigdude:  { chance: 0.01,  hp: 300, speed: 1.75, dmg: 66,  scale: 2,    label: "the Big Dude", boss: true },
  reviver:  { chance: 0.01,  hp: 100, speed: 1.75, dmg: 33,  scale: 1,    label: "a Reviver", boss: true },
  marksman: { chance: 0.01,  hp: 120, speed: 1.6,  dmg: 70,  scale: 1,    label: "the Marksman", boss: true, sniper: true },
  walker:   { chance: 0,     hp: 100, speed: 1.75, dmg: 33,  scale: 1,    label: "a walker" },
};

function rollKind() {
  const r = Math.random();
  let acc = 0;
  for (const [id, t] of Object.entries(ZOMBIE_TYPES)) {
    if (!t.chance) continue;
    acc += t.chance;
    if (r < acc) return id;
  }
  return "walker";
}

const CORPSE_TIME = 60; // how long a body lies there before it fades
const REVIVE_TIME = 5; // a Reviver gets back up this long after falling
/*
 * How long a zombie may go nowhere before it is dug up and sent back in.
 *
 * There is always one last zombie you cannot find. It is wedged between two
 * pieces of furniture, or standing on a stair tread it cannot get off, or it
 * came up inside a wall — and the wave will not end until it is dead, so the
 * game stops. Rather than chase every way that can happen, watch for a zombie
 * that is not getting anywhere and put it back on the map near you.
 */
const STUCK_TIME = 6;
const STUCK_DIST = 0.9; // moved less than this in that time counts as stuck

/*
 * How many are allowed on their feet at once, and how fast they come.
 *
 * A wave used to arrive all together: the whole round's worth clawing up in
 * the first few seconds, which is a wall rather than a fight, and the reason
 * the early rounds felt heavier than the map could carry. It builds now — a
 * handful on the first rounds, the full crowd only once you are deep in.
 */
const MAX_LIVE_CAP = 16;
const liveCap = () => Math.min(MAX_LIVE_CAP, 5 + Math.floor(game.wave * 1.2));
const spawnGap = () => Math.max(0.5, 1.7 - game.wave * 0.05) * game.diff.rate;

const MAX_LIVE = MAX_LIVE_CAP; // kept for anything still reading it
const MAX_CORPSES = 10; // bodies left lying about before the oldest fade

/*
 * Still in the fight. A body counts as dead the instant it drops — except a
 * Reviver, which is only down until someone finishes it, so it must keep its
 * place in the wave and in the count of what is left.
 */
const stillFighting = (z) => z.dying <= 0 || (z.kind === "reviver" && !z.finished);
const liveCount = () => zombies.reduce((n, z) => n + (stillFighting(z) ? 1 : 0), 0);

/** Once the bodies pile up, send the oldest on their way early. */
function trimCorpses() {
  let corpses = zombies.filter((z) => !stillFighting(z) && z.dying < CORPSE_TIME);
  while (corpses.length > MAX_CORPSES) {
    let oldest = corpses[0];
    for (const z of corpses) if (z.dying > oldest.dying) oldest = z;
    oldest.dying = CORPSE_TIME;
    corpses = corpses.filter((z) => z !== oldest);
  }
}

/*
 * Somewhere out on the perimeter, clear of the player and clear of anything
 * solid. Coming up inside a wall is one of the ways a zombie ends up somewhere
 * it can never walk out of.
 */
function pickSpawnPoint(minFromPlayer = 15) {
  const ring = HALF * 0.82;
  let best = [0, 0];
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = ring * (0.75 + Math.random() * 0.25);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    best = [x, z];
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < minFromPlayer) continue;
    if (spotIsClear(x, z, 0.9)) return [x, z];
  }
  return best;
}

/*
 * Take a zombie that is going nowhere and bury it somewhere it can walk out
 * of. It keeps its health and its kind — this is not a fresh one, it is the
 * same one dug up and put back where it can reach you. Closer than a normal
 * spawn, because the usual reason you notice is that it is the last one left
 * and you have been looking for it.
 */
function digOutZombie(z) {
  const [x, zz] = pickSpawnPoint(12);
  z.group.position.set(x, -BURIED, zz);
  z.y = -BURIED;
  z.vy = 0;
  z.grounded = true;
  z.climbing = false;
  z.rising = RISE_TIME * 0.6;
  z.stuckFor = 0;
  z.lastX = x;
  z.lastZ = zz;
  z.blocked = false;
  z.flank = 0;
  spatter(new THREE.Vector3(x, 0.15, zz), new THREE.Vector3(0, 1, 0), 10, dirtMat);
  sfx.dig(Math.hypot(x - player.pos.x, zz - player.pos.z));
}

function spawnZombie(wave) {
  const kind = wave >= 3 ? rollKind() : "walker";
  const type = ZOMBIE_TYPES[kind];

  const model = buildZombie(kind);
  const scale = type.scale;
  model.group.scale.setScalar(scale);

  const [x, z] = pickSpawnPoint();

  model.group.position.set(x, -BURIED, z);
  scene.add(model.group);

  // earth bursting open where it comes up
  spatter(new THREE.Vector3(x, 0.15, z), new THREE.Vector3(0, 1, 0), 16, dirtMat);
  sfx.dig(Math.hypot(x - player.pos.x, z - player.pos.z));

  // Both the punch and the staying power grow every wave, so a night that
  // starts survivable stops being one.
  const hpScale = 1 + 0.15 * (wave - 1);
  const dmgScale = 1 + 0.09 * (wave - 1);
  const D = game.diff;
  const base = { hp: type.hp, speed: type.speed, dmg: type.dmg };

  const z0 = {
    kind,
    ...model,
    hp: base.hp * hpScale * D.health,
    maxHp: base.hp * hpScale * D.health,
    speed:
      base.speed * (1 + 0.035 * (wave - 1)) * D.speed * (0.9 + Math.random() * 0.2),
    damage: base.dmg * D.damage * dmgScale,
    radius: 0.45 * scale,
    phase: Math.random() * Math.PI * 2,
    attackCd: 0,
    y: -BURIED,
    vy: 0,
    grounded: true,
    rising: RISE_TIME, // claws its way up out of the earth before it hunts
    wander: Math.random() * Math.PI * 2, // bearing taken when it loses you
    flank: 0, // seconds left committed to rounding one side of an obstacle
    side: Math.random() < 0.5 ? 1 : -1,
    thinkCd: Math.random() * 0.3, // staggered so they don't all re-plan together
    blocked: false,
    flankX: 0,
    flankZ: 0,
    jumpCd: 0,
    climbing: false,
    flash: 0,
    dying: 0,
    finished: false,
    growlCd: Math.random() * 6,
    // watched, so one that wedges itself can be dug out again
    stuckFor: 0,
    lastX: x,
    lastZ: z,
  };

  model.torso.userData.zombie = z0;
  model.head.userData.zombie = z0;
  model.head.userData.isHead = true;
  hitboxes.push(model.torso, model.head);
  zombies.push(z0);
  return z0;
}

/* ── perk machines ───────────────────────────────────────────── */

const PERKS_FOR_SALE = [
  { id: "jugg",   name: "Juggernaut", cost: 2500, colour: 0xd64545, desc: "Double health" },
  { id: "speed",  name: "Speed Cola", cost: 2000, colour: 0x4aa3ff, desc: "Reload twice as fast" },
  { id: "dtap",   name: "Double Tap", cost: 2000, colour: 0xffc94a, desc: "Double damage" },
  { id: "stamin", name: "Stamin-Up", cost: 2000, colour: 0x5fd77a, desc: "Move half again as fast" },
];

const perkMachines = [];
const ownedPerks = new Set();

const hasPerk = (id) => ownedPerks.has(id);

/* ── paid ways through, and guns on the wall ─────────────────── */

/*
 * A barrier is a heap of boards across a doorway that you clear with points.
 * It is a real obstacle while it stands — the same box everything else in the
 * world collides with — so buying one means taking it back out of the world
 * and re-indexing the grid. That costs a millisecond, once, on a keypress.
 */
const barriers = [];
const wallBuys = [];

const WALL_GUN = "dbarrel"; // the double barrel, hung inside the house
const WALL_GUN_COST = 500;

/* ── the Pack-a-Punch, and the bank ──────────────────────────── */

const packMachines = [];
const bankTellers = [];

function addPackMachine(x, z, y = 0) {
  const mat = new THREE.MeshLambertMaterial({
    color: 0x3f8f5a, emissive: 0x3f8f5a, emissiveIntensity: 0.9,
  });
  const body = new THREE.Mesh(UNIT_BOX, mat);
  body.scale.set(2.4, 2.6, 1.6);
  body.position.set(x, y + 1.3, z);
  body.castShadow = true;
  mapGroup.add(body);

  // the mouth you feed a gun into
  const slot = new THREE.Mesh(UNIT_BOX, new THREE.MeshBasicMaterial({ color: 0x9dffc4 }));
  slot.scale.set(1.5, 0.18, 0.1);
  slot.position.set(x, y + 1.6, z + 0.85);
  mapGroup.add(slot);

  obstacles.push({ x, z, hw: 1.25, hd: 0.85, bottom: y, top: y + 2.6, cos: 1, sin: 0 });
  packMachines.push({ x, z, y });
}

function packCurrentWeapon() {
  const slot = curSlot();
  const w = curWeapon();
  // the guard belongs here, not in the prompt that happens to call it
  if (!quest.powered) {
    sfx.dryFire();
    toast("IT NEEDS POWER");
    return;
  }
  if (w.melee) {
    toast("NOT THE KNIFE");
    sfx.dryFire();
    return;
  }

  if (slot.up) {
    // already been through: this is a refill, at half the price
    if (game.points < PAP_REFILL) {
      sfx.dryFire();
      toast(`NEED ${PAP_REFILL - game.points} MORE POINTS`);
      return;
    }
    game.points -= PAP_REFILL;
    slot.mag = slot.up.mag;
    slot.reserve = slot.up.reserve;
    game.reloadTimer = 0;
    sfx.unlock();
    toast(`${slot.up.name.toUpperCase()} — FILLED`);
    syncHud();
    return;
  }

  if (game.points < PAP_COST) {
    sfx.dryFire();
    toast(`NEED ${PAP_COST - game.points} MORE POINTS`);
    return;
  }
  game.points -= PAP_COST;
  slot.up = packedVersion(slot.id);
  slot.mag = slot.up.mag;
  slot.reserve = slot.up.reserve;
  game.reloadTimer = 0;

  sfx.unlock();
  banner(slot.up.name.toUpperCase(), 1800);
  toast("PACKED A PUNCH");
  renderLoadout();
  syncHud();
}

/*
 * The bank. Points are gone the moment you die; what is in the bank is not.
 * You can only ever take out what you put in, so it is a way to carry a good
 * run forward, not a way to print points.
 */
const BANK_STEP = 1000;

function addBankTeller(x, z, y = 0) {
  const mat = new THREE.MeshLambertMaterial({
    color: 0xc9a227, emissive: 0xc9a227, emissiveIntensity: 0.75,
  });
  const desk = new THREE.Mesh(UNIT_BOX, mat);
  desk.scale.set(3, 1.2, 1);
  desk.position.set(x, y + 0.6, z);
  desk.castShadow = true;
  mapGroup.add(desk);

  const grille = new THREE.Mesh(UNIT_BOX, new THREE.MeshBasicMaterial({ color: 0xffd76b }));
  grille.scale.set(2.4, 1.1, 0.1);
  grille.position.set(x, y + 1.75, z);
  mapGroup.add(grille);

  obstacles.push({ x, z, hw: 1.5, hd: 0.55, bottom: y, top: y + 1.2, cos: 1, sin: 0 });
  bankTellers.push({ x, z, y });
}

function useBank(withdraw) {
  if (withdraw) {
    const take = Math.min(BANK_STEP, bank.points);
    if (take <= 0) {
      sfx.dryFire();
      toast("NOTHING IN THE BANK");
      return;
    }
    bank.points -= take;
    game.points += take;
    saveBank();
    sfx.unlock();
    toast(`WITHDREW ${take} · ${bank.points} LEFT`);
  } else {
    const put = Math.min(BANK_STEP, game.points);
    if (put < BANK_STEP) {
      sfx.dryFire();
      toast(`NEED ${BANK_STEP} POINTS TO DEPOSIT`);
      return;
    }
    game.points -= put;
    bank.points += put;
    saveBank();
    sfx.unlock();
    toast(`DEPOSITED ${put} · ${bank.points} BANKED`);
  }
  syncHud();
}

/*
 * A slab, and the box that blocks you, agreeing about which way they face.
 *
 * `run` is the world direction the slab's length points along. The engine
 * stores an obstacle's orientation as cos/sin of a rotation whose local x axis
 * comes out at (cos r, -sin r), and three.js turns a mesh the same way, so
 * both take r = -run. Getting that sign wrong is invisible at right angles —
 * the two boxes still cover the same ground — and puts the wall ninety degrees
 * away from where it looks on the diagonal.
 */
function orientedSlab(x, z, y, hw, hd, h, run, colour) {
  const r = -run;
  const mat = new THREE.MeshLambertMaterial({ color: colour });
  const mesh = new THREE.Mesh(UNIT_BOX, mat);
  mesh.scale.set(hw * 2, h, hd * 2);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = r;
  mesh.castShadow = mesh.receiveShadow = true;
  mapGroup.add(mesh);

  const obs = { x, z, hw, hd, bottom: y, top: y + h, cos: Math.cos(r), sin: Math.sin(r) };
  obstacles.push(obs);
  return { mesh, mat, obs };
}

function addBarrier(x, z, y, hw, hd, h, cost, run = 0) {
  const { mesh, mat, obs } = orientedSlab(x, z, y, hw, hd, h, run, 0x6a533a);
  barriers.push({ x, z, y, cost, mesh, mat, obs, bought: false });
}

function buyBarrier(b) {
  if (b.bought) return;
  if (game.points < b.cost) {
    sfx.dryFire();
    toast(`NEED ${b.cost - game.points} MORE POINTS`);
    return;
  }
  game.points -= b.cost;
  b.bought = true;

  mapGroup.remove(b.mesh);
  b.mat.dispose();
  const i = obstacles.indexOf(b.obs);
  if (i !== -1) obstacles.splice(i, 1);
  buildGrid(); // the world changed shape; the lookup has to agree

  sfx.unlock();
  toast("CLEARED");
  syncHud();
}

function addWallBuy(x, z, weaponId, cost) {
  const w = weaponById(weaponId);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a, emissive: 0x2a1c06 });
  const mesh = new THREE.Mesh(UNIT_BOX, mat);
  mesh.scale.set(0.25, 0.45, 1.9);
  mesh.position.set(x, 1.5, z);
  mapGroup.add(mesh);

  wallBuys.push({ x, z, y: 0, weaponId, cost, name: w?.name ?? weaponId, mesh, mat });
}

/** Buy the gun off the wall, or top it up if you already carry it. */
function buyWallGun(wb) {
  const w = weaponById(wb.weaponId);
  const held = game.slots.find((s) => s.id === wb.weaponId);
  const price = held ? Math.round(wb.cost * 0.5) : wb.cost;

  if (game.points < price) {
    sfx.dryFire();
    toast(`NEED ${price - game.points} MORE POINTS`);
    return;
  }
  game.points -= price;

  if (held) {
    held.mag = w.mag;
    held.reserve = w.reserve;
    toast(`${w.name.toUpperCase()} — REFILLED`);
  } else {
    // it takes the gun in your hand, never the knife
    const slot = game.slots[game.weapon]?.id === "knife" ? 0 : game.weapon;
    for (const vm of Object.values(viewmodels)) vm.visible = false;
    game.slots[slot] = { id: wb.weaponId, mag: w.mag, reserve: w.reserve };
    game.weapon = slot;
    viewmodels[wb.weaponId].visible = true;
    game.reloadTimer = 0;
    toast(w.name.toUpperCase());
    renderLoadout();
  }
  sfx.swap();
  syncHud();
}

/* ── buildables, the prisoner, the train, and the quest ──────── */

/*
 * Parts lie about the map. Carry them to a workbench and it assembles
 * whatever you have a full set for. The Turbine is the one that matters
 * first: nothing in this town has power until it is running.
 */
const BUILDABLES = [
  { id: "turbine", name: "Turbine", parts: 3, blurb: "Powers the Pack-a-Punch" },
];
const buildableById = (id) => BUILDABLES.find((b) => b.id === id);

const partPickups = []; // lying on the ground, waiting to be walked over
const carried = {}; // id → how many of its parts you have
const built = new Set();
const workbenches = [];
const turbineSockets = [];

// what has been switched on and opened this run
const quest = { powered: false, vaultOpen: false, won: false };

function carriedLine() {
  const bits = [];
  for (const b of BUILDABLES) {
    const n = carried[b.id] ?? 0;
    if (n > 0 && !built.has(b.id)) bits.push(`${b.name} ${n}/${b.parts}`);
  }
  if (built.has("turbine") && !quest.powered) bits.push("Turbine in hand");
  return bits.join(" · ");
}

/** Scatter one buildable's parts around the map, well apart. */
function scatterParts(def, seed) {
  const rnd = rngFrom(seed);
  for (let i = 0; i < def.parts; i++) {
    const a = (i / def.parts) * Math.PI * 2 + rnd() * 0.8;
    const [x, z] = clearSpot(a, HALF * (0.35 + rnd() * 0.35));

    const mat = new THREE.MeshLambertMaterial({
      color: def.id === "turbine" ? 0x6fd3ff : 0xffb43c,
      emissive: def.id === "turbine" ? 0x1d4a5c : 0x4a3206,
      emissiveIntensity: 1,
    });
    const mesh = new THREE.Mesh(UNIT_BOX, mat);
    mesh.scale.set(0.8, 0.4, 0.55);
    mesh.position.set(x, 0.55, z);
    mapGroup.add(mesh);

    partPickups.push({ id: def.id, x, z, mesh, mat, taken: false });
  }
}

function updateParts(dt) {
  for (const p of partPickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 1.6;
    p.mesh.position.y = 0.55 + Math.sin(game.time * 2.4 + p.x) * 0.12;
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) > 2.2) continue;
    if (Math.abs(player.pos.y) > 2.5) continue;

    p.taken = true;
    mapGroup.remove(p.mesh);
    p.mat.dispose();
    carried[p.id] = (carried[p.id] ?? 0) + 1;
    const def = buildableById(p.id);
    sfx.unlock();
    toast(`${def.name.toUpperCase()} PART ${carried[p.id]}/${def.parts}`);
  }
}

function addWorkbench(x, z, y = 0) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x6b5233 });
  const top = new THREE.Mesh(UNIT_BOX, mat);
  top.scale.set(3.2, 0.9, 1.4);
  top.position.set(x, y + 0.45, z);
  top.castShadow = top.receiveShadow = true;
  mapGroup.add(top);

  obstacles.push({ x, z, hw: 1.6, hd: 0.7, bottom: y, top: y + 0.9, cos: 1, sin: 0 });
  workbenches.push({ x, z, y });
}

/** What the bench would make right now, or null. */
function benchReady() {
  for (const b of BUILDABLES) {
    if (built.has(b.id)) continue;
    if ((carried[b.id] ?? 0) >= b.parts) return b;
  }
  return null;
}

function buildAtBench() {
  const def = benchReady();
  if (!def) {
    sfx.dryFire();
    const missing = BUILDABLES.filter((b) => !built.has(b.id))
      .map((b) => `${b.name} ${carried[b.id] ?? 0}/${b.parts}`)
      .join(" · ");
    toast(missing ? `STILL NEED — ${missing}` : "NOTHING LEFT TO BUILD");
    return;
  }
  built.add(def.id);
  sfx.unlock();
  banner(`${def.name.toUpperCase()} BUILT`, 2000);
  toast(def.blurb.toUpperCase());
}

function addTurbineSocket(x, z, y = 0) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a4a55, emissive: 0x101c24 });
  const pad = new THREE.Mesh(UNIT_BOX, mat);
  pad.scale.set(1.8, 0.3, 1.8);
  pad.position.set(x, y + 0.15, z);
  mapGroup.add(pad);
  turbineSockets.push({ x, z, y, pad, mat, live: false });
}

function placeTurbine(socket) {
  if (!built.has("turbine")) {
    sfx.dryFire();
    toast("BUILD THE TURBINE FIRST");
    return;
  }
  if (quest.powered) return;
  quest.powered = true;
  socket.live = true;
  socket.mat.color.setHex(0x6fd3ff);
  socket.mat.emissive.setHex(0x2b6a86);

  const spin = new THREE.Mesh(UNIT_CYL, new THREE.MeshLambertMaterial({ color: 0x8fdcff, emissive: 0x2b6a86 }));
  spin.scale.set(0.7, 1.6, 0.7);
  spin.position.set(socket.x, socket.y + 1, socket.z);
  mapGroup.add(spin);
  socket.spin = spin;

  const glow = budgetLight(0x6fd3ff, 4, 18);
  if (glow) {
    glow.position.set(socket.x, socket.y + 2.2, socket.z);
    mapGroup.add(glow);
  }

  sfx.unlock();
  banner("POWER ON", 2200);
  toast("THE PACK-A-PUNCH IS LIVE");
}

/*
 * The prisoner. He has been down here longer than the town has, he is twice
 * the size of anything else walking, and he is not on the zombies' side. Pay
 * off the lock and he follows you about, takes apart whatever gets close, and
 * puts his shoulder through anything boarded up.
 */
const LEROY_COST = 2000;
const leroy = { alive: false, group: null, x: 0, z: 0, y: 0, swingCd: 0, cell: null };

function addLeroyCell(x, z, y = 0) {
  const bars = new THREE.Mesh(UNIT_BOX, new THREE.MeshLambertMaterial({ color: 0x5a5f66 }));
  bars.scale.set(3.4, 3, 0.3);
  bars.position.set(x, y + 1.5, z + 1.6);
  mapGroup.add(bars);

  /*
   * He is a man, not one of them — the same build the deathmatch operators
   * use, at twice the size and in prison colours. Half of why he reads as an
   * ally rather than a threat is that he does not walk like the dead.
   */
  const him = buildBot(0xb5651d);
  him.group.scale.setScalar(2);
  him.group.position.set(x, y, z);
  scene.add(him.group);

  leroy.cell = { x, z, y, bars, group: him.group, model: him };
  leroy.model = him;
  leroy.alive = false;
  obstacles.push({ x, z: z + 1.6, hw: 1.7, hd: 0.2, bottom: y, top: y + 3, cos: 1, sin: 0 });
}

function freeLeroy() {
  if (leroy.alive || !leroy.cell) return;
  if (game.points < LEROY_COST) {
    sfx.dryFire();
    toast(`NEED ${LEROY_COST - game.points} MORE POINTS`);
    return;
  }
  game.points -= LEROY_COST;
  leroy.alive = true;
  leroy.group = leroy.cell.group;
  leroy.x = leroy.cell.x;
  leroy.z = leroy.cell.z;
  leroy.y = leroy.cell.y;

  mapGroup.remove(leroy.cell.bars);
  const i = obstacles.findIndex((o) => o.x === leroy.cell.x && o.z === leroy.cell.z + 1.6);
  if (i !== -1) obstacles.splice(i, 1);
  buildGrid();

  sfx.unlock();
  banner("HE IS OUT", 2200);
  toast("HE FOLLOWS YOU NOW");
  syncHud();
}

function updateLeroy(dt) {
  if (!leroy.alive || !leroy.group) return;
  const g = leroy.group;
  const dx = player.pos.x - g.position.x;
  const dz = player.pos.z - g.position.z;
  const d = Math.hypot(dx, dz);

  // he keeps up, but he does not crowd you
  if (d > 4) {
    const k = (dt * 3.6) / d;
    g.position.x += dx * k;
    g.position.z += dz * k;
    pushOut(g.position, 1.1, leroy.y);
  }
  g.rotation.y = Math.atan2(dx, dz);
  g.position.y = leroy.y + Math.abs(Math.sin(game.time * 4)) * 0.09;

  // a man's stride, not a shamble — legs only swing while he is actually going
  if (leroy.model) {
    const swing = d > 4 ? Math.sin(game.time * 6) * 0.6 : 0;
    leroy.model.legL.rotation.x = swing;
    leroy.model.legR.rotation.x = -swing;
  }
  leroy.x = g.position.x;
  leroy.z = g.position.z;

  // anything within arm's reach gets taken apart
  leroy.swingCd -= dt;
  if (leroy.swingCd <= 0) {
    for (const z of [...zombies]) {
      if (z.dying > 0) continue;
      if (z.group.position.distanceTo(g.position) > 4.5) continue;
      leroy.swingCd = 0.8;
      spatter(z.group.position, new THREE.Vector3(0, 1, 0), 12);
      sfx.flesh();
      killZombie(z);
      break;
    }
  }

  // and he walks through anything boarded up, for nothing
  for (const b of barriers) {
    if (b.bought) continue;
    if (Math.hypot(b.x - g.position.x, b.z - g.position.z) > 4) continue;
    b.bought = true;
    mapGroup.remove(b.mesh);
    b.mat.dispose();
    const i = obstacles.indexOf(b.obs);
    if (i !== -1) obstacles.splice(i, 1);
    buildGrid();
    sfx.explosion();
    toast("HE TOOK THE BOARDS OFF");
    if (b.vault) {
      quest.vaultOpen = true;
    }
    break;
  }
}

/* ── the bus ─────────────────────────────────────────────────── */

/*
 * The bus drives the route on its own and carries whatever is standing on it.
 *
 * This is the only thing in the game that moves and can be stood on, and the
 * collision system was built for things that hold still. Rather than make the
 * obstacle grid handle a moving box — which would mean rebuilding the grid
 * every frame — the bus is kept out of it entirely and handled here: if you
 * are within its floor and at its height, you are carried, and the walls are
 * four ordinary boxes that move with it and are tested by hand.
 */
const BUS = {
  W: 3.4, // half width
  D: 7.5, // half length
  FLOOR: 1.05,
  H: 3.2,
  SPEED: 13,
  WAIT: 25, // seconds waiting at a place, so it is worth running for
};

const bus = { group: null, x: 0, z: 0, leg: 0, t: 0, wait: 0, riding: false, seat: null };

function buildBus() {
  if (bus.group) {
    scene.remove(bus.group);
    bus.group = null;
  }
  if (!mapDef?.route) return;

  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x2a3a44, emissive: 0x0e1a20 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2622 });

  const panel = (w, h, d, x, y, z, m = body) => {
    const mesh = new THREE.Mesh(UNIT_BOX, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };

  panel(BUS.W * 2, 0.3, BUS.D * 2, 0, BUS.FLOOR, 0); // the deck you stand on
  panel(0.25, BUS.H, BUS.D * 2, -BUS.W, BUS.FLOOR + BUS.H / 2, 0); // sides
  panel(0.25, BUS.H, BUS.D * 2, BUS.W, BUS.FLOOR + BUS.H / 2, 0);
  panel(BUS.W * 2, BUS.H, 0.25, 0, BUS.FLOOR + BUS.H / 2, -BUS.D); // back
  panel(BUS.W * 2, 1.2, 0.25, 0, BUS.FLOOR + BUS.H - 0.6, BUS.D); // front, open below
  panel(BUS.W * 2 - 0.4, 0.25, BUS.D * 2 - 0.4, 0, BUS.FLOOR + BUS.H, 0); // roof
  panel(BUS.W * 1.7, 1.1, 0.2, 0, BUS.FLOOR + 1.9, BUS.D - 0.1, glass); // windscreen
  for (const side of [-1, 1]) {
    for (const along of [-4.5, -1.5, 1.5, 4.5]) {
      panel(0.18, 1, 2.4, side * BUS.W, BUS.FLOOR + 1.9, along, glass);
    }
    for (const along of [-5, 4.5]) {
      const w = new THREE.Mesh(UNIT_CYL, dark);
      w.scale.set(1.1, 0.5, 1.1);
      w.rotation.z = Math.PI / 2;
      w.position.set(side * BUS.W, 0.8, along);
      g.add(w);
    }
  }

  scene.add(g);
  bus.group = g;
  bus.leg = 0;
  bus.t = 0;
  bus.wait = BUS.WAIT;
  const [sx, sz] = mapDef.route[0];
  bus.x = sx;
  bus.z = sz;
  g.position.set(sx, 0, sz);
}

/** Where the bus is going, and how far along it is. */
function updateBus(dt) {
  if (!bus.group || !mapDef?.route) return;
  const route = mapDef.route;

  const from = route[bus.leg];
  const to = route[(bus.leg + 1) % route.length];
  const legLen = Math.hypot(to[0] - from[0], to[1] - from[1]);

  const wasX = bus.x;
  const wasZ = bus.z;
  const wasRot = bus.group.rotation.y;

  /*
   * Who is aboard is decided against where the bus is *now*, before it moves.
   * Asking afterwards means testing the passenger against a bus that has
   * already driven off, and they fall off the back a fraction at a time.
   */
  const local = busLocal(player.pos.x, player.pos.z);
  /*
   * Getting on is strict and staying on is forgiving. With one threshold, a
   * passenger hovering on the boundary flickers aboard and adrift frame by
   * frame and is left behind a little at a time.
   */
  const slack = bus.riding ? 1.1 : 0;
  const aboard =
    player.alive &&
    Math.abs(local.x) < BUS.W + slack &&
    Math.abs(local.z) < BUS.D + slack &&
    player.pos.y >= BUS.FLOOR - 0.5 &&
    player.pos.y < BUS.FLOOR + BUS.H;

  if (bus.wait > 0) {
    bus.wait -= dt;
  } else {
    bus.t += (BUS.SPEED * dt) / legLen;
    if (bus.t >= 1) {
      bus.t = 0;
      bus.leg = (bus.leg + 1) % route.length;
      if (STOPS.has(bus.leg)) bus.wait = BUS.WAIT;
    }
  }

  bus.x = from[0] + (to[0] - from[0]) * bus.t;
  bus.z = from[1] + (to[1] - from[1]) * bus.t;
  bus.group.position.set(bus.x, 0, bus.z);
  bus.group.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);

  if (aboard) {
    /*
     * Carried. Translating is only half of it: at every stop the bus turns to
     * face the next leg, and a passenger who is moved but not turned stays
     * where they were in the world while the deck swings out from under them.
     * Standing anywhere but dead centre, that walks you off the side at the
     * first corner — which is what "it leaves you behind" was.
     */
    const dRot = bus.group.rotation.y - wasRot;
    if (dRot) yaw -= dRot; // you turn with the bus, so the view does not swing

    /*
     * Put you back where you were standing.
     *
     * Adding the bus's movement to your position each frame looks right and
     * loses ground steadily: anything that touches your position between one
     * frame's carry and the next is a slip that never comes back, and over a
     * leg you slide off the back. Holding the spot in the bus's own frame and
     * rebuilding your world position from it cannot drift, because there is
     * nothing being accumulated.
     */
    const seat = bus.seat ?? busLocal(player.pos.x, player.pos.z);
    const w = busWorld(seat);
    player.pos.x = w.x;
    player.pos.z = w.z;
    if (player.pos.y < BUS.FLOOR) player.pos.y = BUS.FLOOR;
    if (!bus.riding) {
      bus.riding = true;
      toast("ON THE BUS");
    }
    busPushOut(player.pos, PLAYER_R);
  } else if (bus.riding) {
    bus.riding = false;
    bus.seat = null;
    toast("OFF THE BUS");
  }
}

/*
 * Your position in the bus's own frame.
 *
 * Three.js turns local +X to world (cos θ, −sin θ), so going the other way is
 * a rotation by θ and not by −θ. Negating it here reads as obviously right and
 * is wrong, in the same way it was wrong on the booth walls: at right angles
 * the two agree, and on a diagonal the deck ends up ninety degrees from where
 * the bus is. Four of the five legs of this route are diagonal.
 */
function busWorld(l) {
  const a = bus.group?.rotation.y ?? 0;
  return {
    x: bus.x + l.x * Math.cos(a) + l.z * Math.sin(a),
    z: bus.z + -l.x * Math.sin(a) + l.z * Math.cos(a),
  };
}

function busLocal(x, z) {
  const dx = x - bus.x;
  const dz = z - bus.z;
  const a = bus.group?.rotation.y ?? 0;
  return {
    x: dx * Math.cos(a) - dz * Math.sin(a),
    z: dx * Math.sin(a) + dz * Math.cos(a),
  };
}

/*
 * The bus as something solid, tested by hand because it moves.
 *
 * The deck holds you up, the sides and the back are walls you cannot walk
 * through, and the front is open so you can get on. Below deck height the
 * whole shape is solid, so you cannot walk under it either.
 */
function busCollide(pos, radius) {
  if (!bus.group) return null;
  const l = busLocal(pos.x, pos.z);
  if (Math.abs(l.x) > BUS.W + radius || Math.abs(l.z) > BUS.D + radius) return null;
  if (pos.y < BUS.FLOOR - 0.4) return { floor: 0, solid: true };
  return { floor: BUS.FLOOR, solid: false };
}

/*
 * Push you back inside the bus if you have walked into one of its walls. Done
 * in the bus's own frame, where the walls are axis-aligned, then rotated back
 * out — the same trick the static obstacle test uses, except the box moves.
 */
function busPushOut(pos, radius) {
  if (!bus.group) return;
  if (pos.y < BUS.FLOOR - 0.4 || pos.y > BUS.FLOOR + BUS.H) return;

  const l = busLocal(pos.x, pos.z);
  const wallX = BUS.W - radius;
  const backZ = -(BUS.D - radius);

  // only for someone already aboard: it must never shove a passer-by
  if (Math.abs(l.x) > BUS.W || l.z < -BUS.D || l.z > BUS.D) return;

  let dx = 0;
  let dz = 0;
  if (l.x > wallX) dx = wallX - l.x;
  else if (l.x < -wallX) dx = -wallX - l.x;
  if (l.z < backZ) dz = backZ - l.z;

  if (!dx && !dz) return;

  // back into world space
  const a = bus.group.rotation.y;
  pos.x += dx * Math.cos(a) + dz * Math.sin(a);
  pos.z += -dx * Math.sin(a) + dz * Math.cos(a);
}

const spotScratch = new THREE.Vector3();

/** Is there room to stand something of this size here? */
function spotIsClear(x, z, radius) {
  spotScratch.set(x, 0, z);
  for (const o of obstacles) {
    if (o.top <= STEP) continue; // scenery you walk over
    if (o.bottom > 1.5) continue; // an upper floor is not in the way down here
    if (overlapsBox(spotScratch, radius, o)) return false;
  }
  return true;
}

/*
 * The nearest clear spot to where something wants to go. A machine dropped on
 * a fixed mark ends up inside a sofa or halfway through a wall, because the
 * rooms are generated and the mark is not.
 */
function clearNear(x, z, radius = 1.5, reach = 5) {
  if (spotIsClear(x, z, radius)) return [x, z];
  for (let r = 1; r <= reach; r += 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = x + Math.cos(a) * r;
      const cz = z + Math.sin(a) * r;
      if (spotIsClear(cx, cz, radius)) return [cx, cz];
    }
  }
  return [x, z]; // nowhere better; at least it is where it was asked for
}

/*
 * Somewhere clear along a spoke out from the middle. It walks inwards looking
 * for room, but never past `min` — without that floor, a crowded spoke drags
 * something meant to be out in the trees back to the middle of the map.
 */
function clearSpot(angle, from = HALF * 0.5, min = 6) {
  for (let r = from; r > min; r -= 2.5) {
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (spotIsClear(x, z, 1.6)) return [x, z];
  }
  // nothing clear on this spoke — sweep round at the minimum instead
  for (let i = 1; i < 24; i++) {
    const a = angle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.26;
    const r = Math.max(min, from * 0.8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (spotIsClear(x, z, 1.6)) return [x, z];
  }
  return [Math.cos(angle) * from, Math.sin(angle) * from];
}

function addPerkMachine(perk, x, z, y = 0) {
  const body = new THREE.Mesh(
    UNIT_BOX,
    new THREE.MeshLambertMaterial({ color: perk.colour, emissive: perk.colour, emissiveIntensity: 0.85 }),
  );
  body.scale.set(1.3, 2.1, 1);
  body.position.set(x, y + 1.05, z);
  body.castShadow = true;
  mapGroup.add(body);

  obstacles.push({ x, z, hw: 0.7, hd: 0.55, bottom: y, top: y + 2.1, cos: 1, sin: 0 });
  perkMachines.push({ perk, x, z, y });
}

/*
 * Where each one lives.
 *
 *   Speed Cola and Double Tap  — inside the house, in different rooms
 *   Juggernaut                 — a corner of the map, walled in, drawn fresh
 *                                each game so you cannot learn the way
 *   Stamin-Up                  — out among the trees, somewhere different
 *                                every time
 */
function placePerkMachines() {
  perkMachines.length = 0;
  barriers.length = 0;
  wallBuys.length = 0;
  packMachines.length = 0;
  bankTellers.length = 0;
  workbenches.length = 0;
  turbineSockets.length = 0;
  partPickups.length = 0;
  built.clear();
  for (const k of Object.keys(carried)) delete carried[k];
  Object.assign(quest, { powered: false, vaultOpen: false, won: false });
  leroy.alive = false;
  leroy.cell = null;
  leroy.group = null;
  if (game.dm) return; // a free-for-all has no points and no perks

  const perk = (id) => PERKS_FOR_SALE.find((p) => p.id === id);
  const marks = mapDef.marks ?? [];

  // ── the two in the house, the boards round one, and the gun on the wall ──
  for (const m of marks) {
    if (m.kind === "perk") {
      const [px, pz] = clearNear(m.x, m.z, 1.2, 4);
      addPerkMachine(perk(m.id), px, pz);
    }
    if (m.kind === "booth-perk") {
      addPerkMachine(perk(m.id), m.x, m.z);
      booth(m.x, m.z, 0, m.cost, m.r, m.facing);
    }
    if (m.kind === "booth-box") {
      // the box is already up there; the walls go round where it stands
      booth(m.x, m.z, m.y, m.cost, m.r, m.facing, 2.4);
    }
    if (m.kind === "door") addBarrier(m.x, m.z, 0, m.hw, m.hd, m.h, m.cost);
    if (m.kind === "wallbuy") addWallBuy(m.x, m.z, WALL_GUN, WALL_GUN_COST);
  }

  // ── Juggernaut, in one of the four corners, behind a thousand points ──
  const corner = (Math.random() * 4) | 0;
  const ca = Math.PI / 4 + (corner * Math.PI) / 2;
  const [jx, jz] = clearSpot(ca, HALF * 0.78, HALF * 0.55); // a corner, and it stays one
  addPerkMachine(perk("jugg"), jx, jz);
  booth(jx, jz, 0, 1000, 4.2, ca + Math.PI); // the way in faces the middle

  // ── Stamin-Up, loose in the woods ──
  const sa = Math.random() * Math.PI * 2;
  const [sx, sz] = clearSpot(sa, HALF * 0.62, HALF * 0.4); // out in the trees, not by the house
  addPerkMachine(perk("stamin"), sx, sz);

  placeTownWorks();
}

/*
 * Everything the quest runs on. It goes on every map, not just the town —
 * the same machinery reads well anywhere, and a map you cannot finish the
 * quest on would just be the odd one out.
 */
function placeTownWorks() {
  const spoke = (a, r) => clearSpot(a, HALF * r);

  // the Pack-a-Punch, and the socket the turbine goes in beside it
  const [px, pz] = spoke(2.1, 0.4);
  addPackMachine(px, pz);
  const [tx, tz] = clearNear(px + 4, pz, 1.2, 5);
  addTurbineSocket(tx, tz);

  // the bank, and the vault door he takes off for you
  const [bx, bz] = spoke(-1.1, 0.45);
  addBankTeller(bx, bz);
  const vaultA = Math.atan2(bz, bx);
  addBarrier(bx + Math.cos(vaultA) * 3.4, bz + Math.sin(vaultA) * 3.4, 0, 2.2, 0.5, 3, 1500, vaultA + Math.PI / 2);
  barriers[barriers.length - 1].vault = true;

  // two benches, well apart, so parts are worth carrying
  const [w1x, w1z] = spoke(0.5, 0.3);
  addWorkbench(w1x, w1z);
  const [w2x, w2z] = spoke(3.6, 0.55);
  addWorkbench(w2x, w2z);

  /*
   * The prisoner belongs to the buried town and nowhere else. He is the story
   * of that place — a man locked up under a town that went down with him —
   * and putting him on the farm and along the bus route made him set dressing.
   */
  if (game.mapId === "buried") {
    const [lx, lz] = spoke(-2.4, 0.5);
    addLeroyCell(lx, lz);
  }

  for (const [i, def] of BUILDABLES.entries()) scatterParts(def, 9001 + i * 137);
}

/*
 * Four walls round something, three of them solid and the fourth the thing you
 * pay to get through. The way in faces `facing` — towards the middle of the
 * map, or the middle of a room — so you can see what you are buying first.
 *
 * The walls run half a thickness past the corners on purpose. Butted exactly
 * to the corner they leave a slot the width of the boards, and a slot that
 * size is a doorway to anything with a radius under half a metre. That is how
 * you were getting to Juggernaut without paying.
 */
function booth(x, z, y, cost, R, facing, h = 2.8) {
  const T = 0.45; // half the thickness of a wall
  for (let i = 0; i < 4; i++) {
    const a = facing + (i * Math.PI) / 2;
    const wx = x + Math.cos(a) * R;
    const wz = z + Math.sin(a) * R;
    const run = a + Math.PI / 2; // the wall lies across the spoke
    const hw = R + T; // long enough to seal both corners

    if (i === 0) addBarrier(wx, wz, y, hw, T, h, cost, run);
    else orientedSlab(wx, wz, y, hw, T, h, run, 0x6f665b);
  }
}
/** Take a body out of the shootable set without removing it from the world. */
function unregisterZombie(z) {
  for (const part of [z.torso, z.head]) {
    const i = hitboxes.indexOf(part);
    if (i !== -1) hitboxes.splice(i, 1);
  }
}

function removeZombie(z, index) {
  scene.remove(z.group);
  // the box geometry is shared by every piece of every zombie — only the
  // per-zombie materials belong to this one
  for (const m of z.mats) m.dispose();
  for (const part of [z.torso, z.head]) {
    const i = hitboxes.indexOf(part);
    if (i !== -1) hitboxes.splice(i, 1);
  }
  zombies.splice(index, 1);
}

// ── player / game state ──────────────────────────────────────────
const player = {
  pos: new THREE.Vector3(0, 0, 8),
  vel: new THREE.Vector3(),
  vy: 0,
  grounded: true,
  hp: 100,
  maxHp: 100,
  alive: true,
  respawn: 0,
  blind: 0,
  slow: 0,
  lastHit: -99,
  bob: 0,
};

// what you are carrying: two of each, refilled on a wave or a respawn
const EQUIP_LETHAL = {
  frag: { kind: "fuse", fuse: 2.4, radius: 8, damage: 160, colour: 0x39421f, size: 0.17 },
  semtex: { kind: "stick", fuse: 1.6, radius: 7, damage: 175, colour: 0x6a7a2a, size: 0.17 },
  c4: { kind: "remote", radius: 9, damage: 220, colour: 0xb5b1a0, size: 0.2 },
  trip: { kind: "proximity", arm: 1.2, trigger: 3.4, radius: 7, damage: 185, colour: 0x8a2f2f, size: 0.22 },
  tomahawk: { kind: "impact", radius: 3, damage: 400, colour: 0x8a8f96, size: 0.18 },
};

const EQUIP_TACTICAL = {
  flash: { fuse: 1.6, radius: 16, effect: "blind", time: 4.5, colour: 0xd8d2b4 },
  concussion: { fuse: 1.4, radius: 12, effect: "slow", time: 3.5, colour: 0x2f5f8a },
  smoke: { fuse: 1.2, radius: 9, effect: "smoke", time: 9, colour: 0x9aa0a6 },
  decoy: { fuse: 0.6, radius: 30, effect: "decoy", time: 6, colour: 0xc9a227 },
  shock: { fuse: 1.4, radius: 10, effect: "stun", time: 3, colour: 0x4ad2ff },
};

const kit = { lethal: 2, tactical: 2 };

// the five custom classes, needed by the HUD before the menu code runs
let mpClasses = loadClasses();
let mpIndex = 0;

const game = {
  running: false,
  over: false,
  time: 0,
  wave: 0,
  kills: 0,
  toSpawn: 0,
  spawnTimer: 0,
  intermission: 0,
  weapon: 0,
  slots: startingSlots(),
  points: 0,
  dm: false,
  revivesUsed: 0,
  score: 0,
  burstLeft: 0,
  burstTimer: 0,
  cooldown: 0,
  reloadTimer: 0,
  recoil: 0,
  triggerHeld: false,
  firedThisPress: false,
  queued: 0,
  diff: DIFFICULTIES[1],
  mapId: MAPS[0].id,
};

const keys = new Set();

let isRunning = false; // set by double-tapping W, cleared when W is released
let lastWPress = -99;
let wHeldSince = -99; // hold W long enough and you break into a run anyway
const HOLD_TO_RUN = 0.55;
let crouching = false;
let crouchHeld = false; // the touch crouch toggle

const DEVICE_KEY = "za:device";
let touchMode = false;

// On a tablet we drive the camera ourselves — there is no pointer to lock.
let yaw = 0;
let pitch = 0;
const move2d = { x: 0, y: 0 };
const LOOK_SENS = 0.0032;
let eyeHeight = EYE; // eased so dropping down is not a jump cut

// ── hud ──────────────────────────────────────────────────────────
function renderLoadout() {
  ui.loadout.innerHTML = "";
  game.slots.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "slot" + (i === game.weapon ? " active" : "");
    el.textContent = `${i + 1} ${weaponFor(s).name}`;
    ui.loadout.appendChild(el);
  });
}

function syncHud() {
  const w = curWeapon();
  ui.healthBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  ui.healthBar.classList.toggle("low", player.hp <= player.maxHp * 0.35);
  ui.healthText.textContent = Math.max(0, Math.round(player.hp));
  ui.weaponName.textContent = w.name;
  ui.mag.textContent = w.melee ? "∞" : curSlot().mag;
  ui.mag.classList.toggle("empty", !w.melee && curSlot().mag === 0);
  ui.reserve.textContent = w.melee ? "" : `/ ${curSlot().reserve}`;
  ui.points.textContent = game.points;
  // no equipment in zombies, so nothing to show or press
  ui.equip.style.display = game.dm ? "" : "none";
  $("t-lethal")?.classList.toggle("hidden", !game.dm);
  $("t-tactical")?.classList.toggle("hidden", !game.dm);

  const carry = equipChoice();
  ui.equip.textContent =
    `Z ${carry.lethal ? kit.lethal : "—"}  ·  X ${carry.tactical ? kit.tactical : "—"}`;
  ui.reloading.classList.toggle("hidden", game.reloadTimer <= 0);
  ui.wave.textContent = game.wave;
  ui.kills.textContent = game.kills;
  ui.remaining.textContent = zombies.filter(stillFighting).length + game.toSpawn;
}

let hudAcc = 0;
let toastTimer = null;
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2200);
}

let bannerTimer = null;
function banner(text, ms = 1800) {
  ui.banner.textContent = text;
  ui.banner.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.remove("show"), ms);
}

// ── shooting ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.far = 180;
const shotDir = new THREE.Vector3();
const camDir = new THREE.Vector3();
const muzzlePoint = new THREE.Vector3();

function fire() {
  const w = curWeapon();
  if (game.reloadTimer > 0 || game.cooldown > 0) return;
  if (w.melee) return swing(w);

  if (curSlot().mag <= 0) {
    sfx.dryFire();
    game.cooldown = 0.22;
    startReload();
    return;
  }

  game.cooldown = w.rpm / (powerActive("frenzy") ? powerAmount("frenzy") : 1);
  shootOnce(w);

  // burst weapons keep firing on their own for the rest of the burst
  if (w.burst > 1) {
    game.burstLeft = w.burst - 1;
    game.burstTimer = w.burstDelay ?? 0.075;
  }
}

function shootOnce(w) {
  if (!powerActive("ammo")) curSlot().mag--;
  if (curSlot().mag < 0) {
    curSlot().mag = 0;
    return;
  }
  // shouldering it steadies the gun as well as narrowing the cone
  game.recoil = powerActive("steady") ? 0 : w.recoil * (aiming() ? 0.55 : 1);
  sfx.shot(w);

  if (w.projectile) {
    camera.getWorldDirection(camDir);
    launchProjectile(w);
    muzzleLight.intensity = 7;
    syncHud();
    return;
  }

  muzzleLight.intensity = 7;
  ui.crosshair.classList.add("bloom");
  setTimeout(() => ui.crosshair.classList.remove("bloom"), 70);

  camera.getWorldDirection(camDir);
  muzzlePoint.copy(camera.position).addScaledVector(camDir, 0.6);

  const spreadNow = powerActive("steady")
    ? 0
    : w.spread * (aiming() ? AIM_SPREAD : 1);
  let hitAny = false;

  for (let p = 0; p < w.pellets; p++) {
    shotDir
      .copy(camDir)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spreadNow * 2,
          (Math.random() - 0.5) * spreadNow * 2,
          (Math.random() - 0.5) * spreadNow * 2,
        ),
      )
      .normalize();

    raycaster.set(camera.position, shotDir);

    const zHits = raycaster.intersectObjects(hitboxes, false);
    const wHits = raycaster.intersectObjects(blockers, false);
    const zDist = zHits.length ? zHits[0].distance : Infinity;
    const wDist = wHits.length ? wHits[0].distance : Infinity;

    if (zDist < wDist) {
      const hit = zHits[0];
      const bot = hit.object.userData.bot;
      const z = hit.object.userData.zombie;
      const head = hit.object.userData.isHead === true;
      if (bot && bot.alive) {
        hitAny = true;
        damageBot(bot, w.damage * (head ? w.headMult : 1), head, shotDir, hit.point);
      } else if (z && !z.dying) {
        hitAny = true;
        addPoints(PTS_HIT);
        // some weapons simply erase anything until a given wave
        const lethal = w.oneShotUntil && game.wave < w.oneShotUntil;
        const dmg = lethal ? z.maxHp : w.damage * (head ? w.headMult : 1);
        damageZombie(z, dmg, head, shotDir, hit.point);
      }
      tracer(muzzlePoint, hit.point);
    } else if (wHits.length) {
      tracer(muzzlePoint, wHits[0].point);
    } else {
      tracer(
        muzzlePoint,
        muzzlePoint.clone().addScaledVector(shotDir, raycaster.far),
      );
    }
  }

  if (hitAny) {
    ui.crosshair.classList.add("hit");
    setTimeout(() => ui.crosshair.classList.remove("hit"), 110);
  }
  syncHud();
}

function addPoints(n) {
  game.points += n * (bonusActive("points") ? 2 : 1);
  syncHud();
}

/* ── power-ups ───────────────────────────────────────────────── */

const DROP_CHANCE = 0.04; // per kill
const BONUS_TIME = 30;
const DROP_LIFE = 22; // how long it waits on the ground

const START_POINTS = 500; // enough to be doing something on the first wave
const NUKE_POINTS = 400; // what clearing the map with one is worth, and no more

const DROP_TYPES = {
  points: { label: "DOUBLE POINTS", colour: 0xffc94a },
  instakill: { label: "INSTANT KILL", colour: 0xff4a4a },
  maxammo: { label: "MAX AMMO", colour: 0x4aa3ff },
  nuke: { label: "NUKE", colour: 0x7cf25a },
};

const drops = [];
const bonus = { points: 0, instakill: 0 }; // game.time each expires at

const bonusActive = (id) => game.time < bonus[id];

function maybeDrop(pos) {
  if (Math.random() > DROP_CHANCE) return;
  const kind = pick(Object.keys(DROP_TYPES));
  const def = DROP_TYPES[kind];

  const mesh = new THREE.Mesh(
    UNIT_BOX,
    new THREE.MeshBasicMaterial({ color: def.colour }),
  );
  mesh.scale.set(0.55, 0.55, 0.55);
  mesh.position.set(pos.x, 0.9, pos.z);
  scene.add(mesh);

  drops.push({ kind, mesh, base: pos.y + 0.9, life: DROP_LIFE });
}

function collect(d) {
  const def = DROP_TYPES[d.kind];

  if (d.kind === "maxammo") {
    for (const s of game.slots) {
      const w = weaponFor(s);
      s.mag = w.mag;
      s.reserve = w.reserve;
    }
    game.reloadTimer = 0;
  } else if (d.kind === "nuke") {
    nukeTheMap(); // says its own piece
    return;
  } else {
    bonus[d.kind] = game.time + BONUS_TIME;
  }

  sfx.unlock();
  toast(def.label);
  syncHud();
}

function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life -= dt;
    d.mesh.rotation.y += dt * 2.2;
    d.mesh.rotation.x += dt * 1.1;
    d.mesh.position.y = d.base + Math.sin(game.time * 3) * 0.18;
    // blink out in the last three seconds
    d.mesh.visible = d.life > 3 || Math.sin(game.time * 18) > 0;

    const dx = d.mesh.position.x - player.pos.x;
    const dz = d.mesh.position.z - player.pos.z;
    const taken = dx * dx + dz * dz < 4 && Math.abs(d.base - player.pos.y) < 2.4;

    if (taken || d.life <= 0) {
      if (taken) collect(d);
      scene.remove(d.mesh);
      d.mesh.material.dispose();
      drops.splice(i, 1);
    }
  }
}

function renderBonuses() {
  const live = Object.keys(bonus).filter((k) => bonusActive(k));
  ui.bonus.innerHTML = live
    .map(
      (k) =>
        `<span style="color:#${DROP_TYPES[k].colour.toString(16).padStart(6, "0")}">
           ${DROP_TYPES[k].label} ${Math.ceil(bonus[k] - game.time)}s</span>`,
    )
    .join("");
}

/* ── projectiles and blasts ──────────────────────────────────── */

const projectiles = [];
const blasts = [];
const boomGeo = new THREE.SphereGeometry(1, 14, 10);

function launchProjectile(w) {
  const p = w.projectile;
  const mesh = new THREE.Mesh(
    UNIT_BOX,
    new THREE.MeshBasicMaterial({ color: p.colour }),
  );
  mesh.scale.set(0.22, 0.22, 0.5);
  mesh.position.copy(camera.position).addScaledVector(camDir, 0.8);
  scene.add(mesh);

  /*
   * A rocket in flight lights its own way, but it must not eat the map's
   * budget — that is spent once and never given back, and a few rockets would
   * leave the braziers dark for the rest of the run. Only the first couple in
   * the air carry one, which is as many as you can follow anyway.
   */
  if (projectiles.length < 2) {
    mesh.add(new THREE.PointLight(p.colour, 2.2, 8, 2));
  }

  projectiles.push({
    mesh,
    vel: camDir.clone().multiplyScalar(p.speed),
    gravity: p.gravity,
    radius: p.radius,
    damage: p.damage,
    life: 6,
  });
}

function explode(pos, radius, dmg) {
  const shell = new THREE.Mesh(
    boomGeo,
    new THREE.MeshBasicMaterial({ color: 0xffb057, transparent: true, opacity: 0.7 }),
  );
  shell.position.copy(pos);
  shell.scale.setScalar(0.4);
  scene.add(shell);

  const light = new THREE.PointLight(0xffa050, 26, radius * 3, 2);
  light.position.copy(pos);
  scene.add(light);
  blasts.push({ shell, light, t: 0, radius });

  spatter(pos, new THREE.Vector3(0, 1, 0), 18, dirtMat);
  sfx.explosion?.(pos.distanceTo(player.pos));

  for (const z of zombies) {
    if (z.dying > 0) continue;
    const d = z.group.position.distanceTo(pos);
    if (d > radius) continue;
    addPoints(PTS_HIT);
    damageZombie(z, dmg * (1 - d / radius), false, new THREE.Vector3(0, 1, 0), z.group.position);
  }

  // your own rocket will hurt you
  const own = player.pos.distanceTo(pos);
  if (own < radius) hurtPlayer(dmg * (1 - own / radius) * 0.35);
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.vel.y -= p.gravity * dt;

    const stepLen = p.vel.length() * dt;
    raycaster.set(p.mesh.position, p.vel.clone().normalize());
    raycaster.far = stepLen + 0.5;
    const hits = [
      ...raycaster.intersectObjects(blockers, false),
      ...raycaster.intersectObjects(hitboxes, false),
    ].sort((a, b) => a.distance - b.distance);
    raycaster.far = 180;

    const done = hits.length || p.life <= 0 || p.mesh.position.y < -1;
    if (done) {
      explode(hits.length ? hits[0].point : p.mesh.position, p.radius, p.damage);
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      projectiles.splice(i, 1);
      continue;
    }

    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
  }

  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.t += dt;
    const k = Math.min(1, b.t / 0.4);
    b.shell.scale.setScalar(0.4 + k * b.radius);
    b.shell.material.opacity = 0.7 * (1 - k);
    b.light.intensity = 26 * (1 - k);
    if (k >= 1) {
      scene.remove(b.shell, b.light);
      b.shell.material.dispose();
      blasts.splice(i, 1);
    }
  }
}

/* ── mystery box ─────────────────────────────────────────────── */

let nearBox = null;

let nearPerk = null;
let nearThing = null; // whatever the F key would act on right now

/*
 * Everything you can walk up to and buy, nearest first: the box, a perk
 * machine, a boarded doorway, a gun on the wall. One prompt, one key.
 */
function thingInReach() {
  let best = null;
  const consider = (t, x, z, y, reach) => {
    const dx = x - player.pos.x;
    const dz = z - player.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > reach * reach) return;
    if (Math.abs(y - player.pos.y) > 2.4) return;
    if (!best || d2 < best.d2) best = { ...t, d2 };
  };

  for (const b of mysteryBoxes) consider({ kind: "box", box: b }, b.x, b.z, b.y, 3);
  for (const m of perkMachines) consider({ kind: "perk", machine: m }, m.x, m.z, m.y ?? 0, 3);
  for (const w of wallBuys) consider({ kind: "wall", wall: w }, w.x, w.z, w.y, 3);
  for (const b of barriers) {
    if (!b.bought) consider({ kind: "door", barrier: b }, b.x, b.z, b.y, 3.4);
  }
  for (const m of packMachines) consider({ kind: "pack", pack: m }, m.x, m.z, m.y, 3.4);
  for (const t of bankTellers) consider({ kind: "bank", teller: t }, t.x, t.z, t.y, 3.2);
  for (const w of workbenches) consider({ kind: "bench", bench: w }, w.x, w.z, w.y, 3.2);
  for (const s of turbineSockets) {
    if (!s.live) consider({ kind: "socket", socket: s }, s.x, s.z, s.y, 3.2);
  }
  if (leroy.cell && !leroy.alive) {
    consider({ kind: "leroy" }, leroy.cell.x, leroy.cell.z + 1.6, leroy.cell.y, 3.4);
  }
  return best;
}

/** What the prompt says, and what F does, for everything you can walk up to. */
function describeThing(t) {
  if (t.kind === "box") return { cost: BOX_COST, line: `MYSTERY BOX — ${BOX_COST} POINTS` };
  if (t.kind === "perk") {
    const p = t.machine.perk;
    return hasPerk(p.id)
      ? { cost: 0, owned: true, line: `${p.name.toUpperCase()} — ALREADY YOURS` }
      : { cost: p.cost, line: `${p.name.toUpperCase()} — ${p.cost} POINTS · ${p.desc}` };
  }
  if (t.kind === "door") return { cost: t.barrier.cost, line: `CLEAR THE WAY — ${t.barrier.cost} POINTS` };
  if (t.kind === "wall") {
    const held = game.slots.some((s) => s.id === t.wall.weaponId);
    const cost = held ? Math.round(t.wall.cost * 0.5) : t.wall.cost;
    return { cost, line: `${t.wall.name.toUpperCase()} — ${cost} POINTS${held ? " · AMMO" : ""}` };
  }
  if (t.kind === "pack") {
    if (!quest.powered) return { cost: 0, owned: true, line: "PACK-A-PUNCH — NO POWER" };
    const packed = !!curSlot().up;
    const cost = packed ? PAP_REFILL : PAP_COST;
    return { cost, line: `PACK-A-PUNCH — ${cost} POINTS${packed ? " · AMMO" : ""}` };
  }
  if (t.kind === "bank") {
    return {
      cost: 0,
      keys: "F/C",
      line: `BANK — F PUTS ${BANK_STEP} IN · C TAKES ${BANK_STEP} OUT · ${bank.points} HELD`,
    };
  }
  if (t.kind === "bench") {
    const ready = benchReady();
    return ready
      ? { cost: 0, line: `BUILD THE ${ready.name.toUpperCase()}` }
      : { cost: 0, owned: true, line: `WORKBENCH — ${carriedLine() || "NO PARTS YET"}` };
  }
  if (t.kind === "socket") {
    return built.has("turbine")
      ? { cost: 0, line: "SET THE TURBINE DOWN" }
      : { cost: 0, owned: true, line: "TURBINE SOCKET — NOTHING TO PUT IN IT" };
  }
  if (t.kind === "leroy") return { cost: LEROY_COST, line: `PAY OFF THE LOCK — ${LEROY_COST} POINTS` };
  return { cost: 0, line: "" };
}

function actOnThing(t) {
  if (t.kind === "perk") return buyPerk(t.machine.perk);
  if (t.kind === "door") return buyBarrier(t.barrier);
  if (t.kind === "wall") return buyWallGun(t.wall);
  if (t.kind === "pack") return packCurrentWeapon();
  if (t.kind === "bank") return useBank(false); // F puts money in; C takes it out
  if (t.kind === "bench") return buildAtBench();
  if (t.kind === "socket") return placeTurbine(t.socket);
  if (t.kind === "leroy") return freeLeroy();
  return null;
}

function buyPerk(perk) {
  if (hasPerk(perk.id)) {
    toast("YOU ALREADY HAVE THAT");
    return;
  }
  if (game.points < perk.cost) {
    sfx.dryFire();
    return;
  }
  game.points -= perk.cost;
  ownedPerks.add(perk.id);

  if (perk.id === "jugg") {
    player.maxHp = 200;
    player.hp = player.maxHp; // the bottle heals you as it doubles you
  }

  sfx.unlock();
  toast(`${perk.name.toUpperCase()} — ${perk.desc.toUpperCase()}`);
  syncHud();
}

function updateBoxPrompt() {
  const live = game.running && !game.over;
  nearThing = live ? thingInReach() : null;
  // kept for anything still reading them
  nearBox = nearThing?.kind === "box" ? nearThing.box : null;
  nearPerk = nearThing?.kind === "perk" ? nearThing.machine : null;

  const el = ui.prompt;
  if (!nearThing) {
    el.classList.add("hidden");
    return;
  }

  const { cost, line, owned, keys } = describeThing(nearThing);
  const affordable = game.points >= cost;
  const key = keys ?? "F";
  if (touchMode) $("t-bank")?.classList.toggle("hidden", nearThing.kind !== "bank");
  el.classList.remove("hidden");
  el.classList.toggle("poor", !owned && !affordable);

  if (owned) el.innerHTML = `<b>✓</b>${line}`;
  else if (affordable) el.innerHTML = `<b>${key}</b>${line}`;
  else el.innerHTML = `<b>${key}</b>NEED ${cost - game.points} MORE POINTS`;
}

function useBox() {
  if (!nearThing) return;
  if (nearThing.kind !== "box") return actOnThing(nearThing);
  if (!nearBox) return;
  if (game.points < BOX_COST) {
    sfx.dryFire();
    return;
  }

  game.points -= BOX_COST;
  grantFromBox();
}

/** What the box actually hands over, separated so it can be exercised alone. */
function grantFromBox() {
  const id = BOX_POOL[(Math.random() * BOX_POOL.length) | 0];
  const w = weaponById(id);

  // it replaces the gun in your hand, never the knife
  const target = curWeapon().melee ? 0 : game.weapon;
  viewmodels[game.slots[target].id].visible = false;
  game.slots[target] = { id, mag: w.mag, reserve: w.reserve };
  game.weapon = target;
  viewmodels[id].visible = true;

  game.reloadTimer = 0;
  game.cooldown = 0.4;
  sfx.unlock();
  toast(`${w.name.toUpperCase()}`);
  renderLoadout();
  syncHud();
  // the jet gun comes out of the box now rather than off a workbench
  if (id === "jetgun") {
    banner("JET GUN", 2000);
  }
}

/*
 * The knife. Short reach, no ammo, and its damage is derived from the wave
 * so it always takes exactly N hits on wave N — one on the first wave, two
 * on the second, and so on. Killing with it pays far better than shooting.
 */
function swing(w) {
  game.cooldown = w.rpm;
  game.recoil = w.recoil;
  sfx.shot(w);

  camera.getWorldDirection(camDir);
  raycaster.set(camera.position, camDir);
  const hits = raycaster.intersectObjects(hitboxes, false);

  if (hits.length && hits[0].distance <= w.range) {
    const bot = hits[0].object.userData.bot;
    if (bot && bot.alive) {
      ui.crosshair.classList.add("hit");
      setTimeout(() => ui.crosshair.classList.remove("hit"), 110);
      damageBot(bot, 200, false, camDir, hits[0].point);
      syncHud();
      return;
    }
    const z = hits[0].object.userData.zombie;
    if (z && !z.dying) {
      ui.crosshair.classList.add("hit");
      setTimeout(() => ui.crosshair.classList.remove("hit"), 110);
      addPoints(PTS_HIT);
      z.knifed = true; // remember what finished it, for the bonus
      damageZombie(z, z.maxHp / game.wave, false, camDir, hits[0].point);
      z.knifed = false;
    }
  }
  syncHud();
}

function killZombie(z) {
  if (z.dying > 0) return;
  if (powerActive("vamp")) player.hp = Math.min(player.maxHp + 50, player.hp + powerAmount("vamp"));
  z.dying = 0.001;
  addPoints(z.knifed ? PTS_KNIFE_KILL : PTS_KILL);
  // A Reviver is only down. It pays out — the kill, the drop, the ammo —
  // when it is finished off, not every time it falls over.
  if (z.kind === "reviver" && !z.finished) return;
  game.kills++;
  maybeDrop(z.group.position);
  curSlot().reserve = Math.min(400, curSlot().reserve + curWeapon().pickup);
  trimCorpses();
}

function damageZombie(z, amount, head, dir, point) {
  // shooting a Reviver while it is down is the only way to keep it down
  if (z.dying > 0 && z.kind === "reviver" && !z.finished) {
    z.finished = true;
    z.dying = CORPSE_TIME; // skip straight to fading away
    unregisterZombie(z); // and it is scenery now, not a target
    spatter(point, dir, 12);
    sfx.headshot();
    addPoints(PTS_KILL);
    game.kills++;
    maybeDrop(z.group.position);
    curSlot().reserve = Math.min(400, curSlot().reserve + curWeapon().pickup);
    trimCorpses();
    return;
  }
  if (z.dying > 0) return; // a body cannot be killed twice
  z.hp -= bonusActive("instakill") ? z.maxHp : amount * (hasPerk("dtap") ? 2 : 1) * (powerActive("damage") ? powerAmount("damage") : 1);
  z.flash = 1;
  spatter(point, dir, head ? 14 : 7);
  head ? sfx.headshot() : sfx.flesh();
  if (z.hp <= 0) killZombie(z);
}

/* ── skin powers ─────────────────────────────────────────────── */

const POWER_COOLDOWN = 60; // seconds between uses, not once a wave

/*
 * A power is several effects at once — two on the lower rarities, three at the
 * top — so what is running is a set, not a single id. `live` maps each effect
 * to its number for as long as the power lasts.
 */
const power = { live: {}, until: 0, readyAt: 0 };
const powerReady = () => game.time >= power.readyAt;

const powerActive = (id) => game.time < power.until && id in power.live;
const powerAmount = (id) => power.live[id] ?? 0;

function resetPower() {
  power.live = {};
  power.until = 0;
  power.readyAt = 0;
  updatePowerHud();
}

function updatePowerHud() {
  const el = $("power-btn");
  if (!game.running && !game.over) {
    el.classList.add("hidden");
    return;
  }
  const p = skinById(wallet.equipped).power;
  const left = Math.max(0, Math.ceil(power.readyAt - game.time));
  const live = power.id && game.time < power.until;

  el.classList.remove("hidden");
  el.querySelector(".pn").textContent = !p
    ? "NO POWER"
    : left > 0 && !live
      ? `${p.name} · ${left}s`
      : p.name;

  el.classList.toggle("active", !!live);
  el.classList.toggle("ready", !!p && left === 0);
  el.classList.toggle("spent", !p || (left > 0 && !live));
}

function activatePower() {
  if (!game.running || game.over) return;

  const p = skinById(wallet.equipped).power;
  if (!p) {
    toast("THIS SKIN HAS NO POWER");
    sfx.dryFire();
    return;
  }
  if (!powerReady()) {
    toast(`${Math.ceil(power.readyAt - game.time)}s UNTIL READY`);
    sfx.dryFire();
    return;
  }

  power.readyAt = game.time + POWER_COOLDOWN;
  power.live = {};
  for (const part of p.parts) power.live[part.effect] = part.amount;
  power.until = game.time + p.dur;

  for (const part of p.parts) applyPowerPart(part);

  sfx.unlock();
  toast(p.name.toUpperCase());
  syncHud();
  updatePowerHud();
}

/* ── the minimap ─────────────────────────────────────────────── */

/*
 * A dot for every zombie on its feet, and you in the middle facing up. It is
 * deliberately not a map of the place — no walls, no buildings — because what
 * you want from a glance is which way they are coming from, and a drawing of
 * the town would bury that under detail.
 *
 * Drawn at 8 Hz, not every frame: it is a canvas, not the game, and nobody can
 * see the difference.
 */
const MINIMAP_RANGE = 55; // how far out it shows, in world units
let miniAt = 0;

function drawMinimap() {
  const cv = ui.minimap;
  if (!cv) return;
  const show = game.running && !game.over && !inLobby;
  cv.style.display = show ? "block" : "none";
  if (!show) return;

  const ctx = cv.getContext("2d");
  const R = cv.width / 2;
  ctx.clearRect(0, 0, cv.width, cv.height);

  /*
   * The dial holds still and the arrow turns.
   *
   * The other way round — rotating everything so what you are facing is always
   * up — means the whole picture swings every time you look about, which is
   * exactly when you are trying to read it. A fixed map you can learn; a
   * spinning one you cannot.
   */
  const facing = Math.atan2(camDir.x, camDir.z);
  const place = (x, z) => {
    const dx = x - player.pos.x;
    const dz = z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > MINIMAP_RANGE) return null;
    const r = (d / MINIMAP_RANGE) * (R - 8);
    const a = Math.atan2(dx, dz);
    return [R + Math.sin(a) * r, R - Math.cos(a) * r];
  };

  const dot = (x, z, colour, size) => {
    const at = place(x, z);
    if (!at) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(at[0], at[1], size, 0, Math.PI * 2);
    ctx.fill();
  };

  // the rings, so distance reads at a glance
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  for (const k of [0.33, 0.66]) {
    ctx.beginPath();
    ctx.arc(R, R, (R - 8) * k, 0, Math.PI * 2);
    ctx.stroke();
  }

  // what is worth walking to, under the zombies rather than over them
  for (const m of perkMachines) dot(m.x, m.z, "rgba(95,215,122,0.75)", 2.5);
  for (const b of mysteryBoxes) dot(b.x, b.z, "rgba(255,180,60,0.85)", 3);
  for (const p of partPickups) if (!p.taken) dot(p.x, p.z, "rgba(111,211,255,0.8)", 2.5);
  for (const m of packMachines) dot(m.x, m.z, "rgba(63,143,90,0.9)", 3);
  for (const t of bankTellers) dot(t.x, t.z, "rgba(201,162,39,0.9)", 3);

  // the zombies, which is what it is for. A boss gets a bigger dot.
  for (const z of zombies) {
    if (!stillFighting(z)) continue;
    const boss = ZOMBIE_TYPES[z.kind]?.boss;
    dot(z.group.position.x, z.group.position.z, boss ? "#ff9d3b" : "#ff4a4a", boss ? 4 : 2.6);
  }
  if (leroy.alive) dot(leroy.x, leroy.z, "#6fd3ff", 4);

  /*
   * And you, pointing the way you are looking. The dial is fixed, so this is
   * the only thing that turns — the previous version stopped the map spinning
   * but left the arrow stuck pointing up, which made it look like you were
   * always facing north.
   */
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(facing);
  ctx.translate(-R, -R);
  ctx.fillStyle = "#e8efe6";
  ctx.beginPath();
  ctx.moveTo(R, R - 6);
  ctx.lineTo(R - 4.5, R + 5);
  ctx.lineTo(R + 4.5, R + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Everything a power does the moment it is pressed. */
function applyPowerPart(part) {
  const { effect, amount } = part;

  if (effect === "heal") player.hp = Math.min(player.maxHp + 50, player.hp + amount);

  if (effect === "refill") {
    for (const s of game.slots) {
      const w = weaponFor(s);
      s.mag = w.mag;
      s.reserve = w.reserve;
    }
    game.reloadTimer = 0;
  }

  if (effect === "points") bonus.points = Math.max(bonus.points, game.time + part.dur);

  if (effect === "decoy") {
    lure.x = player.pos.x;
    lure.z = player.pos.z;
    lure.until = game.time + part.dur;
  }

  // A shove, and a much heavier one that reaches further.
  if (effect === "shock" || effect === "blast") {
    const range = effect === "blast" ? 20 : 14;
    const shove = effect === "blast" ? 9 : 5;
    for (const z of [...zombies]) {
      if (z.dying > 0) continue;
      const dx = z.group.position.x - player.pos.x;
      const dz = z.group.position.z - player.pos.z;
      const d = Math.max(0.4, Math.hypot(dx, dz));
      if (d > range) continue;
      z.hp -= amount * (1 - d / range);
      z.flash = 1;
      z.group.position.x += (dx / d) * shove;
      z.group.position.z += (dz / d) * shove;
      spatter(z.group.position, new THREE.Vector3(0, 1, 0), effect === "blast" ? 10 : 6);
      if (z.hp <= 0) killZombie(z);
    }
    if (effect === "blast") sfx.explosion();
  }

  if (effect === "nuke") nukeTheMap();
}

/*
 * Everything on the map dies at once. Worth four hundred points and no more,
 * however many were standing — it buys you the room, not the score.
 */
function nukeTheMap() {
  let killed = 0;
  const before = game.points;
  for (const z of [...zombies]) {
    if (z.dying > 0 && !(z.kind === "reviver" && !z.finished)) continue;
    if (z.kind === "reviver") z.finished = true;
    killZombie(z);
    killed++;
  }
  game.points = before + NUKE_POINTS;
  ui.flash.style.opacity = "0.8";
  setTimeout(() => (ui.flash.style.opacity = "0"), 220);
  sfx.explosion();
  banner("NUKE", 1800);
  toast(`${killed} DOWN · +${NUKE_POINTS} POINTS`);
  syncHud();
}

function startReload() {
  const w = curWeapon();
  if (w.melee) return; // nothing to load
  if (game.reloadTimer > 0 || curSlot().mag >= w.mag || curSlot().reserve <= 0) return;
  game.reloadTimer = w.reload * (hasPerk("speed") ? 0.5 : 1);
  sfx.reload();
  syncHud();
}

function finishReload() {
  const w = curWeapon();
  const need = w.mag - curSlot().mag;
  const take = Math.min(need, curSlot().reserve);
  curSlot().mag += take;
  curSlot().reserve -= take;
  syncHud();
}

function switchWeapon(index) {
  if (!game.slots[index] || index === game.weapon) return;
  viewmodels[curSlot().id].visible = false;
  game.weapon = index;
  viewmodels[curSlot().id].visible = true;
  game.reloadTimer = 0;
  game.cooldown = 0.25;
  sfx.swap();
  renderLoadout();
  syncHud();
}

// ── waves ────────────────────────────────────────────────────────
function startWave(n) {
  game.wave = n;
  game.toSpawn = Math.round((5 + n * 3) * game.diff.count);
  game.spawnTimer = 0;
  banner(`WAVE ${n}`);
  syncHud();
}

// ── movement + collision ─────────────────────────────────────────
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();

function movePlayer(dt) {
  if (touchMode) camera.rotation.set(pitch, yaw, 0, "YXZ");
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (touchMode) {
    wish.addScaledVector(forward, -move2d.y);
    wish.addScaledVector(right, move2d.x);
    isRunning = -move2d.y > 0.85;
  }
  if (keys.has("KeyW")) wish.add(forward);
  if (keys.has("KeyS")) wish.sub(forward);
  if (keys.has("KeyD")) wish.add(right);
  if (keys.has("KeyA")) wish.sub(right);

  // Walking matches a shambling zombie, so a crowd genuinely closes on you.
  // Running is the double-tap on W (Shift works too) and is the only way out.
  const moving = wish.lengthSq() > 0;
  crouching = touchMode
    ? crouchHeld
    : keys.has("ShiftLeft") || keys.has("ShiftRight");

  // Double-tapping W starts a run instantly; simply holding it for half a
  // second does too, so a run can never be lost mid-fight. Firing has no
  // effect on either — you can shoot the whole way.
  if (keys.has("KeyW") && game.time - wHeldSince > HOLD_TO_RUN) isRunning = true;
  const running = !crouching && isRunning;
  const speed =
    (crouching ? CROUCH_SPEED : running ? RUN_SPEED : WALK_SPEED) *
    (powerActive("sprint") ? powerAmount("sprint") : 1) *
    (player.slow > 0 ? 0.45 : 1) *
    (hasPerk("stamin") ? 1.5 : 1) *
    (aiming() ? AIM_WALK : 1); // you walk it down while you are on the sights

  if (moving) wish.normalize().multiplyScalar(speed);

  // smooth acceleration — instant velocity feels slippery
  player.vel.lerp(wish, Math.min(1, dt * 14));
  player.pos.addScaledVector(player.vel, dt);

  // vertical
  player.vy -= GRAVITY * dt;
  const wasY = player.pos.y;
  player.pos.y += player.vy * dt;

  if (player.vy > 0) {
    const roof = ceilingAt(player.pos, PLAYER_R, wasY);
    if (player.pos.y + EYE + 0.15 > roof) {
      player.pos.y = Math.max(wasY, roof - EYE - 0.15);
      player.vy = 0;
    }
  }

  // arena bounds
  const limit = HALF - 0.8;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -limit, limit);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -limit, limit);

  // only things taller than the feet block you — the rest you land on
  pushOut(player.pos, PLAYER_R, player.pos.y);
  /*
   * ...and then the bus puts you back. Driving past a building, the static
   * push-out was shoving passengers sideways through the bus wall and off the
   * deck, which is the "it leaves you behind between the houses" case: you
   * were not left behind, you were pushed out of it.
   */
  if (bus.riding) {
    busPushOut(player.pos, PLAYER_R);
    // wherever you have walked to on the deck is where you are standing now
    bus.seat = busLocal(player.pos.x, player.pos.z);
  }

  /*
   * The bus deck, which the obstacle grid knows nothing about because it
   * moves. Whichever is higher — the ground or the deck — is what you are
   * standing on.
   */
  const onBus = busCollide(player.pos, PLAYER_R);
  const floorY = Math.max(
    groundHeightAt(player.pos, PLAYER_R, player.pos.y),
    onBus && !onBus.blocked ? onBus.floor : 0,
  );
  if (player.pos.y <= floorY) {
    player.pos.y = floorY;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  // head bob while grounded and moving
  const speedNow = player.vel.length();
  player.bob += dt * speedNow * 1.5;
  const bobAmount = player.grounded ? Math.sin(player.bob) * 0.035 : 0;

  // ease between standing and sitting rather than snapping
  const targetEye = crouching ? CROUCH_EYE : EYE;
  eyeHeight += (targetEye - eyeHeight) * Math.min(1, dt * 11);

  camera.position.set(
    player.pos.x,
    player.pos.y + eyeHeight + bobAmount,
    player.pos.z,
  );
}

// ── zombie ai ────────────────────────────────────────────────────
const toPlayer = new THREE.Vector3();
const sep = new THREE.Vector3();

function updateZombies(dt) {
  // Cryo Burst stops them dead; Tar Field slows the whole horde.
  const hordeK = powerActive("freeze") ? 0 : powerActive("slowfield") ? powerAmount("slowfield") : 1;

  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    const g = z.group;

    if (z.dying > 0) {
      z.dying += dt;
      const fall = Math.min(1, z.dying / 1.3);
      g.rotation.x = -fall * Math.PI * 0.5;
      g.position.y = z.y - fall * 0.35;

      // A Reviver is only down, not out. Shoot the body to finish it.
      if (z.kind === "reviver" && !z.finished) {
        if (z.dying >= REVIVE_TIME) {
          z.dying = 0;
          z.alive = true;
          z.hp = z.maxHp * 0.6;
          g.rotation.x = 0;
          spatter(g.position, new THREE.Vector3(0, 1, 0), 10);
          sfx.dig(g.position.distanceTo(player.pos));
          continue;
        }
        continue; // stays targetable while down
      }

      // everything else lies there a while, then fades out
      if (z.dying > CORPSE_TIME) {
        const gone = Math.min(1, (z.dying - CORPSE_TIME) / 2);
        for (const m of z.mats) m.opacity = 1 - gone;
        if (gone >= 1) removeZombie(z, i);
      } else if (z.corpseCleared !== true && fall >= 1) {
        z.corpseCleared = true;
        unregisterZombie(z); // a body is scenery, not a target
      }
      continue;
    }

    // Clawing its way up out of the earth. It cannot move or strike until it
    // is out, but it can be shot the moment its head clears the ground.
    if (z.rising > 0) {
      z.rising -= dt;
      const k = Math.max(0, z.rising / RISE_TIME);
      z.y = -BURIED * k * k; // buried a while, then heaves out
      z.vy = 0;
      z.grounded = true;

      g.position.y = z.y;
      g.rotation.y = Math.atan2(
        player.pos.x - g.position.x,
        player.pos.z - g.position.z,
      );

      // scrabbling for purchase
      const t = game.time * 11;
      g.rotation.z = Math.sin(t) * 0.11;
      z.legL.rotation.x = 0.55 + Math.sin(t) * 0.3;
      z.legR.rotation.x = 0.55 - Math.sin(t) * 0.3;

      if (Math.random() < dt * 7) {
        spatter(
          new THREE.Vector3(g.position.x, 0.15, g.position.z),
          new THREE.Vector3(0, 1, 0),
          2,
          dirtMat,
        );
      }
      continue;
    }

    // Contact kill: anything that reaches you dies where it stands.
    // Ghost: they lose you entirely and wander off on their own bearing.
    const hidden = powerActive("cloak");
    toPlayer.set(
      (hidden ? g.position.x + Math.cos(z.wander) * 25 : lureActive() ? lure.x : player.pos.x) - g.position.x,
      0,
      (hidden ? g.position.z + Math.sin(z.wander) * 25 : lureActive() ? lure.z : player.pos.z) - g.position.z,
    );
    const dist = hidden ? 99 : toPlayer.length();
    toPlayer.normalize();

    // keep the horde from stacking into one body
    sep.set(0, 0, 0);
    for (const other of zombies) {
      if (other === z || other.dying) continue;
      const dx = g.position.x - other.group.position.x;
      const dz = g.position.z - other.group.position.z;
      const need = z.radius + other.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < need * need && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        sep.x += (dx / d) * (need - d);
        sep.z += (dz / d) * (need - d);
      }
    }

    /*
     * Steering around cover. They probe ahead toward you; if a wall is in
     * the way they fan out to either side and take the first clear heading
     * that still points roughly at you, committing to that side for a moment
     * so they don't dither in the corner of a building.
     */
    let mvx = toPlayer.x;
    let mvz = toPlayer.z;

    /*
     * Probing the path is the expensive part, so each zombie re-plans a few
     * times a second rather than every frame. Chasing you across open ground
     * still tracks continuously — that needs no probing at all.
     */
    z.flank -= dt;
    z.thinkCd -= dt;

    if (z.thinkCd <= 0) {
      z.thinkCd = 0.2 + Math.random() * 0.14;
      const gx = g.position.x;
      const gz = g.position.z;
      const rotate = (a) => ({
        x: toPlayer.x * Math.cos(a) - toPlayer.z * Math.sin(a),
        z: toPlayer.x * Math.sin(a) + toPlayer.z * Math.cos(a),
      });
      const clear = (d, reach) =>
        !pathBlocked(gx, gz, d.x, d.z, z.y, z.radius, reach);

      if (clear(toPlayer, Math.min(dist, 30))) {
        z.blocked = false; // the whole way is open
        z.flank = 0;
      } else {
        z.blocked = true;
        // Entering the flank: look both ways properly and take the open side,
        // then stay committed so it doesn't dither at a corner.
        if (z.flank <= 0) {
          const right = clear(rotate(1.25), 11);
          const left = clear(rotate(-1.25), 11);
          z.side = right && !left ? 1 : left && !right ? -1 : z.side;
          z.flank = 1.4;
        }

        let found = false;
        for (const spread of [0.45, 0.8, 1.15, 1.5, 1.9, 2.3, 2.7]) {
          for (const s of [z.side, -z.side]) {
            const d = rotate(spread * s);
            if (clear(d, 11)) {
              z.flankX = d.x;
              z.flankZ = d.z;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        // Nothing open anywhere: slide along the wall on the committed side
        // rather than pressing uselessly into it. Openings turn up.
        if (!found) {
          const d = rotate(1.57 * z.side);
          z.flankX = d.x;
          z.flankZ = d.z;
        }
      }
    }

    if (z.blocked) {
      mvx = z.flankX;
      mvz = z.flankZ;
    }

    const keepAway = z.kind === "marksman" && dist < 26;
    if (keepAway) {
      const stunK0 = (z.stun ?? 0) > 0 ? 0.25 : 1;
      g.position.x -= mvx * z.speed * hordeK * stunK0 * dt;
      g.position.z -= mvz * z.speed * hordeK * stunK0 * dt;
    } else if (dist > 1.35) {
      const stunK = (z.stun ?? 0) > 0 ? 0.25 : 1;
      if ((z.stun ?? 0) > 0) z.stun -= dt;
      g.position.x += (mvx * z.speed * hordeK * stunK + sep.x * 5) * dt;
      g.position.z += (mvz * z.speed * hordeK * stunK + sep.z * 5) * dt;
    } else {
      g.position.x += sep.x * 4 * dt;
      g.position.z += sep.z * 4 * dt;

      z.attackCd -= dt;
      // can't claw you from the top of a crate
      if (z.attackCd <= 0 && hordeK > 0 && Math.abs(z.y - player.pos.y) < 1.6) {
        z.attackCd = 1.05;
        hurtPlayer(z.damage, ZOMBIE_TYPES[z.kind]?.label ?? "a zombie");
        // Thorns: whatever reaches you pays for it
        if (powerActive("thorns")) {
          z.hp -= powerAmount("thorns");
          z.flash = 1;
          spatter(g.position, new THREE.Vector3(0, 1, 0), 8);
          if (z.hp <= 0) killZombie(z);
        }
      }
    }

    const blockedBy = pushOut(g.position, z.radius, z.y);
    const touching = blockedBy > 0;

    g.position.x = THREE.MathUtils.clamp(g.position.x, -HALF + 1, HALF - 1);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -HALF + 1, HALF - 1);

    /*
     * Vertical pursuit. Getting above them buys time, not safety:
     *   within a floor  — they gather themselves and leap it
     *   beyond a floor  — they haul themselves bodily up the wall
     */
    const dy = player.pos.y - z.y;
    z.jumpCd -= dt;

    if (dy > FLOOR_RISE && touching && dist < 10) z.climbing = true;

    if (z.climbing) {
      if (dy < 0.4 || !touching) {
        // over the lip — drag itself onto the ledge rather than dropping off
        g.position.x += mvx * 0.7;
        g.position.z += mvz * 0.7;
        z.climbing = false;
        z.vy = 0;
      } else {
        z.y += CLIMB_SPEED * dt;
        z.vy = 0;
        z.grounded = false;
      }
    }

    // ── the hopper: bounds along, then throws itself at you ──
    if (z.kind === "hopper" && z.grounded && !z.climbing) {
      z.hopCd = (z.hopCd ?? 0) - dt;
      if (z.hopCd <= 0) {
        const pounce = dist < 13;
        z.hopCd = pounce ? 1.6 : 0.7 + Math.random() * 0.5;
        z.vy = pounce ? 10.5 : 6.5;
        z.grounded = false;
        if (pounce) {
          g.position.x += mvx * 1.2;
          g.position.z += mvz * 1.2;
        }
      }
    }

    // ── the Marksman: hangs back and snipes ──
    if (z.kind === "marksman") {
      z.shotCd = (z.shotCd ?? 2) - dt;
      const clearShot =
        dist < 60 &&
        !pathBlocked(g.position.x, g.position.z, toPlayer.x, toPlayer.z, z.y, z.radius, Math.min(dist, 60));
      if (clearShot && z.shotCd <= 0) {
        z.shotCd = 3.2;
        tracer(
          new THREE.Vector3(g.position.x, z.y + 1.5, g.position.z),
          new THREE.Vector3(player.pos.x, player.pos.y + 1.3, player.pos.z),
        );
        sfx.shot({ tone: 260, volume: 0.8 });
        hurtPlayer(z.damage, ZOMBIE_TYPES.marksman.label);
      }
    }

    if (!z.climbing) {
      if (z.grounded) {
        if (touching && blockedBy <= z.y + 1.5) {
          // low cover: an ordinary hop over it
          z.vy = Math.sqrt(2 * GRAVITY * (blockedBy - z.y + 0.35));
          z.grounded = false;
        } else if (dy > 0.9 && dy <= FLOOR_RISE && dist < 10 && z.jumpCd <= 0) {
          // one storey above: a standing leap that actually reaches
          z.vy = Math.sqrt(2 * GRAVITY * (dy + 0.7));
          z.jumpCd = 1.1;
          z.grounded = false;
        }
      }

      z.vy -= GRAVITY * dt;
      const wasY = z.y;
      z.y += z.vy * dt;

      // A jump or a climb must stop at the underside of whatever is above.
      if (z.vy > 0) {
        const roof = ceilingAt(g.position, z.radius, wasY);
        if (z.y + 1.8 > roof) {
          z.y = Math.max(wasY, roof - 1.8);
          z.vy = 0;
          z.climbing = false;
        }
      }
      const zFloor = groundHeightAt(g.position, z.radius, z.y);
      if (z.y <= zFloor) {
        z.y = zFloor;
        z.vy = 0;
        z.grounded = true;
      } else {
        z.grounded = false;
      }
    }

    // face where it is actually going, not where you are
    g.rotation.y = Math.atan2(mvx, mvz);

    // shambling walk — legs tuck up while airborne
    z.phase += dt * z.speed * hordeK * 3.4;
    const swing = z.grounded ? Math.sin(z.phase) : 0.9;
    z.legL.rotation.x = swing * 0.75;
    z.legR.rotation.x = z.grounded ? -swing * 0.75 : 0.9 * 0.75;
    g.position.y = z.y + (z.grounded ? Math.abs(Math.sin(z.phase * 0.5)) * 0.05 : 0);
    g.rotation.z = z.grounded ? Math.sin(z.phase * 0.5) * 0.06 : 0;

    // hit flash
    if (z.flash > 0) {
      z.flash = Math.max(0, z.flash - dt * 5);
      // the eyes keep their own glow, so they are not flashed
      for (const m of z.flashMats) m.emissive.setRGB(z.flash * 0.9, 0, 0);
    }

    /*
     * Getting nowhere. Standing still while attacking is fine — that is what
     * it is meant to be doing — but a zombie out of reach that has not moved
     * has wedged itself somewhere, and the wave cannot end until it dies.
     * Fallen out of the world counts too.
     */
    const moved = Math.hypot(g.position.x - z.lastX, g.position.z - z.lastZ);
    if (moved > STUCK_DIST || dist < 2) {
      z.stuckFor = 0;
      z.lastX = g.position.x;
      z.lastZ = g.position.z;
    } else {
      z.stuckFor += dt;
    }
    if (z.stuckFor > STUCK_TIME || z.y < -8) digOutZombie(z);

    // occasional growl, quieter with distance
    z.growlCd -= dt;
    if (z.growlCd <= 0) {
      z.growlCd = 4 + Math.random() * 8;
      if (dist < 22 && game.running) sfx.growl();
    }
  }
}

function hurtPlayer(amount, by) {
  if (powerActive("shield")) return; // Bulwark: nothing gets through at all
  if (!player.alive) return;
  if (game.over) return;
  // Plating takes its share off whatever is left
  if (powerActive("armour")) amount *= 1 - powerAmount("armour");
  if (amount <= 0) return;
  if (by) game.killedBy = by; // whoever lands the last blow gets named
  player.hp -= amount;
  player.lastHit = game.time;
  sfx.hurt();
  ui.vignette.style.opacity = "0.85";
  setTimeout(() => (ui.vignette.style.opacity = "0"), 130);
  syncHud();
  if (player.hp <= 0) endGame();
}

// ── loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // main screen: just the character on his dais
  if (inLobby) {
    lobbyGuy.rotation.y += dt * 0.4;
    renderer.render(lobbyScene, lobbyCam);
    return;
  }

  if (game.running && !game.over) {
    game.time += dt;

    if (player.alive) movePlayer(dt);
    else if (game.dm) {
      player.respawn -= dt;
      $("respawn-in").textContent = Math.max(1, Math.ceil(player.respawn));
      if (player.respawn <= 0) respawnPlayer();
    }

    if (game.dm) {
      updateBots(dt);
    } else updateZombies(dt);

    // spawn drip
    if (game.dm) {
      // no waves in a free-for-all
    } else if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      // the detailed model costs more to draw, so fewer stand at once
      // corpses lie around for a minute, so only the ones on their feet
      // count against the limit — otherwise a wave stops spawning entirely
      if (game.spawnTimer <= 0 && liveCount() < liveCap()) {
        game.spawnTimer = spawnGap();
        spawnZombie(game.wave);
        game.toSpawn--;
        syncHud();
      }
    } else if (!zombies.some(stillFighting)) {
      if (game.intermission <= 0) {
        game.intermission = 4;
        sfx.waveClear();
        banner(`WAVE ${game.wave} CLEARED`, 2600);
        player.hp = Math.min(player.maxHp, player.hp + 25);
        // paid for surviving it, and paid more for surviving a worse one
        const paid = game.diff.coins ?? COINS_PER_WAVE;
        earnCoins(paid);
        refillEquipment();
        toast(`+25 HP · +${paid} COINS`);
        syncHud();
      } else {
        game.intermission -= dt;
        if (game.intermission <= 0) startWave(game.wave + 1);
      }
    }

    // weapon timers
    game.cooldown = Math.max(0, game.cooldown - dt);
    if (game.reloadTimer > 0) {
      game.reloadTimer -= dt;
      if (game.reloadTimer <= 0) {
        game.reloadTimer = 0;
        finishReload();
      }
    }

    // Banked clicks first: a tap that starts and ends between two frames
    // used to be dropped entirely, which felt like the gun not firing.
    while (game.queued > 0 && game.cooldown <= 0 && game.reloadTimer <= 0) {
      game.queued--;
      fire();
    }
    // Holding the trigger keeps firing on every weapon, not just the auto
    // ones. Nothing about moving, sprinting or reloading blocks this.
    if (game.triggerHeld && game.cooldown <= 0 && game.reloadTimer <= 0) fire();
    game.queued = Math.min(game.queued, 2);

    // the rest of a burst fires itself
    if (game.burstLeft > 0) {
      game.burstTimer -= dt;
      if (game.burstTimer <= 0) {
        game.burstLeft--;
        game.burstTimer = curWeapon().burstDelay ?? 0.075;
        shootOnce(curWeapon());
      }
    }

    updateProjectiles(dt);
    updateThrowables(dt);
    updateDrops(dt);
    if (!game.dm) {
      updateBus(dt);
      updateParts(dt);
      updateLeroy(dt);
      if (turbineSockets[0]?.spin) turbineSockets[0].spin.rotation.y += dt * 9;
    }
    hudAcc += dt;
    if (hudAcc > 0.12) {
      hudAcc = 0;
      renderBonuses();
      updatePowerHud();
      updateBoxPrompt();
      if (game.dm) renderScoreboard();
    }

    // health regen after a lull
    if (game.time - player.lastHit > 5 && player.hp < 100) {
      player.hp = Math.min(player.maxHp, player.hp + 7 * dt);
      syncHud();
    }
  }

  /*
   * Coming onto the sights and off them again. You cannot aim what you are
   * reloading, and a gun without sights never leaves the hip however hard the
   * button is held.
   */
  const wantAim = aim.held && hasSights(curWeapon()) && game.reloadTimer <= 0 && !game.over;
  aim.k = THREE.MathUtils.clamp(aim.k + (wantAim ? dt * 7 : -dt * 9), 0, 1);

  const ease = aim.k * aim.k * (3 - 2 * aim.k); // gentle at both ends
  const wantFov = HIP_FOV * (1 - ease * (1 - zoomOf(curWeapon())));
  if (Math.abs(camera.fov - wantFov) > 0.01) {
    camera.fov = wantFov;
    camera.updateProjectionMatrix();
  }
  ui.crosshair.classList.toggle("aiming", ease > 0.5);
  if (touchMode) $("t-aim").classList.toggle("on", aim.held);

  // viewmodel sway + recoil (runs even when paused so it settles)
  game.recoil = Math.max(0, game.recoil - dt * 3.4);
  const vm = viewmodels[curSlot().id];
  const reloadDip = game.reloadTimer > 0 ? 0.16 : 0;
  // the gun comes in to the middle and back towards your eye as you sight it
  vm.position.set(
    0.26 * (1 - ease),
    (-0.24 - reloadDip + Math.sin(player.bob) * 0.008) * (1 - ease * 0.7) - ease * 0.035,
    -0.5 + game.recoil * 0.9 + ease * 0.16,
  );
  vm.rotation.set(game.recoil * 3.2 * (1 - ease * 0.5), game.reloadTimer > 0 ? 0.45 : 0, 0);
  muzzleLight.intensity *= 0.72;

  /*
   * The dial in the corner, at 8 Hz — it is a canvas, not the game.
   *
   * The second half of that test is not paranoia: this holds a game.time, and
   * a new run winds that clock back to zero, so without it the next game's
   * minimap freezes on the last game's picture. Two other things in here have
   * had the same bug.
   */
  if (game.time < miniAt) miniAt = 0;
  if (game.time - miniAt > 0.125) {
    miniAt = game.time;
    drawMinimap();
  }

  // effects
  for (const p of blood) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vel.y -= 15 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.mesh.position.y < 0.03) {
      p.mesh.position.y = 0.03;
      p.vel.set(0, 0, 0);
    }
    if (p.life <= 0) p.mesh.visible = false;
  }

  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.85;
  }

  // fire flicker
  const f = game.time;
  fires.forEach((light, i) => {
    light.intensity = 2.1 + Math.sin(f * 9 + i * 2.1) * 0.5 + Math.random() * 0.3;
  });

  // the box turns and breathes, so it reads as something worth walking to
  for (const mb of mysteryBoxes) {
    mb.mesh.rotation.y += dt * 0.6;
    mb.mesh.position.y = mb.y + 0.58 + Math.sin(f * 2) * 0.07;
    if (mb.glow) mb.glow.intensity = 2.2 + Math.sin(f * 3) * 0.5;
  }

  renderer.render(scene, camera);
}

let loopFailed = false;
renderer.setAnimationLoop(() => {
  try {
    animate();
  } catch (err) {
    if (!loopFailed) {
      loopFailed = true;
      fatal("render loop", err);
    }
  }
});

// ── input ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (!game.running) return;
  if (e.code === "KeyR") startReload();
  // double-tap W to break into a run
  if (e.code === "KeyW" && !e.repeat) {
    if (game.time - lastWPress < DOUBLE_TAP) isRunning = true;
    lastWPress = game.time;
    wHeldSince = game.time;
  }
  if (e.code === "Digit1") switchWeapon(0);
  if (e.code === "Digit2") switchWeapon(1);
  if (e.code === "Digit3") switchWeapon(2);
  if (e.code === "KeyE") activatePower();
  if (e.code === "KeyF") useBox();
  // the bank is the one thing with two answers, so it gets two keys
  if (e.code === "KeyC" && nearThing?.kind === "bank") useBank(true);
  if (e.code === "KeyZ") throwEquipment(true);
  if (e.code === "KeyX") throwEquipment(false);
  if (e.code === "Space" && player.grounded) {
    crouching = false; // you cannot jump from a sit
    player.vy = 7.2;
    player.grounded = false;
  }
});

addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyW") isRunning = false; // let go of W and you drop to a walk
});

addEventListener("pointerdown", (e) => {
  // on a tablet the FIRE button fires; a tap on the screen is for looking
  if (touchMode || e.pointerType === "touch") return;
  if (!game.running || game.over) return;
  if (e.button === 2) return setAiming(true); // right button shoulders the gun
  if (e.button !== 0) return;
  game.triggerHeld = true;
  game.queued++; // bank it now so the loop can never miss the click
});

// otherwise the right button opens the browser's own menu over the game
addEventListener("contextmenu", (e) => {
  if (game.running && !game.over) e.preventDefault();
});

/*
 * Letting go of the trigger. Deliberately does NOT drop the sights: this is
 * bound to releasing the left button, and clearing the aim there meant every
 * shot knocked you off the sights while the right button was still held —
 * which from where you are standing is "I cannot shoot while aiming".
 */
const releaseTrigger = () => {
  game.triggerHeld = false;
  game.queued = 0;
};

/** Everything up: for a lost focus, a cancelled gesture, a released lock. */
const releaseAll = () => {
  releaseTrigger();
  setAiming(false);
};

addEventListener("pointerup", (e) => {
  if (touchMode || e.pointerType === "touch") return;
  if (e.button === 0) releaseTrigger();
  if (e.button === 2) setAiming(false);
});

// Every way a button release can go missing: the pointer leaving the window,
// the tab losing focus, a cancelled gesture. Any of them would otherwise
// leave the gun firing by itself.
addEventListener("pointercancel", releaseAll);
addEventListener("blur", releaseAll);
addEventListener("visibilitychange", () => document.hidden && releaseAll());
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) releaseAll();
});
// self-heal: a mouse move with no buttons down means nothing is held
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || e.buttons !== 0) return;
  if (game.triggerHeld || aim.held) releaseAll(); // nothing is down after all
});

addEventListener("blur", () => {
  game.triggerHeld = false;
  keys.clear();
});

controls.addEventListener("unlock", () => {
  if (game.over || !game.running) return;
  game.running = false;
  keys.clear();
  game.triggerHeld = false;
  ui.pause.classList.remove("hidden");
});

// ── main screen ──────────────────────────────────────────────────
const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0x0a1220);
const lobbyCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
lobbyCam.position.set(0, 1.45, 5);
lobbyCam.lookAt(0, 1.05, 0);

// The four materials a skin repaints. Shared by every piece of the model.
const skinMats = {
  skin: new THREE.MeshLambertMaterial({ color: 0xc7a887 }),
  primary: new THREE.MeshLambertMaterial({ color: 0x35506e }),
  secondary: new THREE.MeshLambertMaterial({ color: 0x2c3340 }),
  accent: new THREE.MeshLambertMaterial({ color: 0x1e2028 }),
};

const gearParts = {}; // optional worn pieces, shown per skin

const lobbyGuy = new THREE.Group();
{
  lobbyScene.add(new THREE.HemisphereLight(0x5878a8, 0x0a0d14, 1));
  const key = new THREE.DirectionalLight(0xdce8ff, 1.2);
  key.position.set(3, 6, 4);
  lobbyScene.add(key);
  const rim = new THREE.PointLight(0x7fd1b9, 3, 14, 2);
  rim.position.set(-2.6, 2.2, -2.2);
  lobbyScene.add(rim);

  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.32, 0.18, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.6 }),
  );
  dais.position.y = 0.09;
  lobbyScene.add(dais);

  const M = skinMats;
  for (const [w, h, d, x, y, z, m] of [
    [0.64, 0.95, 0.36, 0, 1.08, 0, M.primary], // torso
    [0.66, 0.14, 0.38, 0, 0.62, 0, M.accent], // belt
    [0.34, 0.36, 0.32, 0, 1.74, 0.02, M.skin], // head
    [0.36, 0.11, 0.34, 0, 1.92, 0.01, M.secondary], // hair
    [0.17, 0.5, 0.17, -0.41, 1.32, 0, M.primary], // sleeves
    [0.17, 0.5, 0.17, 0.41, 1.32, 0, M.primary],
    [0.15, 0.34, 0.15, -0.41, 0.92, 0, M.skin], // forearms
    [0.15, 0.34, 0.15, 0.41, 0.92, 0, M.skin],
    [0.16, 0.12, 0.2, -0.41, 0.7, 0.02, M.accent], // gloves
    [0.16, 0.12, 0.2, 0.41, 0.7, 0.02, M.accent],
    [0.22, 0.62, 0.22, -0.17, 0.5, 0, M.secondary], // legs
    [0.22, 0.62, 0.22, 0.17, 0.5, 0, M.secondary],
    [0.21, 0.16, 0.31, -0.17, 0.11, 0.05, M.accent], // boots
    [0.21, 0.16, 0.31, 0.17, 0.11, 0.05, M.accent],
  ]) {
    lobbyGuy.add(part(w, h, d, x, y, z, m));
  }

  // Worn gear. A skin turns on whichever pieces it is issued, so the
  // silhouette changes, not just the colours.
  const gear = (name, specs) => {
    const grp = new THREE.Group();
    for (const [w, h, d, x, y, z, m] of specs) grp.add(part(w, h, d, x, y, z, m));
    grp.visible = false;
    lobbyGuy.add(grp);
    gearParts[name] = grp;
  };

  gear("helmet", [
    [0.41, 0.27, 0.39, 0, 1.94, 0.01, M.accent],
    [0.43, 0.06, 0.12, 0, 1.86, 0.2, M.accent],
  ]);
  gear("hood", [
    [0.48, 0.46, 0.46, 0, 1.83, -0.07, M.primary],
    [0.32, 0.22, 0.16, 0, 1.6, -0.26, M.primary],
  ]);
  gear("mask", [[0.35, 0.17, 0.12, 0, 1.65, 0.16, M.accent]]);
  gear("goggles", [
    [0.39, 0.1, 0.09, 0, 1.81, 0.18, M.accent],
    [0.12, 0.12, 0.06, -0.13, 1.81, 0.21, M.secondary],
    [0.12, 0.12, 0.06, 0.13, 1.81, 0.21, M.secondary],
  ]);
  gear("pauldrons", [
    [0.22, 0.18, 0.36, -0.43, 1.56, 0, M.accent],
    [0.22, 0.18, 0.36, 0.43, 1.56, 0, M.accent],
  ]);
  gear("pack", [
    [0.45, 0.52, 0.26, 0, 1.2, -0.31, M.secondary],
    [0.51, 0.09, 0.28, 0, 0.99, -0.31, M.accent],
  ]);
  gear("cape", [[0.7, 1.2, 0.08, 0, 0.98, -0.25, M.primary]]);
  gear("coat", [
    [0.72, 0.58, 0.44, 0, 0.4, 0, M.primary],
    [0.3, 0.34, 0.46, -0.22, 0.16, 0, M.primary],
    [0.3, 0.34, 0.46, 0.22, 0.16, 0, M.primary],
  ]);
  gear("plate", [
    [0.62, 0.52, 0.12, 0, 1.18, 0.2, M.accent],
    [0.26, 0.15, 0.09, 0, 1.45, 0.23, M.accent],
  ]);
  gear("scarf", [
    [0.44, 0.15, 0.42, 0, 1.57, 0.02, M.accent],
    [0.17, 0.36, 0.09, 0.13, 1.4, 0.2, M.accent],
  ]);

  lobbyGuy.position.y = 0.18;
  lobbyScene.add(lobbyGuy);
}

/* ── skins, powers and the store ─────────────────────────────── */

const hex6 = (n) => `#${n.toString(16).padStart(6, "0")}`;

function applySkin(s) {
  skinMats.skin.color.setHex(s.skin);
  skinMats.primary.color.setHex(s.primary);
  skinMats.secondary.color.setHex(s.secondary);
  skinMats.accent.color.setHex(s.accent);

  // the rarer outfits carry their own light
  for (const m of Object.values(skinMats)) m.emissive.setHex(0x000000);
  if (s.glow) {
    skinMats.primary.emissive.setHex(s.glow);
    skinMats.accent.emissive.setHex(s.glow);
  }

  for (const name of Object.keys(gearParts)) {
    gearParts[name].visible = s.gear.includes(name);
  }
}

let previewed = skinById(wallet.equipped);

function renderSkinList() {
  $("coin-count").textContent = wallet.coins;
  $("skins-list").innerHTML = RARITIES.map((r) => {
    const list = SKINS.filter((s) => s.rarity === r.id);
    const price = r.currency === "aed" ? `${r.cost} AED` : `${r.cost}`;
    return `
      <div class="rar-row" style="--r:${r.colour}">
        <div class="rar-name">${r.label} — ${price}${r.currency === "coins" ? " COINS" : ""}</div>
        <div class="skin-grid">
          ${list
            .map((s) => {
              const have = owns(s.id);
              const tag = wallet.equipped === s.id
                ? "EQUIPPED"
                : have
                  ? "OWNED"
                  : r.currency === "aed"
                    ? `${r.cost} AED`
                    : `${r.cost}`;
              return `
              <button class="skin ${previewed.id === s.id ? "on" : ""} ${have ? "" : "locked"}"
                      data-skin="${s.id}">
                <span class="swatch">
                  <i style="background:${hex6(s.skin)}"></i>
                  <i class="wide" style="background:${hex6(s.primary)}"></i>
                  <i style="background:${hex6(s.secondary)}"></i>
                  <i style="background:${hex6(s.accent)}"></i>
                </span>
                <span class="skin-name">${s.name}</span>
                <span class="skin-tag ${have ? "" : r.currency === "aed" ? "aed" : "price"}">${tag}</span>
              </button>`;
            })
            .join("")}
        </div>
      </div>`;
  }).join("");
}

function renderSkinDetail() {
  const s = previewed;
  const r = rarityOf(s.rarity);
  const p = s.power;
  const have = owns(s.id);
  const equipped = wallet.equipped === s.id;
  const realMoney = r.currency === "aed";

  const action = equipped
    ? "EQUIPPED"
    : have
      ? "EQUIP"
      : realMoney
        ? `BUY — ${r.cost} AED`
        : `BUY — ${r.cost} COINS`;

  const affordable = have || (!realMoney && wallet.coins >= r.cost);

  $("skins-detail").innerHTML = `
    <div style="--r:${r.colour}">
      <div class="det-name">${s.name}</div>
      <div class="det-rar">${r.label}</div>
    </div>

    <div class="det-card" style="--r:${r.colour}">
      <div class="det-label">POWER — 60 SECOND COOLDOWN</div>
      <div class="det-power">${p ? p.name : "None"}</div>
      <div class="det-desc">${p ? p.desc : "The starter kit carries no power at all."}</div>
    </div>

    <div class="det-card">
      <div class="det-label">WEARING</div>
      <div class="det-wear">
        ${(s.gear.length ? s.gear : ["standard issue"])
          .map((g) => `<span class="wear">${g.toUpperCase()}</span>`)
          .join("")}
      </div>
    </div>

    ${
      realMoney && !have
        ? `<div class="det-note warn">Real-money purchases need a payment provider and a
             server to verify them. This build is a static page, so ${r.label} skins
             cannot be bought yet — the price is what they would cost.</div>`
        : !have && !affordable
          ? `<div class="det-note">You need ${r.cost - wallet.coins} more coins.
             You earn 5 to 25 coins a wave, depending on the difficulty.</div>`
          : ""
    }

    <button class="det-buy ${have ? "owned" : ""}" style="--r:${r.colour}"
            data-act="${equipped ? "" : have ? "equip" : "buy"}"
            ${equipped || (!have && !affordable) ? "disabled" : ""}>${action}</button>`;
}

function renderStore() {
  renderSkinList();
  renderSkinDetail();
  applySkin(previewed); // the right-hand model always shows what you clicked
}

function openStore() {
  previewed = skinById(wallet.equipped);
  renderStore();
  // shift the model into the right-hand half
  lobbyCam.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.25, 0, innerWidth, innerHeight);
  $("skins").classList.remove("hidden");
}

function closeStore() {
  lobbyCam.clearViewOffset();
  applySkin(skinById(wallet.equipped)); // revert any preview
  $("skins").classList.add("hidden");
}

$("skins-btn").addEventListener("click", openStore);
$("skins-close").addEventListener("click", closeStore);

$("skins-list").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-skin]");
  if (!el) return;
  previewed = skinById(el.dataset.skin);
  sfx.swap?.();
  renderStore();
});

$("skins-detail").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-act]");
  if (!el || el.disabled) return;

  if (el.dataset.act === "buy") {
    const result = buy(previewed);
    if (result === "ok") {
      equip(previewed);
      sfx.unlock();
    } else {
      sfx.dryFire();
    }
  } else if (el.dataset.act === "equip") {
    equip(previewed);
    sfx.unlock();
  }
  renderStore();
});

/* ── redeem code ─────────────────────────────────────────────── */

// Case and spacing are forgiving; the @ signs are part of the code.
const REDEEM_CODE = "ibr@him moh@mmed n@ji ahm@d ahmed mohsen ahm@d y@hy@ ahmed";
const tidy = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

function codeMessage(text, good) {
  const el = $("code-msg");
  if (!el) return;
  el.textContent = text;
  el.className = `show ${good ? "good" : "bad"}`;
  clearTimeout(codeMessage.timer);
  codeMessage.timer = setTimeout(() => {
    const live = $("code-msg");
    if (live) live.className = "";
  }, 4000);
}

/*
 * Before the code is entered this is a text field. Once it has been, the
 * field is gone for good and replaced by a switch that turns the unlock on
 * and off — off hands every skin back except the ones actually bought.
 */
function renderCodeBox() {
  const box = $("code-box");
  if (!wallet.code.redeemed) {
    box.innerHTML = `
      <label>REDEEM CODE</label>
      <div class="code-row">
        <input id="code-input" type="text" placeholder="enter code"
               autocomplete="off" spellcheck="false" />
        <button id="code-go">GO</button>
      </div>
      <div id="code-msg"></div>`;
    return;
  }

  const on = wallet.code.active;
  box.innerHTML = `
    <label>MASTER CODE</label>
    <button class="code-toggle ${on ? "on" : "off"}" id="code-toggle">
      <span class="state">${on ? "ON" : "OFF"}</span>
      <span class="switch"></span>
    </button>
    <div id="code-msg"></div>`;
}

function redeem() {
  const input = $("code-input");
  const entry = tidy(input.value);
  if (!entry) return;

  if (entry === tidy(REDEEM_CODE)) {
    const n = redeemCode();
    grantUnlimited();
    renderShopButton();
    renderCodeBox();
    codeMessage(`ALL ${n} SKINS UNLOCKED`, true);
    sfx.unlock();
    if (!$("skins").classList.contains("hidden")) renderStore();
  } else {
    codeMessage("THAT CODE DOES NOT WORK", false);
    sfx.dryFire();
  }
}

$("code-box").addEventListener("click", (e) => {
  if (e.target.closest("#code-go")) redeem();

  if (e.target.closest("#code-toggle")) {
    setCodeActive(!wallet.code.active);
    renderCodeBox();
    codeMessage(
      wallet.code.active ? "CODE ON — EVERYTHING UNLOCKED" : "CODE OFF — BOUGHT SKINS ONLY",
      wallet.code.active,
    );
    sfx.swap();
    applySkin(skinById(wallet.equipped)); // the fallback skin may have changed
    if (!$("skins").classList.contains("hidden")) renderStore();
  }
});

// typing in the box must not drive the game
$("code-box").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") redeem();
});
$("code-box").addEventListener("keyup", (e) => e.stopPropagation());

renderCodeBox();

/* ── account ─────────────────────────────────────────────────── */

function renderAccount() {
  const box = $("account-box");
  if (signedIn()) {
    box.innerHTML = `
      <label>SIGNED IN AS</label>
      <div class="acct-name">${account.name}</div>
      <button class="acct-btn ghost" id="signout-btn">SIGN OUT</button>
      <div class="acct-ok">Progress is saved to this profile on this device.</div>`;
  } else {
    box.innerHTML = `
      <label>NOT SIGNED IN</label>
      <button class="acct-btn" id="signin-btn">SIGN IN</button>
      <div class="acct-warn">Coins and skins are not being saved. Close the
        page and this run is gone.</div>`;
  }
}

function openSignIn() {
  const list = profiles();
  $("profile-list").innerHTML = list.length
    ? `<div style="width:100%;font-size:9px;letter-spacing:3px;opacity:.4;margin-bottom:4px">
         EXISTING PROFILES</div>` +
      list.map((n) => `<button class="profile-chip" data-profile="${n}">${n}</button>`).join("")
    : "";
  $("signin-note").textContent =
    "This is a save slot in this browser, not an online account — there is no " +
    "server behind the game yet, so it will not follow you to another device.";
  $("name-input").value = "";
  $("signin").classList.remove("hidden");
  $("name-input").focus();
}

function doSignIn(name) {
  if (!signIn(name)) return;

  if (profileExists(account.name)) {
    reloadWallet(); // returning player: load what they had
  } else {
    keepCurrentProgress(); // new profile keeps whatever this guest earned
  }

  $("signin").classList.add("hidden");
  renderAccount();
  renderCodeBox();
  applySkin(skinById(wallet.equipped));
  if (!$("skins").classList.contains("hidden")) renderStore();
}

$("account-box").addEventListener("click", (e) => {
  if (e.target.closest("#signin-btn")) openSignIn();
  if (e.target.closest("#signout-btn")) {
    signOut();
    resetWallet(); // the guest left behind starts clean
    renderAccount();
    renderCodeBox();
    applySkin(skinById(wallet.equipped));
    if (!$("skins").classList.contains("hidden")) renderStore();
  }
});

$("signin").addEventListener("click", (e) => {
  const chip = e.target.closest("button[data-profile]");
  if (chip) return doSignIn(chip.dataset.profile);
  if (e.target.closest("#signin-go")) return doSignIn($("name-input").value);
  if (e.target.closest("#signin-cancel")) $("signin").classList.add("hidden");
});

$("signin").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") doSignIn($("name-input").value);
  if (e.key === "Escape") $("signin").classList.add("hidden");
});
$("signin").addEventListener("keyup", (e) => e.stopPropagation());

renderAccount();

applySkin(skinById(wallet.equipped));


let inLobby = true;
let panelKind = null; // null | "settings" | "party"
let joinOpen = false; // the code field inside the party panel

function partyHtml() {
  if (!party.code) {
    return `
      <div class="panel-label">PARTY</div>
      <div class="opt-grid" style="grid-template-columns:1fr 1fr">
        <button class="opt" data-party="create">
          <span class="t">CREATE</span>
          <span class="d">Start a party and get a five digit code to share.</span>
        </button>
        <button class="opt ${joinOpen ? "on" : ""}" data-party="join">
          <span class="t">JOIN</span>
          <span class="d">Enter someone else's code.</span>
        </button>
      </div>

      ${
        joinOpen
          ? `<div class="code-row" style="margin-top:12px">
               <input id="party-code" type="text" inputmode="numeric" maxlength="5"
                      placeholder="00000" autocomplete="off" />
               <button data-party="submit">JOIN</button>
             </div>`
          : ""
      }

      ${party.message ? `<div class="det-note warn" style="margin-top:10px">${party.message}</div>` : ""}

      <div class="det-note" style="margin-top:14px">
        There is no game server behind this, so a party cannot reach another
        person's computer. It does work between tabs of this browser — create
        here, open a second tab and join with the code.
      </div>`;
  }

  return `
    <div class="panel-label">PARTY CODE</div>
    <div class="party-code">${party.code}</div>

    <div class="panel-label" style="margin-top:14px">
      MEMBERS — ${party.members.length}/4
    </div>
    <div class="member-list">
      ${party.members
        .map((m) => {
          const isHost = party.members[0] === m;
          const me = m === party.me;
          return `<div class="member">
              <span>${m}${isHost ? " · HOST" : ""}${me ? " · YOU" : ""}</span>
              ${
                party.host && !me
                  ? `<button class="kick" data-kick="${m}">KICK</button>`
                  : ""
              }
            </div>`;
        })
        .join("")}
    </div>

    ${party.message ? `<div class="det-note warn" style="margin-top:10px">${party.message}</div>` : ""}

    <div class="nav" style="margin-top:16px">
      <button class="ghost" data-party="leave">
        ${party.host ? "DISBAND PARTY" : "LEAVE PARTY"}
      </button>
    </div>`;
}

function renderPanel() {
  ui.settingsSub.textContent = `Zombies · ${mapById(game.mapId).name} · ${game.diff.label}`;
  $("party-sub").textContent = party.code
    ? `Code ${party.code} · ${party.members.length}/4`
    : "Not in a party";

  ui.lobbyPanel.classList.toggle("hidden", !panelKind);
  $("settings-btn").classList.toggle("on", panelKind === "settings");
  $("party-btn").classList.toggle("on", panelKind === "party");
  if (!panelKind) return;

  if (panelKind === "party") {
    ui.lobbyPanel.innerHTML = partyHtml();
    return;
  }

  ui.lobbyPanel.innerHTML = `
    <div class="panel-label">MODE</div>
    <div class="opt-grid">
      <button class="opt on"><span class="t">ZOMBIES</span>
        <span class="d">Survive endless waves.</span></button>
      <button class="opt" data-openmp="1"><span class="t">MULTIPLAYER</span>
        <span class="d">Free-for-all. Build a class, fight bots or real players.</span></button>
    </div>

    <div class="panel-label">MAP</div>
    <div class="opt-grid">
      ${MAPS.map(
        (m) => `<button class="opt ${m.id === game.mapId ? "on" : ""}" data-map="${m.id}">
          <span class="t">${m.name}</span><span class="d">${m.blurb}</span></button>`,
      ).join("")}
    </div>

    <div class="panel-label">DIFFICULTY</div>
    <div class="opt-grid">
      ${DIFFICULTIES.map(
        (d) => `<button class="opt ${d.id === game.diff.id ? "on" : ""}" data-diff="${d.id}">
          <span class="t">${d.label}</span><span class="d">${d.blurb}</span>
          <span class="s">×${d.damage} damage · ×${d.count} count · ×${d.speed} speed · ×${d.health} health</span>
        </button>`,
      ).join("")}
    </div>`;
}

ui.lobbyPanel.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;

  if (el.dataset.openmp) {
    panelKind = null;
    renderPanel();
    openMultiplayer();
    return;
  }
  if (el.dataset.map) game.mapId = el.dataset.map;
  if (el.dataset.diff)
    game.diff = DIFFICULTIES.find((d) => d.id === el.dataset.diff) ?? game.diff;

  if (el.dataset.kick) {
    kickMember(el.dataset.kick);
    party.message = `${el.dataset.kick} was removed.`;
  }

  switch (el.dataset.party) {
    case "create":
      createParty();
      party.message = "";
      break;
    case "join":
      joinOpen = !joinOpen;
      party.message = "";
      break;
    case "submit": {
      const err = joinParty($("party-code")?.value ?? "");
      party.message = err ?? "";
      if (!err) joinOpen = false;
      break;
    }
    case "leave":
      leaveParty();
      party.message = "";
      break;
  }

  sfx.reload();
  renderPanel();
});

// typing a code must not drive the game
ui.lobbyPanel.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter" && e.target.id === "party-code") {
    const err = joinParty(e.target.value);
    party.message = err ?? "";
    if (!err) joinOpen = false;
    renderPanel();
  }
});
ui.lobbyPanel.addEventListener("keyup", (e) => e.stopPropagation());

$("settings-btn").addEventListener("click", () => {
  panelKind = panelKind === "settings" ? null : "settings";
  renderPanel();
});

$("party-btn").addEventListener("click", () => {
  panelKind = panelKind === "party" ? null : "party";
  joinOpen = false;
  party.message = "";
  refreshParty();
  renderPanel();
});

/*
 * Watch the party for changes made in other tabs — someone joining, or the
 * host kicking you.
 */
setInterval(() => {
  if (!party.code) return;
  const event = refreshParty();
  if (event === "kicked") party.message = "You were kicked from the party.";
  if (event === "gone") party.message = "The party was disbanded.";
  if (inLobby) renderPanel();
}, 1000);

addEventListener("beforeunload", () => leaveParty());

function toLobby() {
  inLobby = true;
  if (game.dm) { clearBots(); game.dm = false; }
  ui.scoreboard.classList.add("hidden");
  ui.respawning.classList.add("hidden");
  panelKind = null;
  game.running = false;
  game.over = false;
  controls.unlock();
  for (let i = zombies.length - 1; i >= 0; i--) removeZombie(zombies[i], i);
  ui.hud.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.dead.classList.add("hidden");
  ui.lobby.classList.remove("hidden");
  $("power-btn").classList.add("hidden");
  renderPanel();
}

// ── start / restart ──────────────────────────────────────────────
function beginPlay() {
  ui.lobby.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.dead.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  inLobby = false;
  game.running = true;
  clock.getDelta(); // drop the accumulated idle time
  grabMouse();
  audio();
}

function resetGame() {
  player.alive = true;
  player.respawn = 0;
  game.killedBy = null;
  game.revivesUsed = 0;
  ownedPerks.clear();
  player.maxHp = 100;
  for (let i = zombies.length - 1; i >= 0; i--) removeZombie(zombies[i], i);
  buildMap(mapById(game.mapId));
  const [sx, sz] = mapDef.start;
  player.pos.set(sx, 0, sz);
  pushOut(player.pos, PLAYER_R); // never start inside a prop
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.hp = 100;
  player.lastHit = 0;
  player.slow = 0;
  player.blind = 0;
  ui.flash.style.opacity = "0"; // a flashbang that went off as you died

  // These hold the game.time they expire at, and the clock is about to go back
  // to zero — leave them and the new game starts with the last one's power-ups
  // and a decoy still pulling the horde to a corner of the old map.
  bonus.points = 0;
  bonus.instakill = 0;
  lure.until = 0;

  for (const vm of Object.values(viewmodels)) vm.visible = false;
  Object.assign(game, {
    over: false,
    time: 0,
    kills: 0,
    toSpawn: 0,
    intermission: 0,
    weapon: 0,
    slots: startingSlots(),
    points: START_POINTS,
    burstLeft: 0,
    burstTimer: 0,
    cooldown: 0,
    reloadTimer: 0,
    recoil: 0,
    triggerHeld: false,
  });
  viewmodels.pistol.visible = true;

  renderLoadout();
  resetPower();
  startWave(1);
  syncHud();
}

function endGame() {
  if (!game.dm) {
    const h1 = ui.dead.querySelector("h1");
    h1.textContent = game.killedBy ? `KILLED BY ${game.killedBy.toUpperCase()}` : "YOU DIED";
    h1.className = "red";
  }
  if (game.dm) {
    // eliminated, not finished
    player.alive = false;
    player.respawn = DM_RESPAWN;
    ui.respawning.classList.remove("hidden");
    sfx.death();
    const killer = bots.find((b) => b.alive && b.hasLos);
    if (killer) { killer.score++; feed(killer.name, "YOU"); }
    if (killer && killer.score >= DM_LIMIT) endDeathmatch(false);
    return;
  }
  game.over = true;
  game.running = false;
  sfx.death();
  ui.deadWave.textContent = game.wave;
  ui.deadKills.textContent = game.kills;
  controls.unlock();
  $("revive-btn").classList.toggle(
    "hidden",
    game.dm || !hasToken() || game.revivesUsed >= MAX_REVIVES,
  );
  ui.dead.classList.remove("hidden");
}

$("play-btn").addEventListener("click", () => {
  resetGame();
  beginPlay();
});

$("resume-btn").addEventListener("click", beginPlay);

$("retry-btn").addEventListener("click", () => {
  resetGame();
  beginPlay();
});

// Clicking it only works while the pointer is free — during play the mouse is
// captured for aiming, so F is the reliable trigger.
$("power-btn").addEventListener("click", activatePower);

$("quit-btn").addEventListener("click", toLobby);
$("menu-btn").addEventListener("click", toLobby);

// the main screen is what you see first
renderPanel();

// prime the view before the first click
viewmodels.pistol.visible = true;
camera.position.set(0, EYE, 8);
renderLoadout();
syncHud();

/* ── multiplayer: create a class ─────────────────────────────── */

let picker = null; // what the picker is currently choosing

const mpClass = () => mpClasses[mpIndex];
const gunsOnly = WEAPONS.filter((w) => !w.melee);
const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? null;

function mpRoom() {
  return MAX_POINTS - pointsUsed(mpClass());
}

function renderMpHeader() {
  const used = pointsUsed(mpClass());
  $("mp-name").value = mpClass().name;
  $("mp-count").textContent = `${MAX_POINTS - used}/${MAX_POINTS}`;
  $("mp-pips").innerHTML = Array.from(
    { length: MAX_POINTS },
    (_, i) => `<i class="${i < MAX_POINTS - used ? "on" : ""}"></i>`,
  ).join("");

  $("mp-classes").innerHTML = mpClasses
    .map(
      (c, i) =>
        `<button class="mp-class ${i === mpIndex ? "on" : ""}" data-class="${i}">${c.name}</button>`,
    )
    .join("");
}

function weaponSlot(kind, label) {
  const c = mpClass();
  const id = kind === "primary" ? c.primary : c.secondary;
  const atts = kind === "primary" ? c.primaryAtt : c.secondaryAtt;
  const limit = kind === "primary" ? attachmentLimit(c) : 2;
  const w = id ? weaponById(id) : null;

  const cells = Array.from({ length: 3 }, (_, i) => {
    if (i >= limit) return `<button class="att-cell locked" disabled></button>`;
    const a = atts[i];
    return `<button class="att-cell" data-att="${kind}:${i}">
        ${a ? nameOf(ATTACHMENTS, a) : '<span class="empty">+</span>'}
      </button>`;
  }).join("");

  return `
    <div class="mp-box">
      <h3>${label}</h3>
      <button class="mp-slot" data-weapon="${kind}">
        <span class="pick ${w ? "" : "empty"}">${w ? w.name : "Choose a weapon."}</span>
        <span class="hint">${
          w ? `${w.mag} rounds · ${w.melee ? "melee" : w.auto ? "automatic" : "semi-automatic"}` : "Attachments not available"
        }</span>
      </button>
      <div class="att-row">${cells}</div>
    </div>`;
}

function renderMpLeft() {
  const c = mpClass();
  $("mp-left").innerHTML = `
    ${weaponSlot("primary", "PRIMARY")}
    ${weaponSlot("secondary", "SECONDARY")}
    <div class="mp-box">
      <h3>WILDCARDS</h3>
      <div class="att-row">
        ${Array.from({ length: 3 }, (_, i) => {
          const id = c.wildcards[i];
          return `<button class="att-cell" data-wild="${i}">
              ${id ? nameOf(WILDCARDS, id) : '<span class="empty">+</span>'}
            </button>`;
        }).join("")}
      </div>
    </div>`;
}

function renderMpRight() {
  const c = mpClass();
  const row = (label, value, kind, index, shape) => `
    <button class="mp-row ${value ? "filled" : ""}" data-${kind}="${index}">
      <span>
        <span class="label">${label}</span><br />
        <span class="value ${value ? "" : "empty"}">${value ?? `Choose a ${label.split(" ")[0].toLowerCase()}.`}</span>
      </span>
      <span class="${shape}"></span>
    </button>`;

  $("mp-right").innerHTML = [
    row("PERK 1", nameOf(PERKS, c.perks[0]), "perk", 0, "shield"),
    row("PERK 2", nameOf(PERKS, c.perks[1]), "perk", 1, "shield"),
    row("PERK 3", nameOf(PERKS, c.perks[2]), "perk", 2, "shield"),
    row("LETHAL", nameOf(LETHALS, c.lethal), "lethal", 0, "square"),
    row("TACTICAL", nameOf(TACTICALS, c.tactical), "tactical", 0, "square"),
  ].join("");
}

function renderMp() {
  renderMpHeader();
  renderMpLeft();
  renderMpRight();
  saveClasses(mpClasses);
}

/* ── the picker ── */

function openPicker(kind, index, title, items, current) {
  picker = { kind, index };
  $("picker-title").textContent = title;
  const room = mpRoom();

  $("picker-list").innerHTML =
    `<button class="pick-item none" data-choose=""><span class="n">— none —</span>
       <span class="d">Frees the point back up.</span></button>` +
    items
      .map((it) => {
        const chosen = it.id === current;
        // taking a new item costs a point unless it replaces one
        const affordable = chosen || current || room > 0;
        return `<button class="pick-item ${chosen ? "on" : ""}" data-choose="${it.id}"
                        ${affordable ? "" : "disabled"}>
            <span class="n">${it.name}</span>
            <span class="d">${it.desc ?? ""}</span>
          </button>`;
      })
      .join("");

  $("mp-picker").classList.remove("hidden");
}

function applyPick(id) {
  const c = mpClass();
  const { kind, index } = picker;
  const value = id || null;

  if (kind === "weapon") {
    if (index === "primary") {
      c.primary = value;
      if (!value) c.primaryAtt = [];
    } else {
      c.secondary = value;
      if (!value) c.secondaryAtt = [];
    }
  } else if (kind === "att") {
    const [which, slot] = index.split(":");
    const list = which === "primary" ? c.primaryAtt : c.secondaryAtt;
    if (value) list[Number(slot)] = value;
    else list.splice(Number(slot), 1);
  } else if (kind === "perk") {
    c.perks[index] = value;
  } else if (kind === "lethal") {
    c.lethal = value;
  } else if (kind === "tactical") {
    c.tactical = value;
  } else if (kind === "wild") {
    if (value) c.wildcards[index] = value;
    else c.wildcards.splice(index, 1);
    // dropping Gunfighter drops the third attachment with it
    if (!c.wildcards.includes("gunfighter")) c.primaryAtt = c.primaryAtt.slice(0, 2);
  }

  $("mp-picker").classList.add("hidden");
  picker = null;
  sfx.reload();
  renderMp();
}

/* ── wiring ── */

function openMultiplayer() {
  renderMp();
  $("mp-status").textContent = "";
  $("mp").classList.remove("hidden");
}

$("mp-back").addEventListener("click", () => $("mp").classList.add("hidden"));
$("picker-close").addEventListener("click", () => {
  $("mp-picker").classList.add("hidden");
  picker = null;
});

$("mp-name").addEventListener("input", (e) => {
  mpClass().name = e.target.value.toUpperCase().slice(0, 16) || `CUSTOM ${mpIndex + 1}`;
  saveClasses(mpClasses);
});
$("mp-name").addEventListener("keydown", (e) => e.stopPropagation());
$("mp-name").addEventListener("keyup", (e) => e.stopPropagation());

$("mp").addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  const c = mpClass();

  if (el.dataset.class !== undefined) {
    mpIndex = Number(el.dataset.class);
    sfx.swap();
    return renderMp();
  }

  if (el.dataset.weapon) {
    const cur = el.dataset.weapon === "primary" ? c.primary : c.secondary;
    return openPicker("weapon", el.dataset.weapon, "CHOOSE A WEAPON", gunsOnly, cur);
  }

  if (el.dataset.att) {
    const [which, slot] = el.dataset.att.split(":");
    const list = which === "primary" ? c.primaryAtt : c.secondaryAtt;
    return openPicker("att", el.dataset.att, "CHOOSE AN ATTACHMENT", ATTACHMENTS, list[Number(slot)]);
  }

  if (el.dataset.wild !== undefined) {
    return openPicker("wild", Number(el.dataset.wild), "CHOOSE A WILDCARD", WILDCARDS, c.wildcards[Number(el.dataset.wild)]);
  }

  if (el.dataset.perk !== undefined) {
    const i = Number(el.dataset.perk);
    return openPicker("perk", i, `CHOOSE PERK ${i + 1}`, PERKS.filter((p) => p.tier === i + 1), c.perks[i]);
  }

  if (el.dataset.lethal !== undefined) {
    return openPicker("lethal", 0, "CHOOSE A LETHAL", LETHALS, c.lethal);
  }

  if (el.dataset.tactical !== undefined) {
    return openPicker("tactical", 0, "CHOOSE A TACTICAL", TACTICALS, c.tactical);
  }

  if (el.dataset.choose !== undefined && picker) return applyPick(el.dataset.choose);
});

$("mp").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-opp]");
  if (!el) return;
  mpOpponents = el.dataset.opp;
  for (const b of document.querySelectorAll(".opp")) {
    b.classList.toggle("on", b.dataset.opp === mpOpponents);
  }
  $("mp-status").textContent = "";
  sfx.swap();
});

$("mp-find").addEventListener("click", async () => {
  const c = mpClass();
  if (!c.primary) {
    $("mp-status").textContent = "Choose a primary weapon first.";
    sfx.dryFire();
    return;
  }

  if (mpOpponents === "bots") {
    try {
      $("mp").classList.add("hidden");
      startDeathmatch();
    } catch (err) {
      console.error(err);
      $("mp").classList.remove("hidden");
      $("mp-status").textContent = `Could not start: ${err.message}`;
    }
    return;
  }

  $("mp-status").textContent = "Looking for a match…";
  try {
    const r = await fetch("http://localhost:8787/api/health");
    const health = await r.json();
    $("mp-status").textContent =
      `Server reachable, but nobody is hosting matches yet — real-time play ` +
      `needs the netcode and a hosted server. Your class is saved.`;
    void health;
  } catch {
    $("mp-status").textContent =
      "No game server running. Free-for-all against real players needs one — " +
      "your class is saved and ready for when it is up.";
  }
  sfx.dryFire();
});

/* ── free-for-all against bots ───────────────────────────────── */

const DM_LIMIT = 25; // kills to win
const DM_RESPAWN = 3;
const BOT_NAMES = ["VIPER", "HAWK", "GHOST", "RAVEN", "WOLF", "ECHO", "NOMAD"];
const BOT_COLOURS = [0xb5453f, 0x3f6fb5, 0xb59a3f, 0x7a3fb5, 0x3fb583, 0xb5643f, 0x5b5b5b];
const BOT_GUN = { damage: 16, range: 46, tone: 520, volume: 0.4 };

const bots = [];
let mpOpponents = "bots";

function buildBot(colour) {
  const skin = new THREE.MeshLambertMaterial({ color: 0xc7a887 });
  const gear = new THREE.MeshLambertMaterial({ color: colour });
  const g = new THREE.Group();

  const torso = part(0.62, 1.0, 0.34, 0, 1.05, 0, gear);
  const head = part(0.34, 0.36, 0.32, 0, 1.72, 0.02, skin);
  const armL = part(0.16, 0.66, 0.16, -0.41, 1.25, -0.16, gear);
  const armR = part(0.16, 0.66, 0.16, 0.41, 1.25, -0.16, gear);
  const legL = part(0.2, 0.78, 0.2, -0.17, 0.39, 0, gear);
  const legR = part(0.2, 0.78, 0.2, 0.17, 0.39, 0, gear);
  const gun = part(0.08, 0.1, 0.6, 0.3, 1.28, -0.46, gunMetal);

  for (const m of [torso, head, armL, armR, legL, legR, gun]) {
    m.castShadow = m === torso;
    g.add(m);
  }
  armL.rotation.x = -1.3;
  armR.rotation.x = -1.3;

  return { group: g, torso, head, legL, legR, mats: [skin, gear] };
}

function spawnBot(i) {
  const colour = BOT_COLOURS[i % BOT_COLOURS.length];
  const model = buildBot(colour);
  scene.add(model.group);

  const bot = {
    isBot: true,
    name: BOT_NAMES[i % BOT_NAMES.length],
    colour,
    model,
    group: model.group,
    hp: 100,
    maxHp: 100,
    dying: 0,
    alive: true,
    respawn: 0,
    score: 0,
    flash: 0,
    fireCd: 1 + Math.random(),
    losCd: 0,
    hasLos: false,
    blind: 0,
    slow: 0,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 1 + Math.random() * 2,
    phase: Math.random() * 6,
    radius: 0.45,
    y: 0,
  };

  model.torso.userData.bot = bot;
  model.head.userData.bot = bot;
  model.head.userData.isHead = true;
  hitboxes.push(model.torso, model.head);
  bots.push(bot);
  placeBot(bot);
  return bot;
}

function placeBot(bot) {
  const ring = HALF * 0.72;
  let x, z, tries = 0;
  do {
    const a = Math.random() * Math.PI * 2;
    const d = ring * (0.4 + Math.random() * 0.6);
    x = Math.cos(a) * d;
    z = Math.sin(a) * d;
    tries++;
  } while (tries < 30 && Math.hypot(x - player.pos.x, z - player.pos.z) < 22);
  bot.group.position.set(x, 0, z);
  pushOut(bot.group.position, bot.radius);
}

function clearBots() {
  for (const b of bots) {
    for (const m of [b.model.torso, b.model.head]) {
      const i = hitboxes.indexOf(m);
      if (i !== -1) hitboxes.splice(i, 1);
    }
    scene.remove(b.group);
    for (const m of b.model.mats) m.dispose();
  }
  bots.length = 0;
}

function killBot(bot, byPlayer) {
  if (!bot.alive) return;
  bot.alive = false;
  bot.dying = 0.001;
  bot.respawn = DM_RESPAWN;
  for (const m of [bot.model.torso, bot.model.head]) {
    const i = hitboxes.indexOf(m);
    if (i !== -1) hitboxes.splice(i, 1);
  }
  if (byPlayer) {
    game.score++;
    game.kills++;
    addPoints(PTS_KILL);
    sfx.kill?.() ?? sfx.unlock();
    feed("YOU", bot.name);
    if (game.score >= DM_LIMIT) endDeathmatch(true);
  }
  syncHud();
}

function damageBot(bot, amount, head, dir, point) {
  if (!bot.alive) return;
  bot.hp -= bonusActive("instakill") ? bot.maxHp : amount;
  bot.flash = 1;
  spatter(point, dir, head ? 12 : 6);
  head ? sfx.headshot() : sfx.flesh();
  addPoints(PTS_HIT);
  if (bot.hp <= 0) killBot(bot, true);
}

const feedRows = [];
function feed(killer, victim) {
  feedRows.push({ killer, victim, t: 5 });
  if (feedRows.length > 5) feedRows.shift();
}

const botDir = new THREE.Vector3();

function updateBots(dt) {
  for (const bot of bots) {
    const g = bot.group;

    if (!bot.alive) {
      if (bot.dying > 0) {
        bot.dying += dt;
        const t = Math.min(1, bot.dying / 1);
        g.rotation.x = -t * Math.PI * 0.5;
        if (t >= 1) {
          bot.dying = 0;
          g.visible = false;
        }
      }
      bot.respawn -= dt;
      if (bot.respawn <= 0) {
        placeBot(bot);
        g.rotation.set(0, 0, 0);
        g.visible = true;
        bot.alive = true;
        bot.hp = bot.maxHp;
        bot.fireCd = 0.9;
        bot.model.torso.userData.bot = bot;
        bot.model.head.userData.bot = bot;
        hitboxes.push(bot.model.torso, bot.model.head);
      }
      continue;
    }

    const dx = player.pos.x - g.position.x;
    const dz = player.pos.z - g.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    botDir.set(dx / dist, 0, dz / dist);

    bot.losCd -= dt;
    if (bot.losCd <= 0) {
      bot.losCd = 0.2;
      bot.hasLos = player.alive && !smokeBetween(g.position.x, g.position.z, player.pos.x, player.pos.z) && !pathBlocked(
        g.position.x, g.position.z, botDir.x, botDir.z, bot.y, bot.radius,
        Math.min(dist, BOT_GUN.range),
      );
    }

    bot.strafeT -= dt;
    if (bot.strafeT <= 0) {
      bot.strafeT = 1 + Math.random() * 2;
      bot.strafe *= -1;
    }

    const speed = dist > 16 ? 5.2 : 3.4;
    if (dist > 12 || !bot.hasLos) {
      g.position.x += botDir.x * speed * dt;
      g.position.z += botDir.z * speed * dt;
    } else if (dist < 7) {
      g.position.x -= botDir.x * 3 * dt;
      g.position.z -= botDir.z * 3 * dt;
    }
    g.position.x += -botDir.z * bot.strafe * 3.2 * dt;
    g.position.z += botDir.x * bot.strafe * 3.2 * dt;

    pushOut(g.position, bot.radius);
    g.position.x = THREE.MathUtils.clamp(g.position.x, -HALF + 1, HALF - 1);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -HALF + 1, HALF - 1);
    bot.y = groundHeightAt(g.position, bot.radius, bot.y + 0.4);
    g.position.y = bot.y;
    g.rotation.y = Math.atan2(botDir.x, botDir.z);

    bot.phase += dt * 7;
    bot.model.legL.rotation.x = Math.sin(bot.phase) * 0.6;
    bot.model.legR.rotation.x = -Math.sin(bot.phase) * 0.6;

    if (bot.flash > 0) {
      bot.flash = Math.max(0, bot.flash - dt * 5);
      for (const m of bot.model.mats) m.emissive.setRGB(bot.flash * 0.9, 0, 0);
    }

    bot.fireCd -= dt;
    if (bot.blind > 0) bot.blind -= dt;
    if (bot.slow > 0) bot.slow -= dt;
    if (player.alive && bot.blind <= 0 && bot.hasLos && dist < BOT_GUN.range && bot.fireCd <= 0) {
      bot.fireCd = 0.42 + Math.random() * 0.4;
      const from = new THREE.Vector3(g.position.x, bot.y + 1.45, g.position.z);
      const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z);
      const chance = THREE.MathUtils.clamp(0.55 - dist / (BOT_GUN.range * 2), 0.12, 0.5);
      sfx.shot(BOT_GUN);
      if (Math.random() < chance) {
        tracer(from, to);
        hurtPlayer(BOT_GUN.damage);
      } else {
        to.x += (Math.random() - 0.5) * 3;
        to.y += (Math.random() - 0.5) * 2;
        to.z += (Math.random() - 0.5) * 3;
        tracer(from, to);
      }
    }
  }

  for (let i = feedRows.length - 1; i >= 0; i--) {
    feedRows[i].t -= dt;
    if (feedRows[i].t <= 0) feedRows.splice(i, 1);
  }
}

function renderScoreboard() {
  const rows = [
    { name: "YOU", score: game.score, you: true },
    ...bots.map((b) => ({ name: b.name, score: b.score })),
  ].sort((a, b) => b.score - a.score);

  ui.scoreboard.innerHTML =
    `<div class="score-row" style="opacity:.5"><span>FIRST TO ${DM_LIMIT}</span><span></span></div>` +
    rows
      .map(
        (r) =>
          `<div class="score-row ${r.you ? "you" : ""}"><span>${r.name}</span><span>${r.score}</span></div>`,
      )
      .join("");
}

function respawnPlayer() {
  const ring = HALF * 0.7;
  const a = Math.random() * Math.PI * 2;
  player.pos.set(Math.cos(a) * ring, 0, Math.sin(a) * ring);
  pushOut(player.pos, PLAYER_R);
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.hp = 100;
  player.alive = true;
  player.lastHit = game.time;
  for (const s of game.slots) {
    const w = weaponFor(s);
    s.mag = w.mag;
    s.reserve = w.reserve;
  }
  refillEquipment();
  ui.respawning.classList.add("hidden");
  syncHud();
}

function endDeathmatch(won) {
  game.over = true;
  game.running = false;
  controls.unlock();
  ui.respawning.classList.add("hidden");
  ui.dead.querySelector("h1").textContent = won ? "VICTORY" : "DEFEATED";
  ui.dead.querySelector("h1").className = won ? "" : "red";
  ui.deadWave.textContent = game.score;
  ui.deadKills.textContent = game.kills;
  won ? sfx.unlock() : sfx.death();
  ui.dead.classList.remove("hidden");
}

/** Start a free-for-all using the class you built. */
function startDeathmatch() {
  console.log("[zombie attack] starting free-for-all");
  const c = mpClasses[mpIndex];
  game.dm = true;
  game.score = 0;

  resetGame();
  clearBots();

  // your class, in your hands
  const slots = [];
  if (c.primary) slots.push({ id: c.primary, ...ammoFor(c.primary) });
  if (c.secondary) slots.push({ id: c.secondary, ...ammoFor(c.secondary) });
  slots.push({ id: "knife", mag: 0, reserve: 0 });
  game.slots = slots;
  game.weapon = 0;
  for (const vm of Object.values(viewmodels)) vm.visible = false;
  viewmodels[game.slots[0].id].visible = true;

  game.toSpawn = 0;
  game.intermission = 999999; // no zombie waves in here
  for (let i = 0; i < 5; i++) spawnBot(i);

  ui.scoreboard.classList.remove("hidden");
  renderScoreboard();
  renderLoadout();
  banner("FREE FOR ALL", 2200);
  toast(`FIRST TO ${DM_LIMIT} KILLS`);
  syncHud();
  beginPlay();
}

const ammoFor = (id) => {
  const w = weaponById(id);
  return { mag: w.mag, reserve: w.reserve };
};

/* ── equipment: Z throws lethal, X throws tactical ───────────── */

const throwables = [];
const smokes = [];
const lure = { x: 0, z: 0, until: 0 };

const lureActive = () => game.time < lure.until;

function refillEquipment() {
  kit.lethal = 2;
  kit.tactical = 2;
  syncHud();
}

/** Whichever lethal and tactical the active class is carrying. */
function equipChoice() {
  const c = mpClasses?.[mpIndex];
  if (!c) return { lethal: null, tactical: null };
  // no defaults: you carry only what you picked in the class screen
  return {
    lethal: EQUIP_LETHAL[c.lethal] ? c.lethal : null,
    tactical: EQUIP_TACTICAL[c.tactical] ? c.tactical : null,
  };
}

function throwEquipment(isLethal) {
  if (!game.running || game.over || !player.alive) return;
  if (!game.dm) return; // lethals and tacticals are a multiplayer thing

  const choice = equipChoice();
  const id = isLethal ? choice.lethal : choice.tactical;
  if (!id) {
    toast(`NO ${isLethal ? "LETHAL" : "TACTICAL"} — CHOOSE ONE IN YOUR CLASS`);
    sfx.dryFire();
    return;
  }
  const def = isLethal ? EQUIP_LETHAL[id] : EQUIP_TACTICAL[id];

  // C4 already out? pressing again sets it off instead of throwing another
  if (isLethal && id === "c4") {
    const live = throwables.filter((t) => t.id === "c4");
    if (live.length) {
      for (const t of live) blowUp(t);
      return;
    }
  }

  if (isLethal ? kit.lethal <= 0 : kit.tactical <= 0) {
    sfx.dryFire();
    return;
  }
  if (isLethal) kit.lethal--;
  else kit.tactical--;

  camera.getWorldDirection(camDir);
  const size = def.size ?? 0.16;
  const mesh = new THREE.Mesh(
    UNIT_BOX,
    new THREE.MeshLambertMaterial({ color: def.colour, emissive: 0x101010 }),
  );
  mesh.scale.set(size, size, size * 1.3);
  mesh.position.copy(camera.position).addScaledVector(camDir, 0.8);
  scene.add(mesh);

  throwables.push({
    id,
    def,
    isLethal,
    mesh,
    vel: camDir.clone().multiplyScalar(def.kind === "proximity" ? 10 : 17).add(new THREE.Vector3(0, 3.2, 0)),
    fuse: def.fuse ?? Infinity,
    armed: def.kind === "proximity" ? -def.arm : 0,
    resting: false,
  });

  sfx.swap();
  syncHud();
}

function removeThrowable(i) {
  const t = throwables[i];
  scene.remove(t.mesh);
  t.mesh.material.dispose();
  throwables.splice(i, 1);
}

function blowUp(t) {
  const i = throwables.indexOf(t);
  if (i === -1) return;
  explode(t.mesh.position.clone(), t.def.radius, t.def.damage);
  removeThrowable(i);
}

/** Flash, concussion, smoke, decoy and shock all land here. */
function tacticalBurst(def, pos) {
  sfx.explosion?.(pos.distanceTo(player.pos));

  if (def.effect === "smoke") {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 0.62, 12, 9),
      new THREE.MeshBasicMaterial({ color: 0xb8bcc0, transparent: true, opacity: 0.55 }),
    );
    cloud.position.copy(pos).setY(1.5);
    scene.add(cloud);
    smokes.push({ mesh: cloud, pos: cloud.position.clone(), radius: def.radius * 0.62, life: def.time });
    return;
  }

  if (def.effect === "decoy") {
    lure.x = pos.x;
    lure.z = pos.z;
    lure.until = game.time + def.time;
    toast("DECOY DRAWING THEM IN");
    return;
  }

  const reach = (p) => p.distanceTo(pos) <= def.radius;

  if (player.alive && reach(player.pos)) {
    const k = 1 - player.pos.distanceTo(pos) / def.radius;
    if (def.effect === "blind") player.blind = Math.max(player.blind ?? 0, def.time * k);
    else player.slow = Math.max(player.slow ?? 0, def.time * k);
  }

  for (const z of zombies) {
    if (z.dying > 0 || !reach(z.group.position)) continue;
    z.stun = Math.max(z.stun ?? 0, def.time * 0.7);
  }

  for (const b of bots) {
    if (!b.alive || !reach(b.group.position)) continue;
    if (def.effect === "blind") b.blind = Math.max(b.blind ?? 0, def.time);
    else b.slow = Math.max(b.slow ?? 0, def.time);
  }
}

function updateThrowables(dt) {
  for (let i = throwables.length - 1; i >= 0; i--) {
    const t = throwables[i];
    const m = t.mesh;

    if (!t.resting) {
      t.vel.y -= GRAVITY * dt;
      m.position.addScaledVector(t.vel, dt);
      m.rotation.x += dt * 7;
      m.rotation.z += dt * 5;

      // an axe kills whatever it touches
      if (t.def.kind === "impact") {
        for (const z of zombies) {
          if (z.dying > 0) continue;
          if (z.group.position.distanceTo(m.position) < 1.1) {
            damageZombie(z, z.maxHp, true, camDir, m.position);
            removeThrowable(i);
            break;
          }
        }
        if (!throwables.includes(t)) continue;
        for (const b of bots) {
          if (!b.alive) continue;
          if (b.group.position.distanceTo(m.position) < 1.1) {
            damageBot(b, b.maxHp, true, camDir, m.position);
            removeThrowable(i);
            break;
          }
        }
        if (!throwables.includes(t)) continue;
      }

      const floor = groundHeightAt(m.position, 0.2, m.position.y) + t.def.size * 0.5;
      if (m.position.y <= floor) {
        m.position.y = floor;
        if (t.def.kind === "stick" || t.def.kind === "impact" || Math.abs(t.vel.y) < 2.2) {
          t.vel.set(0, 0, 0);
          t.resting = true;
        } else {
          t.vel.y *= -0.4;
          t.vel.x *= 0.6;
          t.vel.z *= 0.6;
        }
      }
      const lim = HALF - 0.5;
      m.position.x = THREE.MathUtils.clamp(m.position.x, -lim, lim);
      m.position.z = THREE.MathUtils.clamp(m.position.z, -lim, lim);
    }

    if (t.def.kind === "remote") continue; // waits for you

    if (t.fuse !== Infinity) {
      t.fuse -= dt;
      if (t.fuse <= 0) {
        if (t.isLethal) blowUp(t);
        else {
          tacticalBurst(t.def, m.position.clone());
          removeThrowable(i);
        }
        continue;
      }
    }

    if (t.def.kind === "proximity" && t.resting) {
      t.armed += dt;
      if (t.armed > 0) {
        const near =
          zombies.some((z) => z.dying <= 0 && z.group.position.distanceTo(m.position) < t.def.trigger) ||
          bots.some((b) => b.alive && b.group.position.distanceTo(m.position) < t.def.trigger);
        if (near) blowUp(t);
      }
    }
  }

  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.life -= dt;
    s.mesh.material.opacity = 0.55 * Math.min(1, s.life / 1.5);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      smokes.splice(i, 1);
    }
  }

  // being flashed whites the screen out
  if (player.blind > 0) {
    player.blind -= dt;
    ui.flash.style.opacity = String(Math.min(1, player.blind / 1.4) * 0.95);
  } else if (ui.flash.style.opacity !== "0") {
    ui.flash.style.opacity = "0";
  }
  if (player.slow > 0) player.slow -= dt;

  /*
   * Standing in a crack. It burns while you are in it and stops the moment
   * you are out, which is what makes the streets a question of where you put
   * your feet rather than a wall you cannot cross.
   */
  if (player.alive && player.pos.y < 1.2 && lavaPools.length && inLava(player.pos.x, player.pos.z)) {
    hurtPlayer(22 * dt, "the lava");
    ui.vignette.style.opacity = "0.5";
    player.lastHit = game.time;
  }

  // Mending: health coming back a little at a time rather than all at once
  if (powerActive("regen") && player.hp > 0) {
    player.hp = Math.min(player.maxHp, player.hp + powerAmount("regen") * dt);
    syncHud();
  }
}

/** Smoke hides you: used by the bots' line-of-sight test. */
function smokeBetween(ax, az, bx, bz) {
  for (const s of smokes) {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let u = ((s.pos.x - ax) * dx + (s.pos.z - az) * dz) / len2;
    u = Math.max(0, Math.min(1, u));
    const px = ax + dx * u;
    const pz = az + dz * u;
    if (Math.hypot(s.pos.x - px, s.pos.z - pz) < s.radius) return true;
  }
  return false;
}

/* ── device and touch controls ───────────────────────────────── */


function applyDevice(kind) {
  touchMode = kind === "touch";
  try {
    localStorage.setItem(DEVICE_KEY, kind);
  } catch {
    /* storage unavailable */
  }
  $("touch").classList.toggle("hidden", !touchMode);
  renderDeviceLine();
}

function renderDeviceLine() {
  const el = $("device-line");
  if (!el) return;
  el.innerHTML = `Playing on <b>${touchMode ? "iPad / tablet" : "laptop"}</b> —
    <button id="device-change">change</button>`;
}

function askDevice() {
  $("device").classList.remove("hidden");
}

$("device").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-device]");
  if (!el) return;
  applyDevice(el.dataset.device);
  $("device").classList.add("hidden");
  sfx.click?.();
});

/* ── looking around by dragging ── */

let lookId = null;
let lookX = 0;
let lookY = 0;

addEventListener(
  "touchstart",
  (e) => {
    if (!touchMode || !game.running) return;
    for (const t of e.changedTouches) {
      // the left third drives the stick; anywhere else turns the camera
      if (t.clientX > innerWidth * 0.33 && lookId === null) {
        lookId = t.identifier;
        lookX = t.clientX;
        lookY = t.clientY;
      }
    }
  },
  { passive: true },
);

addEventListener(
  "touchmove",
  (e) => {
    if (!touchMode || lookId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      yaw -= (t.clientX - lookX) * LOOK_SENS;
      pitch -= (t.clientY - lookY) * LOOK_SENS;
      pitch = THREE.MathUtils.clamp(pitch, -1.5, 1.5);
      lookX = t.clientX;
      lookY = t.clientY;
    }
  },
  { passive: true },
);

addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
});

/* ── the movement stick ── */

let stickId = null;
const stick = $("stick");
const knob = $("stick-knob");

stick.addEventListener(
  "touchstart",
  (e) => {
    const t = e.changedTouches[0];
    stickId = t.identifier;
    dragStick(t);
  },
  { passive: true },
);

addEventListener(
  "touchmove",
  (e) => {
    if (stickId === null) return;
    for (const t of e.changedTouches) if (t.identifier === stickId) dragStick(t);
  },
  { passive: true },
);

addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== stickId) continue;
    stickId = null;
    move2d.x = 0;
    move2d.y = 0;
    knob.style.transform = "translate(0,0)";
  }
});

function dragStick(t) {
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = t.clientX - cx;
  let dy = t.clientY - cy;
  const max = r.width / 2;
  const len = Math.hypot(dx, dy) || 1;
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  move2d.x = dx / max;
  move2d.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

/* ── the buttons ── */

let fireTouchId = null;

$("touch").addEventListener("touchstart", (e) => {
  const el = e.target.closest("button[data-touch]");
  if (!el) return;
  e.preventDefault();
  const what = el.dataset.touch;

  if (what === "fire") {
    game.triggerHeld = true;
    fireTouchId = e.changedTouches[0].identifier;
  }
  if (what === "jump" && player.grounded && player.alive) {
    player.vy = 7.2;
    player.grounded = false;
  }
  if (what === "reload") startReload();
  // no right button on a tablet, so it latches instead of being held
  if (what === "aim") setAiming(!aim.held);
  if (what === "crouch") crouchHeld = !crouchHeld;
  if (what === "power") activatePower();
  if (what === "lethal") throwEquipment(true);
  if (what === "tactical") throwEquipment(false);
  if (what === "box") useBox();
  if (what === "withdraw" && nearThing?.kind === "bank") useBank(true);
  if (what === "w1") switchWeapon(0);
  if (what === "w2") switchWeapon(1);
  if (what === "w3") switchWeapon(2);
  if (what === "pause") {
    game.running = false;
    ui.pause.classList.remove("hidden");
  }
});

// released, cancelled, or the finger wandered off — either way, stop firing
const endFireTouch = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === fireTouchId) {
      fireTouchId = null;
      releaseTrigger();
    }
  }
};
addEventListener("touchend", endFireTouch);
addEventListener("touchcancel", endFireTouch);

/* ── boot ── */

let saved = null;
try {
  saved = localStorage.getItem(DEVICE_KEY);
} catch {
  /* storage unavailable */
}

if (saved) applyDevice(saved);
else askDevice();

document.body.addEventListener("click", (e) => {
  if (e.target.closest("#device-change")) askDevice();
});

/* ── shop, tokens and revives ────────────────────────────────── */

function renderShopButton() {
  $("shop-sub").textContent = freebieReady()
    ? "Daily reward waiting"
    : `${shop.unlimited ? "∞" : shop.tokens} token${shop.tokens === 1 && !shop.unlimited ? "" : "s"}`;
}

function renderShop() {
  const offer = offerOfTheDay();
  $("shop-coins").textContent = wallet.coins;
  $("shop-tokens").textContent = shop.unlimited ? "∞" : shop.tokens;

  $("shop-body").innerHTML = `
    <div class="offer">
      <div class="tag">TODAY ONLY</div>
      <div class="name">${offer.name}</div>
      <div class="detail">${offer.detail}${offer.aed ? ` — ${offer.aed} AED` : ""}</div>
    </div>

    <div class="freebie ${freebieReady() ? "" : "taken"}">
      <span>${
        freebieReady()
          ? `Your daily reward is waiting — ${DAILY_COINS} coins.`
          : "Daily reward already claimed. Come back tomorrow."
      }</span>
      ${freebieReady() ? `<button data-shop="freebie">CLAIM</button>` : ""}
    </div>

    <div class="panel-label">TOKENS — one revive each, up to ${MAX_REVIVES} a game</div>
    <div class="pack-grid">
      ${TOKEN_PACKS.map((p) => {
        const price = priceOf(p);
        const cut = offer.half && p.aed !== price;
        const label = p.tokens === Infinity ? "Unlimited" : `${p.tokens} token${p.tokens > 1 ? "s" : ""}`;
        return `
          <button class="pack ${p.tokens === Infinity ? "unlimited" : ""}" data-shop="pack:${p.id}">
            <span class="n">${label}</span>
            ${p.coins ? `<span class="p">${p.coins} coins</span>` : ""}
            <span class="p">${cut ? `<span class="was">${p.aed} AED</span> ` : ""}${price} AED</span>
          </button>`;
      }).join("")}
    </div>

    <div class="det-note warn" style="margin-top:18px">
      Only the single token can be bought with coins. Real-money purchases need
      a payment provider and a server to verify them, which this build does not
      have — those prices are what they would cost.
    </div>`;
}

$("shop-btn").addEventListener("click", () => {
  renderShop();
  $("shop").classList.remove("hidden");
});

$("shop-close").addEventListener("click", () => $("shop").classList.add("hidden"));

$("shop-body").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-shop]");
  if (!el) return;
  const what = el.dataset.shop;

  if (what === "freebie") {
    const got = claimFreebie();
    if (got) {
      earnCoins(got);
      sfx.unlock();
      toast(`+${got} COINS`);
    }
  }

  if (what.startsWith("pack:")) {
    const pack = TOKEN_PACKS.find((p) => p.id === what.slice(5));
    const result = buyPack(pack, wallet, saveWallet);
    if (result === "ok") {
      sfx.unlock();
    } else if (result === "poor") {
      sfx.dryFire();
      toast(`NEED ${pack.coins - wallet.coins} MORE COINS`);
    } else {
      sfx.dryFire();
      toast("REAL MONEY PURCHASES ARE NOT BUILT YET");
    }
  }

  renderShop();
  renderShopButton();
});

/** Spend a token to get back up where you fell. */
function reviveWithToken() {
  if (game.revivesUsed >= MAX_REVIVES || !hasToken()) return;
  if (!spendToken()) return;

  game.revivesUsed++;
  game.over = false;
  player.alive = true;
  player.hp = player.maxHp;
  player.lastHit = game.time;
  game.killedBy = null;

  // clear the crowd that killed you so you are not dropped straight back in
  for (const z of zombies) {
    if (z.dying <= 0 && z.group.position.distanceTo(player.pos) < 14) killZombie(z);
  }

  ui.dead.classList.add("hidden");
  game.running = true;
  clock.getDelta();
  grabMouse();
  sfx.unlock();
  toast(`REVIVED — ${MAX_REVIVES - game.revivesUsed} LEFT THIS GAME`);
  syncHud();
  renderShopButton();
}

$("revive-btn").addEventListener("click", reviveWithToken);

renderShopButton();

/*
 * A window on the running game, for the smoke test in test/ — which drives a
 * real browser and needs to see whether waves actually advance. Development
 * only; the built bundle drops the whole block.
 */
if (import.meta.env.DEV) {
  window.__probe = {
    game,
    player,
    zombies,
    perkMachines,
    ownedPerks,
    barriers,
    wallBuys,
    packMachines,
    bankTellers,
    workbenches,
    turbineSockets,
    partPickups,
    carried,
    builtSet: built,
    quest,
    leroy,
    bank,
    packCurrentWeapon,
    useBoxDirect: grantFromBox,
    useBank,
    buildAtBench,
    placeTurbine,
    freeLeroy,
    weaponFor,
    magnifyOf,
    liveCap,
    scene,
    LIGHT_BUDGET,
    lavaPools,
    bus,
    BUS,
    busCollide,
    inLava,
    obstacles,
    mysteryBoxes,
    PLAYER_R,
    buyBarrier,
    buyWallGun,
    nukeTheMap,
    powerActive,
    powerAmount,
    SKINS,
    wallet,
    liveCount,
    buyPerk,
    PERKS_FOR_SALE,
    startWave,
    spawnZombie,
    killZombie,
    digOutZombie,
    resetGame,
    endGame,
    reviveWithToken,
    shopState: shop,
    hasToken,
    STUCK_TIME,
    bonus,
    bonusActive,
    lure,
    lureActive,
    MAPS,
    WEAPONS,
    aim,
    aiming,
    setAiming,
    hasSights,
    zoomOf,
    camera,
    START_POINTS,
    fire,
    activatePower,
    startDeathmatch,
    toLobby,
    beginPlay,
  };
}

// Tell the watchdog in index.html that we got this far, so it stops waiting.
window.__started = true;
