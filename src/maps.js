/*
 * Map definitions. Everything is declarative: main.js reads `props` and builds
 * boxes and cylinders from it, so a new map is data, not code.
 *
 * box  { t:"box", x, z, w, h, d, r?, c }
 * cyl  { t:"cyl", x, z, rt, rb, h, c }
 */

const box = (x, z, w, h, d, c, r = 0) => ({ t: "box", x, z, w, h, d, c, r });
const cyl = (x, z, rt, rb, h, c) => ({ t: "cyl", x, z, rt, rb, h, c });

/** Ring of props at a fixed radius — used for pillars and planters. */
function ring(count, radius, make) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push(make(Math.cos(a) * radius, Math.sin(a) * radius, a));
  }
  return out;
}

/** Deterministic scatter so a map looks the same every time you load it. */
function scatter(count, seed, make) {
  const out = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) out.push(make(rnd, i));
  return out;
}

const CRATE = 0x5a4632;
const STEEL = 0x3a4048;
const RUST = 0x5a3230;

// ══ ZOMBIES ═══════════════════════════════════════════════════════

const containers = {
  id: "containers",
  name: "Container Yard",
  mode: "zombies",
  blurb: "Open shipping yard. Long sightlines, cover you can circle.",
  half: 31,
  ground: 0x1b2028,
  fogColor: 0x0a1018,
  fogDensity: 0.0085,
  hemiSky: 0x3d5273,
  hemiGround: 0x0a0d12,
  moon: 0xa8c0e0,
  moonIntensity: 1.05,
  fires: [
    [-17, -14],
    [19, 12],
    [-13, 20],
  ],
  playerStart: [0, 8],
  props: [
    box(-14, -6, 9, 3.2, 3, 0x2f4f4a, 0.15),
    box(16, -12, 3, 3.2, 9, RUST, -0.1),
    box(8, 17, 10, 3.2, 3, 0x3a4358, 0.05),
    box(-20, 10, 3, 3.2, 8, 0x2f4f4a, -0.2),
    box(0, -20, 2.2, 2.2, 2.2, CRATE, 0.4),
    ...scatter(22, 7, (rnd) => {
      const a = rnd() * Math.PI * 2;
      const d = 7 + rnd() * 21;
      const s = 0.9 + rnd() * 0.7;
      return box(Math.cos(a) * d, Math.sin(a) * d, s, s, s, CRATE, rnd() * 3);
    }),
  ],
};

const graveyard = {
  id: "graveyard",
  name: "Graveyard",
  mode: "zombies",
  blurb: "Thick fog, dead trees, headstones. You hear them before you see them.",
  half: 28,
  ground: 0x232a22,
  fogColor: 0x0d1412,
  fogDensity: 0.013,
  hemiSky: 0x2f4438,
  hemiGround: 0x080c09,
  moon: 0x9fd4b0,
  moonIntensity: 0.95,
  fires: [
    [0, -18],
    [15, 14],
  ],
  playerStart: [0, 10],
  props: [
    // chapel ruin
    box(-4, -14, 14, 5, 0.9, 0x3b3a35),
    box(-11, -9, 0.9, 5, 10, 0x3b3a35),
    box(3, -9, 0.9, 5, 10, 0x3b3a35),
    // headstone rows
    ...scatter(46, 13, (rnd) => {
      const a = rnd() * Math.PI * 2;
      const d = 8 + rnd() * 17;
      return box(
        Math.cos(a) * d,
        Math.sin(a) * d,
        0.9,
        1.15,
        0.24,
        0x555a55,
        rnd() * 0.6 - 0.3,
      );
    }),
    // dead trees
    ...scatter(9, 29, (rnd) => {
      const a = rnd() * Math.PI * 2;
      const d = 10 + rnd() * 15;
      return cyl(Math.cos(a) * d, Math.sin(a) * d, 0.22, 0.42, 5.5, 0x2c2620);
    }),
    // crypts, the only real cover
    box(14, -6, 3.4, 2.8, 3.4, 0x46443c, 0.3),
    box(-16, 8, 3.4, 2.8, 3.4, 0x46443c, -0.2),
    box(9, 16, 3.4, 2.8, 3.4, 0x46443c, 0.1),
  ],
};

const facility = {
  id: "facility",
  name: "Facility",
  mode: "zombies",
  blurb: "Tight corridors and pillars. Nowhere to run, everything close.",
  half: 22,
  ground: 0x2a2c30,
  fogColor: 0x101218,
  fogDensity: 0.014,
  hemiSky: 0x44506b,
  hemiGround: 0x0c0e12,
  moon: 0xc9d6e6,
  moonIntensity: 0.85,
  fires: [
    [-9, -9],
    [9, 9],
    [9, -9],
    [-9, 9],
  ],
  playerStart: [0, 7],
  props: [
    // interior partitions that make lanes
    box(-8, 0, 0.7, 4, 16, STEEL),
    box(8, 0, 0.7, 4, 16, STEEL),
    box(0, -11, 12, 4, 0.7, STEEL),
    box(0, 11, 12, 4, 0.7, STEEL),
    // support pillars
    ...ring(8, 15, (x, z) => box(x, z, 1.3, 5, 1.3, 0x4a4f57)),
    // crates against the walls
    ...scatter(16, 41, (rnd) => {
      const a = rnd() * Math.PI * 2;
      const d = 12 + rnd() * 8;
      const s = 0.9 + rnd() * 0.6;
      return box(Math.cos(a) * d, Math.sin(a) * d, s, s, s, CRATE, rnd() * 3);
    }),
    cyl(0, 0, 1.1, 1.1, 2.4, 0x6a4a2a),
  ],
};

