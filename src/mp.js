/*
 * Multiplayer: free-for-all against real people.
 *
 * No skin powers here — everyone fights with the same rules, and the only
 * thing that separates players is the class they built.
 *
 * Ten points buy a class. Every weapon, attachment, perk, grenade and wildcard
 * costs one. Spend them how you like.
 */

const KEY = "za:classes";
export const CLASS_COUNT = 5;
export const MAX_POINTS = 10;

export const PERKS = [
  { id: "lightweight", name: "Lightweight", tier: 1, desc: "Move faster on foot." },
  { id: "flakjacket", name: "Flak Jacket", tier: 1, desc: "Take less explosive damage." },
  { id: "ghost", name: "Ghost", tier: 1, desc: "Invisible on radar while moving." },
  { id: "blastsuppressor", name: "Blast Suppressor", tier: 1, desc: "No radar ping when you thrust." },
  { id: "hardwired", name: "Hard Wired", tier: 2, desc: "Immune to counter-UAV and shock." },
  { id: "scavenger", name: "Scavenger", tier: 2, desc: "Resupply ammo from the fallen." },
  { id: "coldblooded", name: "Cold Blooded", tier: 2, desc: "Hidden from targeting systems." },
  { id: "fasthands", name: "Fast Hands", tier: 2, desc: "Swap weapons and throw faster." },
  { id: "tacticalmask", name: "Tactical Mask", tier: 3, desc: "Resist flash, concussion and gas." },
  { id: "dexterity", name: "Dexterity", tier: 3, desc: "Aim faster after sprinting." },
  { id: "gung-ho", name: "Gung-Ho", tier: 3, desc: "Fire while sprinting." },
  { id: "awareness", name: "Awareness", tier: 3, desc: "Enemies are louder." },
];

export const LETHALS = [
  { id: "frag", name: "Frag", desc: "Cooked fuse, wide blast." },
  { id: "semtex", name: "Semtex", desc: "Sticks to whatever it hits." },
  { id: "c4", name: "C4", desc: "Detonated on your command." },
  { id: "trip", name: "Trip Mine", desc: "Fires when something crosses it." },
  { id: "tomahawk", name: "Combat Axe", desc: "Silent, lethal, retrievable." },
];

export const TACTICALS = [
  { id: "flash", name: "Flashbang", desc: "Blinds anything looking at it." },
  { id: "concussion", name: "Concussion", desc: "Slows movement and aim." },
  { id: "smoke", name: "Smoke", desc: "Blocks line of sight entirely." },
  { id: "decoy", name: "Decoy", desc: "Fake gunfire on the radar." },
  { id: "shock", name: "Shock Charge", desc: "Stuns whoever trips it." },
];

export const ATTACHMENTS = [
  { id: "reflex", name: "Reflex Sight", desc: "Clean red dot." },
  { id: "elo", name: "ELO Sight", desc: "Wider sight picture." },
  { id: "acog", name: "ACOG Scope", desc: "Magnified optic." },
  { id: "grip", name: "Foregrip", desc: "Less recoil." },
  { id: "extmag", name: "Extended Mag", desc: "More rounds per magazine." },
  { id: "fastmag", name: "Fast Mag", desc: "Quicker reloads." },
  { id: "suppressor", name: "Suppressor", desc: "Quiet, and off the radar." },
  { id: "laser", name: "Laser Sight", desc: "Tighter hipfire." },
  { id: "stock", name: "Stock", desc: "Move faster while aiming." },
  { id: "quickdraw", name: "Quickdraw", desc: "Aim down sights faster." },
];

export const WILDCARDS = [
  { id: "gunfighter", name: "Primary Gunfighter", desc: "A third attachment on your primary." },
  { id: "perkgreed1", name: "Perk 1 Greed", desc: "A second Perk 1." },
  { id: "perkgreed2", name: "Perk 2 Greed", desc: "A second Perk 2." },
  { id: "perkgreed3", name: "Perk 3 Greed", desc: "A second Perk 3." },
  { id: "overkill", name: "Overkill", desc: "Carry two primary weapons." },
  { id: "dangerclose", name: "Danger Close", desc: "A second lethal." },
];

const blankClass = (i) => ({
  name: `CUSTOM ${i + 1}`,
  primary: null,
  primaryAtt: [],
  secondary: null,
  secondaryAtt: [],
  perks: [null, null, null],
  lethal: null,
  tactical: null,
  wildcards: [],
});

export function loadClasses() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw) && raw.length === CLASS_COUNT) return raw;
  } catch {
    /* fall through to defaults */
  }
  return Array.from({ length: CLASS_COUNT }, (_, i) => blankClass(i));
}

export function saveClasses(classes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(classes));
  } catch {
    /* storage unavailable */
  }
}

/** Every chosen item costs one point. */
export function pointsUsed(c) {
  let n = 0;
  if (c.primary) n++;
  if (c.secondary) n++;
  n += c.primaryAtt.length + c.secondaryAtt.length;
  n += c.perks.filter(Boolean).length;
  if (c.lethal) n++;
  if (c.tactical) n++;
  n += c.wildcards.length;
  return n;
}

export const attachmentLimit = (c) => (c.wildcards.includes("gunfighter") ? 3 : 2);
