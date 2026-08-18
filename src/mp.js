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

/*
 * Attachments, and what each one actually does to the gun.
 *
 * Every field here is a multiplier on the weapon's own number except where
 * named otherwise, and they are applied in one place — see attachedWeapon in
 * main.js — so an attachment cannot mean one thing in the class screen and
 * another when you pull the trigger.
 *
 * ads    aim-down-sights time      spread  hipfire cone
 * zoom   magnification             recoil  kick per shot
 * mag    rounds in a magazine      reload  time to reload
 * range  falloff distance          dmg     damage per round
 */
export const ATTACHMENTS = [
  { id: "reflex", name: "Red Dot Sight", desc: "A clean sight picture and nothing else.", cost: 1, mod: {} },
  { id: "elo", name: "ELO Sight", desc: "A wider sight picture.", cost: 1, mod: {} },
  { id: "acog", name: "ACOG Scope", desc: "Four times magnification, slower onto the sights.", cost: 1, mod: { zoom: 1.6, ads: 1.15, flinch: 1.2 } },
  { id: "hybrid", name: "Hybrid Optic", desc: "A scope and a red dot. Costs two.", cost: 2, mod: { zoom: 1.35, ads: 1.08 } },
  { id: "varzoom", name: "Variable Zoom", desc: "More magnification again. Snipers only.", cost: 1, mod: { zoom: 1.9, ads: 1.2 } },
  { id: "targetfinder", name: "Target Finder", desc: "Marks what you are pointing at. Heavy and slow.", cost: 1, mod: { ads: 1.35, marks: true } },
  { id: "cpu", name: "Ballistics CPU", desc: "Steadies a long shot.", cost: 1, mod: { spread: 0.6 } },
  { id: "suppressor", name: "Suppressor", desc: "Quiet, and off the radar. Costs you reach.", cost: 1, mod: { range: 0.5, dmg: 0.96, quiet: true } },
  { id: "brake", name: "Muzzle Brake", desc: "The gun barely moves.", cost: 1, mod: { recoil: 0.6 } },
  { id: "longbarrel", name: "Long Barrel", desc: "Kills further out.", cost: 1, mod: { range: 1.35, dmg: 1.06 } },
  { id: "quickdraw", name: "Quickdraw Handle", desc: "On the sights half again as fast.", cost: 1, mod: { ads: 0.55 } },
  { id: "grip", name: "Fore Grip", desc: "Tighter hipfire and less kick.", cost: 1, mod: { spread: 0.5, recoil: 0.7 } },
  { id: "laser", name: "Laser Sight", desc: "Much tighter hipfire. Shows where you are.", cost: 1, mod: { spread: 0.55 } },
  { id: "fmj", name: "FMJ", desc: "Hits harder through cover.", cost: 1, mod: { dmg: 1.2 } },
  { id: "extmag", name: "Extended Clip", desc: "Half again as many rounds, slower to reload.", cost: 1, mod: { mag: 1.5, reload: 1.12 } },
  { id: "fastmag", name: "Fast Mag", desc: "Reloads in two thirds the time.", cost: 1, mod: { reload: 0.7 } },
  { id: "stock", name: "Adjustable Stock", desc: "Move faster with the gun up.", cost: 1, mod: { adsWalk: 1.4 } },
  { id: "selectfire", name: "Select Fire", desc: "Makes a semi-automatic fire on its own.", cost: 1, mod: { autoFire: true } },
  { id: "grenadelauncher", name: "Grenade Launcher", desc: "Two rounds under the barrel. Costs two.", cost: 2, mod: {} },
  { id: "masterkey", name: "Masterkey", desc: "A shotgun under the barrel. Costs two.", cost: 2, mod: {} },
];

export const attachmentById = (id) => ATTACHMENTS.find((a) => a.id === id);

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
