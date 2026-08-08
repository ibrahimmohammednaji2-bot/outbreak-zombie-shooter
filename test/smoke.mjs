/*
 * Drives the real game in a real browser and reports what breaks.
 *
 * This exists because the bugs that reach the player are runtime ones — a
 * const read before it is declared, a missing element, a wave that quietly
 * stops spawning — and none of them show up in a build. Point it at a running
 * dev server:
 *
 *   npm run dev            (in one terminal)
 *   node test/smoke.mjs    (in another)
 */

import puppeteer from "puppeteer";

const URL = process.env.URL ?? "http://localhost:5199/";
const problems = [];
const note = (m) => problems.push(m);

const browser = await puppeteer.launch({
  headless: "new",
  // a single evaluate below sits in the page for minutes while the game plays
  protocolTimeout: 600000,
  args: [
    "--enable-unsafe-swiftshader", // software WebGL — no GPU in here
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--js-flags=--max-old-space-size=2048",
  ],
});

// A renderer that dies takes the whole run with it, and the reason matters
// more than the stack trace puppeteer throws.
process.on("unhandledRejection", (e) => {
  note(`the browser died mid-test: ${e?.message ?? e}`);
  report();
});

const page = await browser.newPage();
// Small: software WebGL is fill-rate bound, and a quarter of the pixels is
// several times the framerate — which is how much game time this test gets.
await page.setViewport({ width: 480, height: 320 });

// There is no mouse in here, so the browser refuses to grant pointer lock.
// That is the harness, not the game.
const HEADLESS_NOISE = /pointer lock/i;

page.on("pageerror", (e) => {
  if (!HEADLESS_NOISE.test(e.message)) note(`uncaught: ${e.message}`);
});
page.on("console", (m) => {
  if (m.type() === "error" && !HEADLESS_NOISE.test(m.text())) note(`console.error: ${m.text()}`);
});