// ══ DEATHMATCH ════════════════════════════════════════════════════

const rooftop = {
  id: "rooftop",
  name: "Rooftop",
  mode: "dm",
  blurb: "Air units and low walls. Vertical cover, brutal sightlines.",
  half: 23,
  ground: 0x33363b,
  fogColor: 0x121a26,
  fogDensity: 0.007,
  hemiSky: 0x50678c,
  hemiGround: 0x121418,
  moon: 0xbcd0ea,
  moonIntensity: 1.15,
  fires: [[0, 0]],
  playerStart: [0, 16],
  props: [
    // air handling units
    box(-9, -7, 4.5, 2.4, 3, 0x4c5057, 0.1),
    box(10, -4, 3, 2.4, 5, 0x4c5057, -0.15),
    box(-6, 9, 5, 2.2, 3, 0x4c5057),
    box(11, 11, 3.6, 2.6, 3.6, 0x4c5057, 0.4),
    // parapets
    box(0, -17, 26, 1.5, 0.8, 0x3d4046),
    box(0, 17, 26, 1.5, 0.8, 0x3d4046),
    box(-17, 0, 0.8, 1.5, 22, 0x3d4046),
    box(17, 0, 0.8, 1.5, 22, 0x3d4046),
    // stair block, the high ground
    box(0, 0, 6, 3.4, 6, 0x585c63),
    box(0, 4.4, 6, 1.7, 2.8, 0x4e5259),
    // vents
    ...ring(6, 13.5, (x, z) => cyl(x, z, 0.6, 0.6, 1.6, 0x5a5f66)),
  ],
  spawns: [
    [-15, -14],
    [15, -14],
    [-15, 14],
    [15, 14],
    [0, 16],
    [0, -16],
    [-16, 0],
    [16, 0],
  ],
};

const warehouse = {
  id: "warehouse",
  name: "Warehouse",
  mode: "dm",
  blurb: "Shelving aisles. Close, chaotic, full of ambushes.",
  half: 26,
  ground: 0x2b2621,
  fogColor: 0x0e1116,
  fogDensity: 0.011,
  hemiSky: 0x4a4a58,
  hemiGround: 0x0e0c0a,
  moon: 0xe0d2b8,
  moonIntensity: 1.0,
  fires: [
    [-14, 14],
    [14, -14],
  ],
  playerStart: [0, 20],
  props: [
    // shelving runs
    ...[-14, -5, 5, 14].flatMap((x) => [
      box(x, -8, 2.2, 4, 13, 0x51402c),
      box(x, 8, 2.2, 4, 13, 0x51402c),
    ]),
    // stacked pallets in the aisles
    ...scatter(20, 97, (rnd) => {
      const x = -20 + rnd() * 40;
      const z = -22 + rnd() * 44;
      const s = 1.1 + rnd() * 0.9;
      return box(x, z, s, s * 0.9, s, CRATE, rnd() * 3);
    }),
    // loading bay containers
    box(-20, 20, 6, 3.2, 3, RUST, 0.2),
    box(20, -20, 6, 3.2, 3, 0x2f4f4a, -0.2),
  ],
  spawns: [
    [-21, -21],
    [21, -21],
    [-21, 21],
    [21, 21],
    [0, 22],
    [0, -22],
    [-22, 0],
    [22, 0],
  ],
};

const courtyard = {
  id: "courtyard",
  name: "Courtyard",
  mode: "dm",
  blurb: "Open middle, colonnades around it. Rewards holding an angle.",
  half: 29,
  ground: 0x30342c,
  fogColor: 0x131a20,
  fogDensity: 0.008,
  hemiSky: 0x5a6b7d,
  hemiGround: 0x101410,
  moon: 0xd6e2f0,
  moonIntensity: 1.1,
  fires: [
    [-20, -20],
    [20, 20],
  ],
  playerStart: [0, 22],
  props: [
    // central fountain
    cyl(0, 0, 3.2, 3.6, 1.1, 0x6b6a5e),
    cyl(0, 0, 0.7, 0.9, 3.2, 0x7a796c),
    // colonnade
    ...ring(16, 20, (x, z) => cyl(x, z, 0.55, 0.65, 4.6, 0x6e6c60)),
    // planters
    ...ring(8, 11, (x, z) => box(x, z, 2.4, 1.1, 2.4, 0x4a4436)),
    // corner walls
    box(-24, -24, 10, 3.4, 1, 0x585646, 0.78),
    box(24, 24, 10, 3.4, 1, 0x585646, 0.78),
    box(-24, 24, 10, 3.4, 1, 0x585646, -0.78),
    box(24, -24, 10, 3.4, 1, 0x585646, -0.78),
    // benches
    ...ring(6, 15.5, (x, z, a) => box(x, z, 2.2, 0.5, 0.7, 0x4d4132, a)),
  ],
  spawns: [
    [-24, -18],
    [24, -18],
    [-24, 18],
    [24, 18],
    [0, 25],
    [0, -25],
    [-25, 0],
    [25, 0],
  ],
};

export const MAPS = [
  containers,
  graveyard,
  facility,
  rooftop,
  warehouse,
  courtyard,
];

export const mapsFor = (mode) => MAPS.filter((m) => m.mode === mode);
export const mapById = (id) => MAPS.find((m) => m.id === id);
