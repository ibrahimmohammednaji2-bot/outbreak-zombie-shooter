/* Tunables shared across modes. */

export const EYE = 1.7;
export const PLAYER_R = 0.42;
export const GRAVITY = 22;
export const WALK = 5.4;
export const SPRINT = 8.4;
export const JUMP = 7.2;
export const LOADOUT_MAX = 3;

/**
 * Difficulty scales four independent things in Zombies — how hard they hit,
 * how many come, how fast they move, how much they absorb — plus how often
 * they arrive. In Deathmatch the same setting drives bot accuracy and
 * reaction speed instead.
 */
export const DIFFICULTIES = [
  {
    id: "easy",
    label: "EASY",
    blurb: "Fewer, slower, softer. Room to learn the guns.",
    damage: 0.6,
    count: 0.7,
    speed: 0.85,
    health: 0.75,
    spawnRate: 1.3,
    botAccuracy: 0.16,
    botReaction: 0.85,
    color: "#7fd1b9",
  },
  {
    id: "normal",
    label: "NORMAL",
    blurb: "The intended fight. Balanced on every axis.",
    damage: 1,
    count: 1,
    speed: 1,
    health: 1,
    spawnRate: 1,
    botAccuracy: 0.33,
    botReaction: 0.55,
    color: "#e0c169",
  },
  {
    id: "hard",
    label: "HARD",
    blurb: "They hit harder, arrive faster, and take more.",
    damage: 1.5,
    count: 1.35,
    speed: 1.15,
    health: 1.45,
    spawnRate: 0.78,
    botAccuracy: 0.52,
    botReaction: 0.36,
    color: "#e08a4a",
  },
  {
    id: "insane",
    label: "INSANE",
    blurb: "Sprinting brutes, double damage. You will die.",
    damage: 2.2,
    count: 1.8,
    speed: 1.38,
    health: 2.1,
    spawnRate: 0.55,
    botAccuracy: 0.74,
    botReaction: 0.22,
    color: "#d64545",
  },
];

export const getDifficulty = (id) =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

export const DM_SCORE_LIMIT = 25;
export const DM_RESPAWN = 3;
