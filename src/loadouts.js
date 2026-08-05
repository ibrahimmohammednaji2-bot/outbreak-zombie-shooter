import { byId } from "./weapons.js";
import { byAttachmentId, SLOTS as ATTACHMENT_SLOTS } from "./attachments.js";
import { lethalById, tacticalById } from "./equipment.js";

export const LOADOUT_COUNT = 5;
export const WEAPONS_PER_LOADOUT = 3;

const KEY = "outbreak:loadouts";

/* Five presets so a new player can deploy without touching the closet. */
const PRESETS = [
  {
    name: "ASSAULT",
    weapons: [
      { id: "m4", att: { optic: "reddot", ammo: "extmag", barrel: "grip" } },
      { id: "pump", att: { ammo: "fmj" } },
      { id: "m9", att: {} },
    ],
    lethal: "frag",
    tactical: "flash",
  },
  {
    name: "RUSHER",
    weapons: [
      { id: "vector", att: { barrel: "laser", ammo: "fastmag" } },
      { id: "auto12", att: { ammo: "extmag" } },
      { id: "deagle", att: { ammo: "hollow" } },
    ],
    lethal: "c4",
    tactical: "concussion",
  },
  {
    name: "MARKSMAN",
    weapons: [
      { id: "bolt", att: { optic: "scope", ammo: "fmj", barrel: "suppressor" } },
      { id: "dmr", att: { optic: "reddot" } },
      { id: "revolver", att: {} },
    ],
    lethal: "trip",
    tactical: "smoke",
  },
  {
    name: "SUPPORT",
    weapons: [
      { id: "dingo", att: { barrel: "grip", ammo: "extmag" } },
      { id: "mp5", att: { optic: "holo" } },
      { id: "m9", att: { barrel: "suppressor" } },
    ],
    lethal: "trip",
    tactical: "flash",
  },
  {
    name: "DEMOLITION",
    weapons: [
      { id: "rpg", att: {} },
      { id: "ak47", att: { ammo: "fmj", barrel: "grip" } },
      { id: "auto12", att: {} },
    ],
    lethal: "c4",
    tactical: "flash",
  },
];

function sanitiseWeapon(entry) {
  const w = byId(entry?.id);
  if (!w) return null;
  const att = {};
  for (const slot of ATTACHMENT_SLOTS) {
    const a = byAttachmentId(entry?.att?.[slot.id]);
    if (a && a.slot === slot.id) att[slot.id] = a.id;
  }
  return { id: w.id, att };
}

function sanitise(raw, index) {
  const preset = PRESETS[index] ?? PRESETS[0];
  const weapons = (Array.isArray(raw?.weapons) ? raw.weapons : preset.weapons)
    .map(sanitiseWeapon)
    .filter(Boolean)
    .slice(0, WEAPONS_PER_LOADOUT);

  return {
    name: (raw?.name ?? preset.name).toString().slice(0, 16).toUpperCase(),
    weapons: weapons.length ? weapons : preset.weapons.map(sanitiseWeapon),
    lethal: lethalById(raw?.lethal ?? preset.lethal).id,
    tactical: tacticalById(raw?.tactical ?? preset.tactical).id,
  };
}

export function loadLoadouts() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    stored = null;
  }
  const list = Array.isArray(stored?.list) ? stored.list : [];
  const out = [];
  for (let i = 0; i < LOADOUT_COUNT; i++) out.push(sanitise(list[i], i));
  return { list: out, selected: Math.min(LOADOUT_COUNT - 1, Math.max(0, stored?.selected ?? 0)) };
}

export function saveLoadouts(list, selected) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ list, selected }));
  } catch {
    /* private browsing — loadouts just won't survive the tab */
  }
}

export const emptySlotHint = "EMPTY — pick a weapon on the left";
