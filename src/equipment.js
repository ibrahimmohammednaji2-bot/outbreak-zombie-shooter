/*
 * Lethal and tactical equipment. `kind` decides how main.js arms it:
 *   fuse       — timer from the moment it leaves your hand
 *   remote     — sits until you press V
 *   proximity  — arms, then triggers on anything that walks close
 */

export const LETHALS = [
  {
    id: "frag",
    name: "Frag Grenade",
    kind: "fuse",
    desc: "Cooked fuse, wide blast. Bounces off walls.",
    count: 2,
    fuse: 2.4,
    radius: 8,
    damage: 150,
    color: 0x39421f,
    size: 0.16,
  },
  {
    id: "c4",
    name: "C4",
    kind: "remote",
    desc: "Sticks where it lands. Detonate with V, on your terms.",
    count: 2,
    radius: 9,
    damage: 210,
    color: 0xb5b1a0,
    size: 0.2,
  },
  {
    id: "trip",
    name: "Trip Mine",
    kind: "proximity",
    desc: "Arms after a moment, fires when anything crosses it.",
    count: 2,
    arm: 1.2,
    trigger: 3.4,
    radius: 7,
    damage: 170,
    color: 0x8a2f2f,
    size: 0.22,
  },
];

export const TACTICALS = [
  {
    id: "flash",
    name: "Flashbang",
    kind: "fuse",
    tactical: "blind",
    desc: "Whites out anything with line of sight to it.",
    count: 2,
    fuse: 1.6,
    radius: 16,
    blind: 4.5,
    color: 0xd8d2b4,
    size: 0.15,
  },
  {
    id: "concussion",
    name: "Concussion",
    kind: "fuse",
    tactical: "slow",
    desc: "Crushes movement speed and aim for several seconds.",
    count: 2,
    fuse: 1.4,
    radius: 12,
    slow: 3.5,
    color: 0x2f5f8a,
    size: 0.15,
  },
  {
    id: "smoke",
    name: "Smoke",
    kind: "fuse",
    tactical: "smoke",
    desc: "Blocks line of sight entirely. Nobody shoots what they cannot see.",
    count: 2,
    fuse: 1.2,
    radius: 9,
    duration: 9,
    color: 0x9aa0a6,
    size: 0.16,
  },
];

export const lethalById = (id) => LETHALS.find((l) => l.id === id) ?? LETHALS[0];
export const tacticalById = (id) =>
  TACTICALS.find((t) => t.id === id) ?? TACTICALS[0];
