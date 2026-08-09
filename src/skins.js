/*
 * Skins, their powers, and the store.
 *
 * Seven rarities, twenty skins each. A skin repaints the operator and changes
 * what they are actually wearing — helmets, hoods, masks, plating, packs,
 * capes — and carries one power on a sixty second cooldown.
 */

import { readSave, writeSave, restoreLast } from "./account.js";

export const RARITIES = [
  { id: "common", label: "COMMON", colour: "#9aa0a6", cost: 50, currency: "coins", sat: 0.16, light: 0.4 },
  { id: "uncommon", label: "UNCOMMON", colour: "#5fd77a", cost: 100, currency: "coins", sat: 0.3, light: 0.4 },
  { id: "rare", label: "RARE", colour: "#4aa3ff", cost: 250, currency: "coins", sat: 0.46, light: 0.42 },
  { id: "epic", label: "EPIC", colour: "#b46bff", cost: 500, currency: "coins", sat: 0.58, light: 0.44 },
  { id: "legendary", label: "LEGENDARY", colour: "#ffa63d", cost: 1000, currency: "coins", sat: 0.7, light: 0.48 },
  { id: "special", label: "SPECIAL", colour: "#ff5fd2", cost: 10, currency: "aed", sat: 0.82, light: 0.52 },
  { id: "op", label: "OP", colour: "#ff3b3b", cost: 20, currency: "aed", sat: 0.95, light: 0.55 },
];

export const rarityOf = (id) => RARITIES.find((r) => r.id === id) ?? RARITIES[0];

/* ── powers ──────────────────────────────────────────────────── */

/*
 * Twenty kinds of effect, and every skin's power is a *pair* of them.
 *
 * One effect per skin cannot work: twenty skins to a rarity and nowhere near
 * twenty effects that suit a Common means the same one comes round again and
 * again, and the second Common heal is just the first one with a bigger
 * number. Pairing fixes it — eight gentle effects already make twenty-eight
 * distinct combinations, and each pair plays differently from every other
 * because it is two things happening at once, not one thing turned up.
 *
 * No two skins in the game are given the same pair.
 */
const EFFECTS = {
  heal:      { amount: (t) => 25 + t * 12,   dur: () => 0,            text: (a) => `restores ${a} health` },
  regen:     { amount: (t) => 3 + t * 1.1,   dur: (t) => 8 + t * 1.2, text: (a, d) => `heals ${a} health a second for ${d}s` },
  sprint:    { amount: (t) => 1.4 + t * 0.1, dur: (t) => 6 + t * 1.2, text: (a, d) => `moves you ${a.toFixed(2)}× faster for ${d}s` },
  steady:    { amount: () => 0,              dur: (t) => 6 + t * 1.4, text: (a, d) => `no spread and no recoil for ${d}s` },
  ammo:      { amount: () => 0,              dur: (t) => 5 + t * 1.2, text: (a, d) => `endless ammunition and no reloads for ${d}s` },
  refill:    { amount: () => 0,              dur: () => 0,            text: () => `fills every gun you are carrying` },
  damage:    { amount: (t) => 1.4 + t * 0.14, dur: (t) => 6 + t * 1.2, text: (a, d) => `every shot hits ${a.toFixed(2)}× harder for ${d}s` },
  frenzy:    { amount: (t) => 1.3 + t * 0.1, dur: (t) => 5 + t * 1.1, text: (a, d) => `fires ${a.toFixed(2)}× faster for ${d}s` },
  slowfield: { amount: (t) => Math.max(0.1, 0.6 - t * 0.045), dur: (t) => 6 + t * 1.2, text: (a, d) => `drags the horde down to ${Math.round(a * 100)}% speed for ${d}s` },
  freeze:    { amount: () => 0,              dur: (t) => 3 + t * 0.7, text: (a, d) => `freezes every zombie solid for ${d}s` },
  shock:     { amount: (t) => 70 + t * 22,   dur: () => 0,            text: (a) => `hurls nearby zombies back for ${a} damage` },
  blast:     { amount: (t) => 110 + t * 34,  dur: () => 0,            text: (a) => `blows everything within twenty paces apart for ${a} damage` },
  cloak:     { amount: () => 0,              dur: (t) => 5 + t * 1.1, text: (a, d) => `they lose track of you entirely for ${d}s` },
  decoy:     { amount: () => 0,              dur: (t) => 6 + t * 1.3, text: (a, d) => `leaves something they would rather chase for ${d}s` },
  shield:    { amount: () => 0,              dur: (t) => 4 + t * 0.9, text: (a, d) => `you take no damage at all for ${d}s` },
  armour:    { amount: (t) => Math.min(0.85, 0.4 + t * 0.03), dur: (t) => 7 + t * 1.3, text: (a, d) => `takes ${Math.round(a * 100)}% off everything that hits you for ${d}s` },
  vamp:      { amount: (t) => 5 + t * 2,     dur: (t) => 8 + t * 1.5, text: (a, d) => `every kill heals you ${a} health for ${d}s` },
  thorns:    { amount: (t) => 40 + t * 18,   dur: (t) => 8 + t * 1.4, text: (a, d) => `anything that claws you takes ${a} back for ${d}s` },
  points:    { amount: () => 0,              dur: (t) => 10 + t * 2,  text: (a, d) => `doubles every point you earn for ${d}s` },
  nuke:      { amount: () => 400,            dur: () => 0,            text: () => `kills every zombie on the map, for 400 points` },
};

