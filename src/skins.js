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
 * Twelve kinds of effect. Every skin gets its own power built from one of
 * them, with its own name, its own numbers and its own description — no two
 * skins in the game share a power.
 */
const EFFECTS = {
  heal: { amount: (t) => 25 + t * 12, dur: () => 0, text: (a) => `Restores ${a} health on the spot.` },
  sprint: { amount: (t) => 1.5 + t * 0.14, dur: (t) => 6 + t * 1.2, text: (a, d) => `Moves you ${a.toFixed(2)}× faster for ${d}s.` },
  steady: { amount: () => 0, dur: (t) => 6 + t * 1.4, text: (a, d) => `No spread and no recoil for ${d}s.` },
  ammo: { amount: () => 0, dur: (t) => 5 + t * 1.5, text: (a, d) => `Endless ammunition and no reloads for ${d}s.` },
  damage: { amount: (t) => 1.5 + t * 0.18, dur: (t) => 6 + t * 1.2, text: (a, d) => `Every shot hits ${a.toFixed(2)}× harder for ${d}s.` },
  slowfield: { amount: (t) => Math.max(0.08, 0.55 - t * 0.06), dur: (t) => 6 + t * 1.2, text: (a, d) => `Drags the horde down to ${Math.round(a * 100)}% speed for ${d}s.` },
  freeze: { amount: () => 0, dur: (t) => 3 + t * 0.9, text: (a, d) => `Freezes every zombie solid for ${d}s.` },
  shock: { amount: (t) => 80 + t * 26, dur: () => 0, text: (a) => `Hurls nearby zombies back for ${a} damage.` },
  cloak: { amount: () => 0, dur: (t) => 5 + t * 1.3, text: (a, d) => `They lose track of you entirely for ${d}s.` },
  shield: { amount: () => 0, dur: (t) => 4 + t * 1.1, text: (a, d) => `You take no damage at all for ${d}s.` },
  vamp: { amount: (t) => 5 + t * 2, dur: (t) => 8 + t * 1.5, text: (a, d) => `Every kill heals you ${a} health for ${d}s.` },
  touch: { amount: () => 0, dur: (t) => 5 + t * 1.1, text: (a, d) => `Anything that touches you dies on contact for ${d}s.` },
};

// what each rarity is allowed to roll — the ceiling rises as you climb
const EFFECT_POOLS = {
  common: ["heal", "sprint", "steady"],
  uncommon: ["heal", "sprint", "steady", "shock", "vamp"],
  rare: ["ammo", "damage", "shock", "vamp", "steady"],
  epic: ["damage", "cloak", "slowfield", "ammo", "vamp"],
  legendary: ["freeze", "shield", "slowfield", "cloak", "damage"],
  special: ["freeze", "shield", "cloak", "damage", "ammo"],
  op: ["touch", "shield", "freeze", "damage", "vamp"],
};

// 20 × 10 = 200 unique pairs, more than the 140 skins need
const PW_A = ["Surge", "Pulse", "Rush", "Veil", "Bulwark", "Cinder", "Frost", "Echo", "Rift", "Vault", "Ward", "Hunger", "Sable", "Tempest", "Halo", "Ash", "Kindle", "Umbra", "Torrent", "Zenith"];
const PW_B = ["Protocol", "Doctrine", "Reflex", "Cascade", "Instinct", "Gambit", "Overdrive", "Resolve", "Bloom", "Cycle"];

function makePower(index, rarityIndex, slot) {
  const pool = EFFECT_POOLS[RARITIES[rarityIndex].id];
  const effect = pool[slot % pool.length];
  const spec = EFFECTS[effect];
  const tier = rarityIndex * 2 + (slot % 4); // 0..15, drives the numbers

  const raw = spec.amount(tier);
  const amount = effect === "sprint" || effect === "damage" || effect === "slowfield"
    ? raw
    : Math.round(raw);
  const dur = Math.round(spec.dur(tier));

  return {
    effect,
    amount,
    dur,
    name: `${PW_A[index % PW_A.length]} ${PW_B[Math.floor(index / PW_A.length) % PW_B.length]}`,
    desc: spec.text(amount, dur),
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
