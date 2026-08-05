/*
 * Attachments. One per slot, so a weapon carries at most three.
 * Every field in `mods` is a fraction applied to the base stat, except
 * zoomFov (degrees, subtracted) and the flags at the bottom.
 */

export const SLOTS = [
  { id: "optic", name: "Optic" },
  { id: "ammo", name: "Ammunition" },
  { id: "barrel", name: "Barrel & Rail" },
];

export const ATTACHMENTS = [
  // ── optics ────────────────────────────────────────────────────
  {
    id: "reddot",
    slot: "optic",
    name: "Red Dot Sight",
    desc: "Clean sight picture. Snaps to aim faster.",
    mods: { adsSpeed: 0.4, zoomFov: 5 },
  },
  {
    id: "holo",
    slot: "optic",
    name: "Holographic",
    desc: "Wide view aimed, slightly tighter shots.",
    mods: { spread: -0.12, zoomFov: 3 },
  },
  {
    id: "scope",
    slot: "optic",
    name: "Variable Scope",
    desc: "Heavy magnification. Slow to bring up.",
    mods: { zoomFov: 16, adsSpeed: -0.25, spread: -0.22 },
  },
  {
    id: "thermal",
    slot: "optic",
    name: "Thermal",
    desc: "Targets glow. Costs you peripheral vision.",
    mods: { zoomFov: 10, adsSpeed: -0.15, thermal: 1 },
  },

  // ── ammunition ────────────────────────────────────────────────
  {
    id: "fmj",
    slot: "ammo",
    name: "FMJ",
    desc: "Full metal jacket. Hits considerably harder.",
    mods: { damage: 0.2 },
  },
  {
    id: "hollow",
    slot: "ammo",
    name: "Hollow Point",
    desc: "Headshots become brutal. Body shots unchanged.",
    mods: { headMult: 0.5 },
  },
  {
    id: "extmag",
    slot: "ammo",
    name: "Extended Mag",
    desc: "Half again as many rounds before reloading.",
    mods: { mag: 0.5 },
  },
  {
    id: "fastmag",
    slot: "ammo",
    name: "Fast Mags",
    desc: "Reloads noticeably quicker.",
    mods: { reload: -0.32 },
  },
  {
    id: "highcal",
    slot: "ammo",
    name: "High Calibre",
    desc: "More damage, heavier kick.",
    mods: { damage: 0.3, recoil: 0.35 },
  },

  // ── barrel & rail ─────────────────────────────────────────────
  {
    id: "rapid",
    slot: "barrel",
    name: "Rapid Fire",
    desc: "Much faster cyclic rate. Sprays wider.",
    mods: { rpm: -0.24, spread: 0.28 },
  },
  {
    id: "grip",
    slot: "barrel",
    name: "Foregrip",
    desc: "Kills recoil and tightens the cone.",
    mods: { recoil: -0.38, spread: -0.2 },
  },
  {
    id: "suppressor",
    slot: "barrel",
    name: "Suppressor",
    desc: "Quiet. Enemies are slower to find you.",
    mods: { volume: -0.65, stealth: 0.4, damage: -0.06 },
  },
  {
    id: "laser",
    slot: "barrel",
    name: "Laser Sight",
    desc: "Far more accurate from the hip.",
    mods: { spread: -0.34 },
  },
  {
    id: "longbarrel",
    slot: "barrel",
    name: "Long Barrel",
    desc: "Extra damage at the cost of handling.",
    mods: { damage: 0.12, adsSpeed: -0.2, spread: -0.1 },
  },
];

export const byAttachmentId = (id) => ATTACHMENTS.find((a) => a.id === id);
export const forSlot = (slot) => ATTACHMENTS.filter((a) => a.slot === slot);

/**
 * Fold a weapon's chosen attachments into a derived stat block. The base
 * definition is never mutated — the match uses the returned copy.
 */
export function applyAttachments(base, chosen = {}) {
  const w = {
    ...base,
    attachments: { ...chosen },
    adsSpeed: 1,
    stealth: 0,
    thermal: false,
  };

  for (const slot of SLOTS) {
    const a = byAttachmentId(chosen[slot.id]);
    if (!a) continue;
    const m = a.mods;
    if (m.damage) w.damage *= 1 + m.damage;
    if (m.headMult) w.headMult *= 1 + m.headMult;
    if (m.mag) w.mag = Math.round(w.mag * (1 + m.mag));
    if (m.reload) w.reload *= 1 + m.reload;
    if (m.rpm) w.rpm *= 1 + m.rpm;
    if (m.spread) w.spread *= 1 + m.spread;
    if (m.recoil) w.recoil *= 1 + m.recoil;
    if (m.volume) w.volume *= 1 + m.volume;
    if (m.adsSpeed) w.adsSpeed *= 1 + m.adsSpeed;
    if (m.zoomFov) w.zoomFov = Math.max(12, w.zoomFov - m.zoomFov);
    if (m.stealth) w.stealth += m.stealth;
    if (m.thermal) w.thermal = true;
  }

  w.spread = Math.max(0.0012, w.spread);
  w.rpm = Math.max(0.03, w.rpm);
  return w;
}