const FRACTIONAL = new Set(["sprint", "damage", "slowfield", "frenzy", "armour", "regen"]);

/*
 * What each rarity may draw on, and how many effects its skins combine. The
 * lists grow and get nastier as you climb; the top three rarities take three
 * effects at once rather than two, which is both why they feel like a step up
 * and how there is room for every one of the hundred and forty to be unlike
 * all the others.
 */
const EFFECT_POOLS = {
  common: ["heal", "sprint", "steady", "regen", "refill", "points", "thorns", "shock"],
  uncommon: ["heal", "sprint", "steady", "regen", "refill", "points", "thorns", "shock", "vamp", "decoy", "armour"],
  rare: ["sprint", "steady", "regen", "refill", "points", "thorns", "shock", "vamp", "decoy", "armour", "ammo", "damage", "frenzy"],
  epic: ["heal", "sprint", "steady", "regen", "points", "thorns", "vamp", "decoy", "armour", "ammo", "damage", "frenzy", "cloak", "slowfield", "blast"],
  legendary: ["freeze", "shield", "slowfield", "cloak", "damage", "blast", "armour", "frenzy", "ammo", "vamp", "decoy", "regen"],
  special: ["freeze", "shield", "cloak", "damage", "ammo", "blast", "armour", "slowfield", "frenzy", "vamp", "points", "decoy"],
  op: ["nuke", "shield", "freeze", "damage", "vamp", "blast", "armour", "cloak", "ammo", "frenzy", "slowfield", "steady", "regen"],
};

// how many effects a rarity's powers combine
const COMBINE = { common: 2, uncommon: 2, rare: 2, epic: 2, legendary: 3, special: 3, op: 3 };

// 20 × 10 = 200 names, more than the 140 skins need
const PW_A = ["Surge", "Pulse", "Rush", "Veil", "Bulwark", "Cinder", "Frost", "Echo", "Rift", "Vault", "Ward", "Hunger", "Sable", "Tempest", "Halo", "Ash", "Kindle", "Umbra", "Torrent", "Zenith"];
const PW_B = ["Protocol", "Doctrine", "Reflex", "Cascade", "Instinct", "Gambit", "Overdrive", "Resolve", "Bloom", "Cycle"];

/** Every combination of `size` effects a pool can make, in a fixed order. */
function combosOf(pool, size) {
  if (size === 1) return pool.map((e) => [e]);
  const out = [];
  for (let i = 0; i <= pool.length - size; i++) {
    for (const rest of combosOf(pool.slice(i + 1), size - 1)) out.push([pool[i], ...rest]);
  }
  return out;
}

const takenCombos = new Set();
const comboKey = (c) => [...c].sort().join("+");

/** "a", "a and b", "a, b and c" — read out loud rather than machine-listed. */
const sentence = (bits) =>
  bits.length < 2 ? bits[0] : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;

function buildPart(effect, tier) {
  const spec = EFFECTS[effect];
  const raw = spec.amount(tier);
  return {
    effect,
    amount: FRACTIONAL.has(effect) ? Number(raw.toFixed(2)) : Math.round(raw),
    dur: Math.round(spec.dur(tier)),
  };
}