/** Wait for a condition inside the page, or give up. */
async function until(desc, fn, ms = 20000) {
  const started = Date.now();
  for (;;) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    if (Date.now() - started > ms) {
      note(`timed out waiting for ${desc}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const step = (name) => console.log(`  · ${name}`);

console.log(`\nsmoke test → ${URL}\n`);
await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });

// ── the module has to finish evaluating, or nothing below means anything ──
step("module evaluates");
const booted = await until("the game to boot", () => !!window.__probe);
if (!booted) {
  console.log("\nthe module never finished — everything below is skipped\n");
  await browser.close();
  report();
}

// ── into a game ──
step("device picker");
await page.evaluate(() => {
  const b = document.querySelector('#device button[data-device="laptop"]');
  if (b) b.click();
});

step("start a game");
await page.evaluate(() => document.getElementById("play-btn").click());
await until("wave 1", () => window.__probe.game.running && window.__probe.game.wave === 1);

// ── the bug that started this: corpses blocking the spawner ──
step("waves advance with bodies on the ground (60s)");
await page.evaluate(() => {
  const p = window.__probe;
  p.game.points = 999999; // enough to test the perk machines later
  p.player.hp = 100000; // survive long enough to see it through
  p.player.maxHp = 100000;
});

/*
 * Software WebGL manages a handful of frames a second, so the game clock
 * crawls — about one game second for every twenty real ones. Playing out five
 * waves would take an hour. Clear a couple of waves to prove the loop turns
 * over, then test the thing that actually broke on its own.
 */
const waveTrace = await page.evaluate(async () => {
  const p = window.__probe;
  const wallStop = Date.now() + 120000;
  while (p.game.wave < 2 && Date.now() < wallStop) {
    for (const z of [...p.zombies]) if (z.dying <= 0 && z.rising <= 0) p.killZombie(z);
    p.player.hp = 100000;
    await new Promise((r) => setTimeout(r, 120));
  }
  return { gameTime: Math.round(p.game.time), waves: p.game.wave };
});

step(`  wave ${waveTrace.waves} after ${waveTrace.gameTime}s of game time`);
if (waveTrace.waves < 2) note(`waves stalled at wave ${waveTrace.waves}`);

/*
 * The regression this test was written for. Bodies lie where they fall for a
 * minute; the spawner used to count them against its limit of sixteen, so a
 * wave with more zombies than that stopped producing them and never ended.
 */
step("a heap of corpses does not block the spawner");
const spawner = await page.evaluate(async () => {
  const p = window.__probe;
  p.startWave(9); // more zombies owed than the map will hold at once
  for (let i = 0; i < 24; i++) {
    const z = p.spawnZombie(9);
    z.kind = "walker"; // a Reviver is meant to still count, so keep them out
    z.rising = 0;
    p.killZombie(z); // leaves a body, and trims the pile if it is getting deep
  }
  // A trimmed body is not deleted, it is told to fade — so count the ones
  // still lying there on their full minute.
  const lingering = () =>
    p.zombies.filter((z) => z.dying > 0 && z.dying < 60 && !(z.kind === "reviver" && !z.finished)).length;

  const bodies = lingering();
  const live = p.liveCount();
  const owed = p.game.toSpawn;

  const wallStop = Date.now() + 45000;
  while (p.game.toSpawn >= owed && Date.now() < wallStop) {
    await new Promise((r) => setTimeout(r, 150));
  }
  return { bodies, live, owed, stillOwed: p.game.toSpawn };
});

step(`  24 killed, ${spawner.bodies} left lying, ${spawner.live} counted as alive`);
if (spawner.live > 0) note(`${spawner.live} corpses are still counted as alive`);
if (spawner.stillOwed >= spawner.owed)
  note(`the spawner stopped with bodies on the ground and ${spawner.owed} zombies still owed`);
if (spawner.bodies > 10)
  note(`${spawner.bodies} bodies left lying — the limit of 10 is not holding`);

// ── every zombie type can be spawned and updated without throwing ──
step("every zombie type spawns and runs");
const kinds = await page.evaluate(async () => {
  const p = window.__probe;
  const out = {};
  for (const kind of ["walker", "runner", "fat", "hopper", "finisher", "bigdude", "reviver", "marksman"]) {
    const before = p.zombies.length;
    // force the roll by spawning until one of this kind appears is slow;
    // reach past it and set the kind on a fresh one instead
    const z = p.spawnZombie(5);
    z.kind = kind;
    z.rising = 0;
    out[kind] = p.zombies.length === before + 1;
  }
  await new Promise((r) => setTimeout(r, 3000)); // let them all update for a while
  return out;
});
for (const [k, ok] of Object.entries(kinds)) if (!ok) note(`${k} failed to spawn`);

// ── perk machines ──
step("perk machines are reachable and sell");
const perks = await page.evaluate(() => {
  const p = window.__probe;
  if (p.perkMachines.length !== 4) return { error: `${p.perkMachines.length} machines placed, expected 4` };
  const bought = [];
  for (const m of p.perkMachines) {
    p.game.points = 999999;
    p.buyPerk(m.perk);
    bought.push(p.ownedPerks.has(m.perk.id));
  }
  return { bought, maxHp: p.player.maxHp };
});
if (perks.error) note(perks.error);
else {
  if (perks.bought.some((b) => !b)) note("a perk machine took the points but granted nothing");
  if (perks.maxHp !== 200) note(`Juggernaut did not double health (maxHp ${perks.maxHp})`);
}

// ── restarting must not carry the last game's state over ──
step("a restart is a clean slate");
const carried = await page.evaluate(() => {
  const p = window.__probe;
  p.game.time = 500;
  p.player.slow = 9;
  p.resetGame();
  return {
    perks: p.ownedPerks.size,
    maxHp: p.player.maxHp,
    slow: p.player.slow,
    revives: p.game.revivesUsed,
    zombiesLeft: p.zombies.filter((z) => z.dying > 0).length,
  };
});
if (carried.perks) note(`${carried.perks} perks survived a restart`);
if (carried.maxHp !== 100) note(`maxHp ${carried.maxHp} survived a restart`);
if (carried.slow) note("a slow effect survived a restart");
if (carried.revives) note("the revive count survived a restart");
if (carried.zombiesLeft) note(`${carried.zombiesLeft} bodies survived a restart`);

/*
 * Die with Instakill running and the next game used to start with it. These
 * expire at a game.time that a restart winds back to zero, so anything left
 * set is still in the future when the new game begins.
 */
step("power-ups do not follow you into the next game");
const followed = await page.evaluate(() => {
  const p = window.__probe;
  p.game.time = 100;
  p.bonus.instakill = 220; // picked up moments before dying
  p.bonus.points = 190;
  p.lure.until = 260;
  p.resetGame();
  return {
    instakill: p.bonusActive("instakill"),
    points: p.bonusActive("points"),
    decoy: p.lureActive(),
  };
});
if (followed.instakill) note("Instakill carried into the next game");
if (followed.points) note("Double Points carried into the next game");
if (followed.decoy) note("a decoy carried into the next game");

// ── every map has to build; one that throws leaves you on a dead screen ──
step("every map builds");
const maps = await page.evaluate(() => {
  const p = window.__probe;
  const bad = [];
  for (const m of p.MAPS) {
    try {
      p.game.mapId = m.id;
      p.resetGame();
    } catch (e) {
      bad.push(`${m.id}: ${e.message}`);
    }
  }
  p.game.mapId = p.MAPS[0].id;
  p.resetGame();
  return bad;
});
for (const b of maps) note(`map failed to build — ${b}`);

// ── every weapon has to be holdable and fireable ──
step("every weapon fires");
const guns = await page.evaluate(() => {
  const p = window.__probe;
  const bad = [];
  for (const w of p.WEAPONS) {
    try {
      p.game.slots = [{ id: w.id, mag: w.mag ?? 0, reserve: w.reserve ?? 0 }];
      p.game.weapon = 0;
      p.game.cooldown = 0;
      p.game.reloadTimer = 0;
      p.fire();
    } catch (e) {
      bad.push(`${w.id}: ${e.message}`);
    }
  }
  return bad;
});
for (const b of guns) note(`weapon threw when fired — ${b}`);

// ── a free-for-all has to start, and must not be selling perks ──
step("free-for-all starts clean");
const dm = await page.evaluate(() => {
  const p = window.__probe;
  try {
    p.startDeathmatch();
  } catch (e) {
    return { error: e.message };
  }
  const out = { machines: p.perkMachines.length, running: p.game.running };
  p.toLobby();
  return out;
});
if (dm.error) note(`free-for-all threw on start — ${dm.error}`);
else {
  if (!dm.running) note("free-for-all started but the game was not running");
  if (dm.machines) note(`${dm.machines} perk machines placed in a free-for-all`);
}

// ── the shop ──
step("shop opens and the daily reward pays out");
const shopOk = await page.evaluate(() => {
  document.getElementById("shop-btn").click();
  const open = !document.getElementById("shop").classList.contains("hidden");
  const claim = document.querySelector('#shop-body button[data-shop="freebie"]');
  const before = Number(document.getElementById("shop-coins").textContent);
  if (claim) claim.click();
  const after = Number(document.getElementById("shop-coins").textContent);
  const gone = !document.querySelector('#shop-body button[data-shop="freebie"]');
  document.getElementById("shop-close").click();
  return { open, paid: after - before, claimedOnce: gone };
});
if (!shopOk.open) note("the shop button did not open the shop");
if (shopOk.paid !== 25) note(`daily reward paid ${shopOk.paid} coins, expected 25`);
if (!shopOk.claimedOnce) note("the daily reward can be claimed twice in a row");

await browser.close();
report();

function report() {
  if (!problems.length) {
    console.log("\n  no problems found\n");
    process.exit(0);
  }
  console.log(`\n  ${problems.length} problem${problems.length > 1 ? "s" : ""}:\n`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("");
  process.exit(1);
}