function makePower(index, rarityIndex, slot) {
  const rarity = RARITIES[rarityIndex].id;
  const combos = combosOf(EFFECT_POOLS[rarity], COMBINE[rarity]);

  // Walk the pool's combinations from a slot-dependent start until one nobody
  // else has is found. Each pool is sized so this always lands.
  let chosen = null;
  for (let n = 0; n < combos.length; n++) {
    const cand = combos[(slot * 7 + n) % combos.length];
    if (takenCombos.has(comboKey(cand))) continue;
    chosen = cand;
    break;
  }
  chosen ??= combos[slot % combos.length]; // should never happen; stay standing
  takenCombos.add(comboKey(chosen));

  const tier = rarityIndex * 2.2 + (slot % 5) * 0.6; // 0..~16, drives the numbers
  const parts = chosen.map((e) => buildPart(e, tier));
  const dur = Math.max(...parts.map((p) => p.dur));

  return {
    parts,
    dur,
    name: `${PW_A[index % PW_A.length]} ${PW_B[Math.floor(index / PW_A.length) % PW_B.length]}`,
    desc: `${sentence(parts.map((p) => EFFECTS[p.effect].text(p.amount, p.dur)))}.`
      .replace(/^./, (c) => c.toUpperCase()),
  };
}

/* ── gear ────────────────────────────────────────────────────── */

export const GEAR = ["helmet", "hood", "mask", "goggles", "pauldrons", "pack", "cape", "coat", "plate", "scarf"];

// what each rarity tends to be issued, low tiers plainer than high ones
const GEAR_POOLS = {
  common: [[], ["scarf"], ["pack"], ["hood"]],
  uncommon: [["hood"], ["pack", "scarf"], ["goggles"], ["mask"]],
  rare: [["helmet"], ["mask", "pack"], ["goggles", "coat"], ["pauldrons"]],
  epic: [["helmet", "pauldrons"], ["hood", "coat"], ["mask", "plate"], ["goggles", "pack", "scarf"]],
  legendary: [["helmet", "plate", "pauldrons"], ["hood", "cape"], ["mask", "plate", "pack"], ["helmet", "cape", "coat"]],
  special: [["mask", "plate", "pack"], ["hood", "cape", "goggles"], ["helmet", "pauldrons", "coat"], ["mask", "cape"]],
  op: [["helmet", "plate", "pauldrons", "cape"], ["hood", "cape", "plate", "mask"], ["helmet", "pack", "coat", "goggles"], ["mask", "plate", "cape", "pauldrons"]],
};

/* ── naming ──────────────────────────────────────────────────── */

const PREFIX = {
  common: ["Recruit", "Survivor", "Drifter", "Labourer", "Hiker", "Ranger", "Courier", "Digger", "Farmhand", "Watchman", "Trapper", "Fisher", "Miner", "Porter", "Scout", "Runner", "Tinker", "Warder", "Sifter", "Roamer"],
  uncommon: ["Ash", "Pine", "Moss", "Fern", "Slate", "Copper", "Bramble", "Thistle", "Willow", "Cedar", "Basalt", "Flint", "Clay", "Birch", "Reed", "Hollow", "Bracken", "Marsh", "Grove", "Quarry"],
  rare: ["Cobalt", "Onyx", "Frost", "Storm", "Iron", "Steel", "Azure", "Glacier", "Tempest", "Harbour", "Signal", "Beacon", "Anchor", "Current", "Sable", "Argent", "Winter", "Tide", "Pillar", "Meridian"],
  epic: ["Void", "Wraith", "Crimson", "Nether", "Obsidian", "Umbra", "Phantom", "Revenant", "Eclipse", "Vesper", "Nocturne", "Cinder", "Malice", "Hex", "Shroud", "Grim", "Dusk", "Rift", "Spectre", "Abyss"],
  legendary: ["Solar", "Ashen", "Gilded", "Radiant", "Warden", "Sovereign", "Aurelian", "Emberlord", "Dawnbreak", "Titan", "Halcyon", "Regent", "Pyre", "Vanguard", "Zenith", "Highborn", "Sunspear", "Immortal", "Colossus", "Paragon"],
  special: ["Hazmat", "Neon", "Chrome", "Vapor", "Prism", "Static", "Nitro", "Pixel", "Synth", "Laser", "Cyber", "Glitch", "Retro", "Volt", "Plasma", "Holo", "Circuit", "Arcade", "Nova", "Flux"],
  op: ["Patient Zero", "Apex", "Omega", "Singularity", "Doomsayer", "Worldbreaker", "Endbringer", "Annihilus", "Cataclysm", "Final", "Godhand", "Ruinous", "Sovereign Zero", "Ascendant", "Harbinger", "Oblivion", "Absolute", "Eternal", "Zenith Prime", "Nemesis"],
};

const SUFFIX = ["", "", "Runner", "Warden", "Hunter", "Reaper", "Guard", "Scout", "Marshal", "Vanguard", "Stalker", "Sentinel", "Raider", "Nomad", "Watcher", "Breaker", "Herald", "Keeper", "Seeker", "Wolf"];

/* ── colour ──────────────────────────────────────────────────── */

function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

const SKIN_TONES = [0xc7a887, 0xb08a63, 0x8d6a49, 0x6b4c33, 0xdcbb9a, 0xe2c8a8];

function rngFrom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* ── the catalogue ───────────────────────────────────────────── */

function build() {
  const out = [];
  let index = 0;
  RARITIES.forEach((r, ri) => {
    const rnd = rngFrom(1000 + ri * 977);
    for (let i = 0; i < 20; i++, index++) {
      const hue = (i * 360) / 20 + ri * 13;
      const primary = hslHex(hue, r.sat, r.light);
      const secondary = hslHex((hue + 22) % 360, r.sat * 0.75, r.light * 0.68);
      const accent = hslHex((hue + 190) % 360, Math.min(1, r.sat + 0.2), Math.min(0.72, r.light + 0.2));
      const tone = SKIN_TONES[(i + ri) % SKIN_TONES.length];

      const suffix = SUFFIX[(i * 7 + ri) % SUFFIX.length];
      const name = `${PREFIX[r.id][i]}${suffix ? " " + suffix : ""}`;

      out.push({
        id: `${r.id}-${i}`,
        name,
        rarity: r.id,
        skin: ri === 6 && i % 4 === 0 ? 0x7f9b63 : tone, // a few OP skins are turned
        primary,
        secondary,
        accent,
        gear: GEAR_POOLS[r.id][i % GEAR_POOLS[r.id].length],
        // the starter skin is deliberately plain — no power at all
        power: ri === 0 && i === 0 ? null : makePower(index, ri, i),
        glow: ri >= 4 ? hslHex(hue, r.sat, 0.12 + (ri - 4) * 0.05) : 0,
        free: ri === 0 && i === 0, // the Recruit you start with
      });
    }
  });
  return out;
}

export const SKINS = build();
export const skinById = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/* ── wallet and wardrobe ─────────────────────────────────────── */

export const COINS_PER_WAVE = 10;

function normalise(raw) {
  const r = raw ?? {};
  const w = {
    coins: Number.isFinite(r.coins) ? r.coins : 0,
    owned: Array.isArray(r.owned) ? r.owned.filter((id) => typeof id === "string") : [],
    equipped: typeof r.equipped === "string" ? r.equipped : SKINS[0].id,
    code: { redeemed: r.code?.redeemed === true, active: r.code?.active === true },
  };
  if (!w.owned.includes(SKINS[0].id)) w.owned.push(SKINS[0].id);
  if (!SKINS.some((s) => s.id === w.equipped)) w.equipped = SKINS[0].id;
  return w;
}

// Signed in, this is loaded from your profile. As a guest it starts empty and
// is never written anywhere.
restoreLast();
export const wallet = normalise(readSave());

export function saveWallet() {
  return writeSave(wallet); // false while signed out
}

/** Swap in the progress belonging to whoever just signed in. */
export function reloadWallet() {
  Object.assign(wallet, normalise(readSave()));
}

/** Keep what a guest earned and write it into the profile they just made. */
export function keepCurrentProgress() {
  saveWallet();
}

/** Wipe the in-memory run — used when signing out. */
export function resetWallet() {
  Object.assign(wallet, normalise(null));
}

// The redeem code is an override rather than a purchase, so switching it
// off hands everything back.
export const owns = (id) => wallet.code.active || wallet.owned.includes(id);
export const boughtOutright = (id) => wallet.owned.includes(id);

export function earnCoins(n) {
  wallet.coins += n;
  saveWallet();
}

/** Returns "ok", "poor", or "real-money". */
export function buy(skin) {
  if (owns(skin.id)) return "ok";
  const r = rarityOf(skin.rarity);
  if (r.currency === "aed") return "real-money";
  if (wallet.coins < r.cost) return "poor";
  wallet.coins -= r.cost;
  wallet.owned.push(skin.id);
  saveWallet();
  return "ok";
}

/** Marks the code as entered and switches it on. */
export function redeemCode() {
  wallet.code.redeemed = true;
  wallet.code.active = true;
  saveWallet();
  return SKINS.length;
}

/** Flips the code on or off once it has been entered. */
export function setCodeActive(on) {
  wallet.code.active = !!on;
  // an equipped skin you no longer own falls back to the starter
  if (!wallet.code.active && !wallet.owned.includes(wallet.equipped)) {
    wallet.equipped = SKINS[0].id;
  }
  saveWallet();
}

export function equip(skin) {
  if (!owns(skin.id)) return false;
  wallet.equipped = skin.id;
  saveWallet();
  return true;
}
