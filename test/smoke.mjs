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
  // A wave now trickles in rather than arriving at once, and this browser runs
  // the clock two hundred times slow, so waiting out a real wave is not on.
  // Cut the round short: what is being checked is that a cleared wave rolls
  // over into the next one, not how long a full one takes.
  p.game.toSpawn = 2;
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
  // start from an empty map: a survivor of the previous step would be counted
  // as alive here and read as a corpse that never died
  for (const other of [...p.zombies]) {
    if (other.kind === "reviver") other.finished = true;
    p.killZombie(other);
  }
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

// ── where the perk machines ended up, and the doors that gate them ──
step("perks, paid doors and the gun on the wall");
const world = await page.evaluate(() => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  const at = (id) => p.perkMachines.find((m) => m.perk.id === id);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const half = p.MAPS.find((m) => m.id === "forest").half;

  return {
    machines: p.perkMachines.length,
    speedCost: at("speed")?.perk.cost,
    // the house sits at the origin and is about 20 across
    speedInHouse: dist(at("speed") ?? { x: 99, z: 99 }, { x: 0, z: 0 }) < 24,
    dtapInHouse: dist(at("dtap") ?? { x: 99, z: 99 }, { x: 0, z: 0 }) < 24,
    juggOut: dist(at("jugg") ?? { x: 0, z: 0 }, { x: 0, z: 0 }) > half * 0.5,
    staminOut: dist(at("stamin") ?? { x: 0, z: 0 }, { x: 0, z: 0 }) > 24,
    doorCosts: p.barriers.map((b) => b.cost).sort((a, b) => a - b),
    wallGuns: p.wallBuys.map((w) => ({ id: w.weaponId, cost: w.cost })),
  };
});

step(`  ${world.machines} machines, doors at ${world.doorCosts.join("/")}`);
if (world.machines !== 4) note(`${world.machines} perk machines placed, expected 4`);
if (world.speedCost !== 2000) note(`Speed Cola costs ${world.speedCost}, expected 2000`);
if (!world.speedInHouse) note("Speed Cola is not in the house");
if (!world.dtapInHouse) note("Double Tap is not in the house");
if (!world.juggOut) note("Juggernaut is not out in a corner");
if (!world.staminOut) note("Stamin-Up is not out in the trees");
for (const c of [750, 1000, 1250]) {
  if (!world.doorCosts.includes(c)) note(`no ${c} point door was placed`);
}
if (world.wallGuns.length !== 1) note(`${world.wallGuns.length} wall guns, expected 1`);
else {
  if (world.wallGuns[0].id !== "dbarrel") note(`the wall gun is ${world.wallGuns[0].id}, expected the double barrel`);
  if (world.wallGuns[0].cost !== 500) note(`the wall gun costs ${world.wallGuns[0].cost}, expected 500`);
}

/*
 * The point of a paid door is that there is no other way in. Walking out from
 * whatever is being gated, cell by cell at the height you would stand there,
 * must not reach open ground — and once the boards are bought, it must.
 */
step("nothing gated can be walked into without paying");
await page.evaluate(() => {
  window.__leaks = (cx, cz, y, R) => {
    const p = window.__probe;
    const CELL = 0.3;
    const OUT = R + 4; // escaping this far means it is not sealed
    const near = p.obstacles.filter(
      (o) => Math.abs(o.x - cx) < OUT + 12 && Math.abs(o.z - cz) < OUT + 12
        && o.bottom < y + 1.7 && o.top > y + 0.25,
    );
    const standable = (x, z) => {
      const dx = x - cx, dz = z - cz;
      for (const o of near) {
        const ox = x - o.x, oz = z - o.z;
        const lx = ox * o.cos - oz * o.sin;
        const lz = ox * o.sin + oz * o.cos;
        if (Math.abs(lx) < o.hw + p.PLAYER_R && Math.abs(lz) < o.hd + p.PLAYER_R) return false;
      }
      void dx; void dz;
      return true;
    };

    /*
     * Start on clear ground inside, not on the centre — the machine or the box
     * being gated stands there and is itself solid, so a fill seeded on it
     * never gets out and everything looks sealed.
     */
    let seed = null;
    for (let ring = 1; ring <= 6 && !seed; ring++) {
      for (let k = 0; k < 16 && !seed; k++) {
        const a = (k / 16) * Math.PI * 2;
        const i = Math.round((Math.cos(a) * ring * R) / 6 / CELL);
        const j = Math.round((Math.sin(a) * ring * R) / 6 / CELL);
        if (standable(cx + i * CELL, cz + j * CELL)) seed = [i, j];
      }
    }
    if (!seed) return false; // nowhere to stand in there at all

    const key = (i, j) => `${i},${j}`;
    const seen = new Set();
    const queue = [seed];
    seen.add(key(seed[0], seed[1]));
    while (queue.length) {
      const [i, j] = queue.pop();
      const x = cx + i * CELL;
      const z = cz + j * CELL;
      if (Math.hypot(x - cx, z - cz) > OUT) return true; // got out
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (seen.has(key(ni, nj))) continue;
        const nx = cx + ni * CELL;
        const nz = cz + nj * CELL;
        if (!standable(nx, nz)) continue;
        seen.add(key(ni, nj));
        queue.push([ni, nj]);
      }
    }
    return false; // never got out — sealed
  };
});

const sealed = await page.evaluate(() => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  const out = [];

  const jugg = p.perkMachines.find((m) => m.perk.id === "jugg");
  const dtap = p.perkMachines.find((m) => m.perk.id === "dtap");
  const box = p.mysteryBoxes[0];

  out.push({ what: "Juggernaut", leaks: window.__leaks(jugg.x, jugg.z, 0, 4.2) });
  out.push({ what: "Double Tap", leaks: window.__leaks(dtap.x, dtap.z, 0, 2.6) });
  if (box) out.push({ what: "the mystery box", leaks: window.__leaks(box.x, box.z, box.y, 2.9) });

  // and once everything is paid for, all of it has to open up
  p.game.points = 99999;
  for (const b of p.barriers) p.buyBarrier(b);
  out.push({ what: "Juggernaut once paid", leaks: window.__leaks(jugg.x, jugg.z, 0, 4.2), wantOpen: true });
  out.push({ what: "Double Tap once paid", leaks: window.__leaks(dtap.x, dtap.z, 0, 2.6), wantOpen: true });
  if (box) out.push({ what: "the box once paid", leaks: window.__leaks(box.x, box.z, box.y, 2.9), wantOpen: true });
  return out;
});

for (const s of sealed) {
  if (s.wantOpen && !s.leaks) note(`${s.what} is still walled in after buying the way through`);
  if (!s.wantOpen && s.leaks) note(`${s.what} can be reached without paying`);
}
step(`  ${sealed.filter((s) => !s.wantOpen && !s.leaks).length}/3 sealed, ${sealed.filter((s) => s.wantOpen && s.leaks).length}/3 open once paid`);

// ── buying a door has to actually open the way through ──
step("a bought door stops blocking");
const door = await page.evaluate(() => {
  const p = window.__probe;
  p.resetGame(); // the sealing test above paid for everything
  const b = p.barriers.find((x) => !x.bought);
  if (!b) return { error: "no barrier to buy" };
  p.game.points = 99999;
  const before = p.barriers.filter((x) => !x.bought).length;
  p.buyBarrier(b);
  return { bought: b.bought, before, after: p.barriers.filter((x) => !x.bought).length, poorer: p.game.points < 99999 };
});
if (door.error) note(door.error);
else {
  if (!door.bought) note("buying a door did not clear it");
  if (door.after !== door.before - 1) note("the cleared door is still in the way");
  if (!door.poorer) note("clearing a door cost nothing");
}

// ── the double barrel comes off the wall and into your hands ──
step("the wall gun can be bought and topped up");
const wallGun = await page.evaluate(() => {
  const p = window.__probe;
  const wb = p.wallBuys[0];
  if (!wb) return { error: "no wall gun placed" };
  p.game.points = 5000;
  p.buyWallGun(wb);
  const held = p.game.slots.find((s) => s.id === wb.weaponId);
  const afterBuy = p.game.points;

  if (held) held.reserve = 0;
  p.buyWallGun(wb); // second time is ammo, at half price
  return {
    bought: !!held,
    spent: 5000 - afterBuy,
    refilled: (p.game.slots.find((s) => s.id === wb.weaponId)?.reserve ?? 0) > 0,
    ammoCost: afterBuy - p.game.points,
  };
});
if (wallGun.error) note(wallGun.error);
else {
  if (!wallGun.bought) note("buying the wall gun did not put it in your hands");
  if (wallGun.spent !== 500) note(`the wall gun cost ${wallGun.spent}, expected 500`);
  if (!wallGun.refilled) note("buying it again did not refill its ammo");
  if (wallGun.ammoCost !== 250) note(`a refill cost ${wallGun.ammoCost}, expected 250`);
}

// ── the nuke ──
step("the nuke clears the map for 400");
const nuke = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.points = 0;
  for (let i = 0; i < 8; i++) {
    const z = p.spawnZombie(5);
    z.kind = "walker";
    z.rising = 0;
  }
  const before = p.liveCount();
  p.nukeTheMap();
  return { before, after: p.liveCount(), points: p.game.points };
});
if (nuke.after !== 0) note(`${nuke.after} zombies survived a nuke`);
if (nuke.points !== 400) note(`a nuke paid ${nuke.points} points, expected 400`);

// ── every skin's power has to fire without throwing ──
step("every skin power activates");
const powers = await page.evaluate(async () => {
  const p = window.__probe;
  const bad = [];
  const combos = new Set();
  for (const s of p.SKINS) {
    if (!s.power) continue;
    combos.add(s.power.parts.map((x) => x.effect).sort().join("+"));
    try {
      p.wallet.equipped = s.id;
      p.power_readyAt = 0;
      p.game.time += 200; // past the cooldown
      p.activatePower();
    } catch (e) {
      bad.push(`${s.id}: ${e.message}`);
    }
  }
  return { bad, withPower: p.SKINS.filter((s) => s.power).length, combos: combos.size };
});
step(`  ${powers.withPower} powers, ${powers.combos} distinct combinations`);
for (const b of powers.bad.slice(0, 5)) note(`a skin power threw — ${b}`);
if (powers.combos !== powers.withPower)
  note(`${powers.withPower} skins share only ${powers.combos} distinct powers`);

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

// ── the buried town has to be playable, not just buildable ──
step("the buried town works like the other maps");
const buriedTown = await page.evaluate(() => {
  const p = window.__probe;
  p.game.mapId = "buried";
  p.resetGame();
  const start = p.MAPS.find((m) => m.id === "buried").start;
  return {
    exists: !!p.MAPS.find((m) => m.id === "buried"),
    machines: p.perkMachines.length,
    boxes: p.mysteryBoxes.length,
    doors: p.barriers.length,
    wallGuns: p.wallBuys.length,
    props: p.obstacles.length,
    // you must not begin the game standing inside a building
    startClear: Math.hypot(p.player.pos.x - start[0], p.player.pos.z - start[1]) < 3,
  };
});
step(`  ${buriedTown.props} solid props, ${buriedTown.machines} machines, ${buriedTown.boxes} box, ${buriedTown.doors} doors`);
if (!buriedTown.exists) note("the buried town is not in the map list");
if (buriedTown.machines !== 4) note(`the town has ${buriedTown.machines} perk machines, expected 4`);
if (!buriedTown.boxes) note("the town has no mystery box");
if (buriedTown.doors < 3) note(`the town has ${buriedTown.doors} paid doors, expected at least 3`);
if (!buriedTown.wallGuns) note("the town has no gun on a wall");
if (!buriedTown.startClear) note("you start the town shoved out of position, so the spawn is inside something");
if (buriedTown.props < 400) note(`the town only has ${buriedTown.props} solid props — it will feel empty`);

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

/*
 * Every button in the shop gets pressed. Reading the freebie alone missed a
 * missing import on the buy path, which threw the moment anyone touched a
 * token pack — a button that is never clicked is a button that is not tested.
 */
step("every shop button survives being pressed");
const buttons = await page.evaluate(async () => {
  document.getElementById("shop-btn").click();
  const ids = [...document.querySelectorAll("#shop-body button[data-shop]")].map((b) => b.dataset.shop);
  for (const id of ids) {
    const el = document.querySelector(`#shop-body button[data-shop="${id}"]`);
    if (el) el.click();
    await new Promise((r) => setTimeout(r, 30));
  }
  document.getElementById("shop-close").click();
  return ids;
});
step(`  ${buttons.length} pressed: ${buttons.join(", ")}`);
if (buttons.length < 7) note(`only ${buttons.length} shop buttons found, expected the packs and more`);

/*
 * The one you can never find. A zombie that has wedged itself somewhere must
 * be dug up and put back, or the wave never ends and the game stops.
 */
step("a wedged zombie gets dug out");
const wedged = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  p.beginPlay();

  for (const other of [...p.zombies]) p.killZombie(other); // an empty map runs faster
  p.game.toSpawn = 0;

  const z = p.spawnZombie(4);
  z.kind = "walker";
  z.rising = 0;
  /*
   * Nailed to the floor of the house. Speed zero is the strongest form of the
   * bug — whatever wedges a zombie in practice, the symptom is that it does
   * not move — and it cannot pass by wandering off on its own.
   */
  z.speed = 0;
  z.group.position.set(0, 0, 0);
  z.y = 0;
  z.lastX = 0;
  z.lastZ = 0;
  z.stuckFor = 0;
  p.player.pos.set(40, 0, 40); // and stand well away from it

  /*
   * Two halves, checked separately.
   *
   * First: does a motionless zombie's counter actually climb? Waiting out the
   * whole six seconds here is not practical — this browser runs the game clock
   * at about a seventh of real time — so watch it rise and trust the constant.
   *
   * Then: does the dig-out put it somewhere it can walk from? Called directly,
   * so the check does not depend on how fast the clock happens to be running.
   */
  const wallStop = Date.now() + 60000;
  let peak = 0;
  while (Date.now() < wallStop && peak < 0.4) {
    peak = Math.max(peak, z.stuckFor);
    await new Promise((r) => setTimeout(r, 200));
  }
  const counted = peak;
  const before = { x: z.group.position.x, z: z.group.position.z };

  p.digOutZombie(z);
  const moved = Math.hypot(z.group.position.x - before.x, z.group.position.z - before.z);
  const clearWhereItLanded = p.obstacles.every((o) => {
    if (o.top <= 0.35 || o.bottom > 1.5) return true;
    const ox = z.group.position.x - o.x;
    const oz = z.group.position.z - o.z;
    const lx = ox * o.cos - oz * o.sin;
    const lz = ox * o.sin + oz * o.cos;
    return !(Math.abs(lx) < o.hw + 0.5 && Math.abs(lz) < o.hd + 0.5);
  });

  return {
    counted,
    freed: moved > 6,
    landedClear: clearWhereItLanded,
    threshold: p.STUCK_TIME,
    moved: Math.round(moved),
  };
});
// Any climb at all proves it is counting; how long the game waits before
// acting is a constant, not something worth spending real minutes measuring
// in a browser that runs the clock two hundred times slow.
if (!(wedged.counted > 0.2))
  note(`a motionless zombie's stuck counter did not climb (reached ${wedged.counted})`);
if (!wedged.freed) note(`digging a zombie out moved it only ${wedged.moved} units`);
if (!wedged.landedClear) note("a dug-out zombie was put back inside something solid");
step(`  counter reached ${wedged.counted.toFixed(1)}s of ${wedged.threshold}s, then dug out ${wedged.moved} units to clear ground`);

// ── the shop's coin purchase and the revive it pays for ──
step("a token can be bought with coins and spent on a revive");
const tokens = await page.evaluate(async () => {
  const p = window.__probe;
  p.wallet.coins = 100;
  p.shopState.tokens = 0;
  p.shopState.unlimited = false;

  document.getElementById("shop-btn").click();
  const btn = document.querySelector('#shop-body button[data-shop="pack:t1"]');
  if (!btn) return { error: "no single-token pack in the shop" };
  btn.click();
  const bought = { coins: p.wallet.coins, tokens: p.shopState.tokens };
  document.getElementById("shop-close").click();

  // now die with it and see whether the revive is offered and works
  p.resetGame();
  p.beginPlay();
  p.player.hp = 1;
  p.endGame();
  const offered = !document.getElementById("revive-btn").classList.contains("hidden");
  p.reviveWithToken();
  return {
    bought,
    offered,
    alive: p.player.alive && !p.game.over,
    left: p.shopState.tokens,
    used: p.game.revivesUsed,
  };
});
if (tokens.error) note(tokens.error);
else {
  if (tokens.bought.tokens !== 1) note(`100 coins bought ${tokens.bought.tokens} tokens, expected 1`);
  if (tokens.bought.coins !== 0) note(`buying a token left ${tokens.bought.coins} coins, expected 0`);
  if (!tokens.offered) note("the revive button was not offered with a token in hand");
  if (!tokens.alive) note("spending a token did not put you back on your feet");
  if (tokens.left !== 0) note(`reviving left ${tokens.left} tokens, expected 0`);
  if (tokens.used !== 1) note(`revives used came to ${tokens.used}, expected 1`);
}

/*
 * The machines, in the order you would actually reach them. There is no quest
 * chaining these together any more — each is its own thing — so what matters
 * is that each works and that the Pack-a-Punch still refuses without power.
 */
step("the machines all work, and the Pack-a-Punch still needs power")
const works = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "buried";
  p.resetGame();
  p.beginPlay();

  // no power yet: the machine must refuse
  p.game.points = 999999;
  p.game.slots = [{ id: "ak47", mag: 30, reserve: 90 }];
  p.game.weapon = 0;
  p.packCurrentWeapon();
  const papRefusedUnpowered = !p.game.slots[0].up;

  // turbine: collect its parts, build it, plug it in
  for (const part of p.partPickups) {
    if (part.id === "turbine") p.carried.turbine = (p.carried.turbine ?? 0) + 1;
  }
  p.buildAtBench();
  const turbineBuilt = p.builtSet.has("turbine");
  p.placeTurbine(p.turbineSockets[0]);
  const powered = p.quest.powered;

  // now it works, and doubles what it should
  const base = p.WEAPONS.find((w) => w.id === "ak47");
  p.game.points = 999999;
  p.packCurrentWeapon();
  const up = p.game.slots[0].up;
  const packed = up
    ? { damage: up.damage / base.damage, mag: up.mag / base.mag, reserve: up.reserve / base.reserve, name: up.name }
    : null;

  // the prisoner, and the vault only he opens
  p.game.points = 999999;
  p.freeLeroy();
  const freed = p.leroy.alive;
  const vault = p.barriers.find((b) => b.vault);
  if (vault && p.leroy.group) {
    p.leroy.group.position.set(vault.x, 0, vault.z);
    p.player.pos.set(vault.x, 0, vault.z);
    for (let i = 0; i < 40 && !p.quest.vaultOpen; i++) await new Promise((r) => setTimeout(r, 150));
  }

  // the jet gun, out of the box
  let holdingJetGun = false;
  for (let i = 0; i < 400 && !holdingJetGun; i++) {
    p.game.points = 999999;
    p.useBoxDirect();
    holdingJetGun = p.game.slots.some((s) => s.id === "jetgun");
  }

  return {
    papRefusedUnpowered, turbineBuilt, powered, packed, freed,
    vaultOpen: p.quest.vaultOpen, holdingJetGun,
  };
});

if (!works.papRefusedUnpowered) note("the Pack-a-Punch worked with no power");
if (!works.turbineBuilt) note("the turbine did not build from a full set of parts");
if (!works.powered) note("plugging the turbine in did not switch the power on");
if (!works.freed) note("paying off the lock did not free the prisoner");
if (!works.vaultOpen) note("the prisoner did not take the vault door off");
if (!works.holdingJetGun) note("the jet gun never came out of the box");
if (!works.packed) note("the Pack-a-Punch did not upgrade the gun");
else {
  const { damage, mag, reserve, name } = works.packed;
  step(`  packed an AK into "${name}" — ${damage}× damage, ${mag}× magazine, ${reserve}× reserve`);
  for (const [what, got] of [["damage", damage], ["magazine", mag], ["reserve", reserve]]) {
    if (Math.abs(got - 2) > 0.01) note(`Pack-a-Punch gave ${got}× ${what}, expected exactly 2×`);
  }
}

// ── the bank keeps points between runs ──
step("the bank holds points across a death");
const banked = await page.evaluate(() => {
  const p = window.__probe;
  p.resetGame();
  p.beginPlay();
  p.bank.points = 0;
  p.game.points = 3000;
  p.useBank(false); // F: money in
  const afterDeposit = { pocket: p.game.points, bank: p.bank.points };
  // F must never take money out, however little is in hand
  p.game.points = 0;
  p.useBank(false);
  const fNeverWithdraws = p.game.points === 0 && p.bank.points === afterDeposit.bank;
  p.game.points = 2000;
  p.resetGame(); // a new run: pocket points are gone, banked ones are not
  const survived = p.bank.points;
  p.game.points = 0;
  p.useBank(true); // C: money out
  return { afterDeposit, survived, fNeverWithdraws, pocket: p.game.points, left: p.bank.points };
});
if (banked.afterDeposit.bank !== 1000) note(`depositing put ${banked.afterDeposit.bank} in the bank, expected 1000`);
if (banked.afterDeposit.pocket !== 2000) note(`depositing left ${banked.afterDeposit.pocket} in hand, expected 2000`);
if (!banked.fNeverWithdraws) note("F took money out of the bank — it should only put money in");
if (banked.survived !== 1000) note("the bank did not survive a new run");
if (banked.pocket !== 1000) note(`withdrawing gave ${banked.pocket}, expected 1000`);
if (banked.left !== 0) note(`withdrawing left ${banked.left} banked, expected 0`);

// ── aiming down the sights ──
step("right button aims, and only the right guns have sights");
const sights = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  p.beginPlay(); // the free-for-all test above left us on the main screen
  const startPoints = p.game.points;

  const withSights = p.WEAPONS.filter((w) => p.hasSights(w)).map((w) => w.id);
  const without = p.WEAPONS.filter((w) => !p.hasSights(w)).map((w) => w.id);

  // put a rifle in hand and hold the right button
  const rifle = p.WEAPONS.find((w) => w.id === "ak47");
  p.game.slots = [{ id: "ak47", mag: rifle.mag, reserve: rifle.reserve }];
  p.game.weapon = 0;
  // the view eases rather than snapping, and this browser runs at a few
  // frames a second, so wait for it to settle instead of guessing at a delay
  /*
   * The view eases rather than snapping, so wait for the easing value itself
   * to arrive rather than for the field of view to stop changing. Watching for
   * "it stopped moving" is unreliable here: at a few frames a second, several
   * samples in a row land inside the same frame and look settled when they
   * are only between frames.
   */
  const settleTo = async (target) => {
    const stop = Date.now() + 90000;
    while (Date.now() < stop && Math.abs(p.aim.k - target) > 0.001) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return p.camera.fov;
  };

  // all the way back to the hip first, so an earlier test leaving the view
  // part way in does not become the baseline for everything after
  p.setAiming(false);
  const hipFov = await settleTo(0);
  p.setAiming(true);
  const aimedFov = await settleTo(1);
  const wasAiming = p.aiming();
  p.setAiming(false);
  const backFov = await settleTo(0);

  // a shotgun aims too now, but barely — it should not zoom like a rifle
  const sg = p.WEAPONS.find((w) => w.id === "shotgun");
  p.game.slots = [{ id: "shotgun", mag: sg.mag, reserve: sg.reserve }];
  p.setAiming(true);
  const shotgunFov = await settleTo(1);
  p.setAiming(false);
  await settleTo(0);

  const magnify = {};
  for (const w of p.WEAPONS) magnify[w.id] = p.magnifyOf(w);
  return { startPoints, withSights, without, magnify, hipFov, aimedFov, backFov, shotgunFov, wasAiming };
});

step(`  ${sights.withSights.length} guns with sights, ${sights.without.length} without`);
if (sights.startPoints !== 500) note(`a game starts with ${sights.startPoints} points, expected 500`);
if (!(sights.aimedFov < sights.hipFov - 10)) note(`aiming barely moved the view (${sights.hipFov} → ${sights.aimedFov})`);
if (!sights.wasAiming) note("holding the right button did not count as aiming");
if (Math.abs(sights.backFov - sights.hipFov) > 0.5) note("the view did not come back after letting go");
// a rifle at 3× must end up narrower than a shotgun at 1.5×
if (!(sights.shotgunFov > sights.aimedFov))
  note(`a shotgun zoomed as far as a rifle (${sights.shotgunFov} vs ${sights.aimedFov})`);
if (Math.abs(sights.shotgunFov - sights.hipFov / 1.5) > 1)
  note(`a shotgun settled at ${sights.shotgunFov}°, expected about ${(sights.hipFov / 1.5).toFixed(1)}°`);
if (sights.withSights.includes("knife")) note("the knife has sights and should not");
for (const id of ["pistol", "magnum", "shotgun", "dbarrel", "auto12", "ak47", "sniper", "rpg", "raygun2"]) {
  if (!sights.withSights.includes(id)) note(`${id} has no sights and should have`);
}
// how far each kind pulls the world in
for (const [id, want] of [
  ["pistol", 1.5], ["magnum", 1.5], ["shotgun", 1.5], ["dbarrel", 1.5], ["auto12", 1.5],
  ["sniper", 6],
  ["ak47", 3], ["m4", 3], ["mp5", 3], ["rpd", 3], ["raygun2", 3], ["rpg", 3],
]) {
  const got = sights.magnify[id];
  if (got !== want) note(`${id} magnifies ${got}×, expected ${want}×`);
}

/*
 * What made the big maps crawl. Three.js works every light out for every lit
 * pixel in one pass, so the cost is lights times pixels whether the light
 * reaches anything or not — and the city was carrying better than twenty.
 */
step("no map floods the scene with dynamic lights")
const lights = await page.evaluate(() => {
  const p = window.__probe;
  const count = () => {
    let n = 0;
    p.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; });
    return n;
  };
  const out = {};
  for (const m of p.MAPS) {
    p.game.mapId = m.id;
    p.resetGame();
    out[m.id] = count();
  }
  return { out, budget: p.LIGHT_BUDGET };
});
step(`  ${Object.entries(lights.out).map(([k, v]) => `${k} ${v}`).join(", ")} (budget ${lights.budget})`);
for (const [id, n] of Object.entries(lights.out)) {
  // the budget, plus the muzzle flash, plus a little room
  if (n > lights.budget + 3) note(`${id} has ${n} dynamic lights, over the budget of ${lights.budget}`);
}

// ── the two new maps, and the lava that defines one of them ──
step("Town burns you and Farm is open")
const newMaps = await page.evaluate(async () => {
  const p = window.__probe;
  const out = {};

  p.game.mapId = "town";
  p.resetGame();
  p.beginPlay();
  out.townProps = p.obstacles.length;
  out.cracks = p.lavaPools.length;

  // stand in one and see the health go
  const crack = p.lavaPools[0];
  p.player.pos.set(crack.x, 0, crack.z);
  p.player.hp = 100;
  p.player.maxHp = 100;
  const before = p.player.hp;
  for (let i = 0; i < 30 && p.player.hp === before; i++) await new Promise((r) => setTimeout(r, 120));
  out.burned = p.player.hp < before;

  // and step out of it
  p.player.pos.set(crack.x + crack.hw + 6, 0, crack.z + crack.hd + 6);
  p.player.hp = 100;
  const outside = p.player.hp;
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 120));
  out.safeOutside = p.player.hp >= outside;

  p.game.mapId = "farm";
  p.resetGame();
  out.farmProps = p.obstacles.length;
  out.farmLava = p.lavaPools.length;
  out.farmMachines = p.perkMachines.length;
  out.farmBoxes = p.mysteryBoxes.length;
  return out;
});
step(`  town ${newMaps.townProps} props and ${newMaps.cracks} lava cracks, farm ${newMaps.farmProps} props`);
if (!newMaps.cracks) note("Town has no lava");
if (!newMaps.burned) note("standing in lava did not hurt");
if (!newMaps.safeOutside) note("lava kept burning after stepping out of it");
if (newMaps.farmLava) note("Farm has lava and should not");
if (newMaps.farmMachines !== 4) note(`Farm has ${newMaps.farmMachines} perk machines, expected 4`);
if (!newMaps.farmBoxes) note("Farm has no mystery box");
if (newMaps.farmProps < 300) note(`Farm only has ${newMaps.farmProps} props — it will feel bare`);

// ── TranZit, and the bus that drives it ──
step("the bus drives the route and carries you")
const busRun = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "tranzit";
  p.resetGame();
  p.beginPlay();

  const map = p.MAPS.find((m) => m.id === "tranzit");
  const out = { stops: map.route.length, props: p.obstacles.length };

  // it has to actually move
  // it waits 25 game seconds at a place, which this browser takes three
  // real minutes to get through — send it on its way
  p.bus.wait = 0;
  const startedAt = { x: p.bus.x, z: p.bus.z };
  const wallStop = Date.now() + 120000;
  while (Math.hypot(p.bus.x - startedAt.x, p.bus.z - startedAt.z) < 4 && Date.now() < wallStop) {
    await new Promise((r) => setTimeout(r, 200));
  }
  out.moved = Math.round(Math.hypot(p.bus.x - startedAt.x, p.bus.z - startedAt.z));

  /*
   * And it has to take you with it. Standing on the deck, the distance from
   * you to the bus must stay the same while the bus covers ground — if it
   * changes, the bus drove out from under you.
   */
  p.player.pos.set(p.bus.x, p.BUS.FLOOR, p.bus.z);
  p.player.alive = true;
  p.player.hp = 100000;
  p.player.maxHp = 100000;
  await new Promise((r) => setTimeout(r, 600));

  /*
   * Ride it properly: a long run, past buildings and round the corners at the
   * stops, checking every sample. A two-second ride on a straight leg proved
   * nothing — being pushed off by scenery only happens next to scenery.
   */
  const busFrom = { x: p.bus.x, z: p.bus.z };
  let worst = 0;
  const wall2 = Date.now() + 180000;
  while (Date.now() < wall2) {
    const gap = Math.hypot(p.player.pos.x - p.bus.x, p.player.pos.z - p.bus.z);
    worst = Math.max(worst, gap);
    if (!p.bus.riding && gap > 12) break; // thrown off for good
    await new Promise((r) => setTimeout(r, 150));
  }
  out.busTravelled = Math.round(Math.hypot(p.bus.x - busFrom.x, p.bus.z - busFrom.z));
  out.gapDrift = Math.round(worst);
  out.stillAboard = p.bus.riding;

  // and the deck holds you up
  out.deck = p.busCollide(p.player.pos, 0.42)?.floor ?? 0;
  return out;
});
step(`  ${busRun.stops} stops, ${busRun.props} props; rode ${busRun.busTravelled} units, worst drift ${busRun.gapDrift}`);
// five places, with a bend between each so the legs can go round the buildings
if (busRun.stops < 10) note(`the bus route has ${busRun.stops} points, expected at least 10`);
if (busRun.props < 600) note(`TranZit only has ${busRun.props} props for a map that size`);
if (busRun.moved < 4) note("the bus never moved");
if (busRun.busTravelled > 2 && busRun.gapDrift > 8)
  note(`you drifted ${busRun.gapDrift} units from the bus over ${busRun.busTravelled} units of route`);
if (busRun.busTravelled > 20 && !busRun.stillAboard)
  note("you were left behind partway along the route");
if (Math.abs(busRun.deck - 1.05) > 0.01) note(`the bus deck is at ${busRun.deck}, expected 1.05`);

/*
 * The bus must not drive through the town. Every leg is sampled along its
 * length and tested against the map's own obstacle list at the bus's width —
 * the first route was seven to eleven units inside solid geometry on all five
 * legs, and it looked fine until you rode it.
 */
step("the bus route is clear of the buildings")
const clearance = await page.evaluate(() => {
  const p = window.__probe;
  p.game.mapId = "tranzit";
  p.resetGame();
  /*
   * A disc the length of the bus, swept along the centre line. The first
   * version of this test used a corridor only as wide as the bus and passed
   * while the bus was still driving through houses — the bus is fifteen units
   * long and turns, so its ends sweep through what its middle missed.
   */
  const HW = p.BUS.D + 1;
  const TOP = p.BUS.FLOOR + p.BUS.H;
  const solid = p.obstacles.filter((o) => o.top > 0.5 && o.bottom < TOP);
  const route = p.MAPS.find((m) => m.id === "tranzit").route;

  let worst = 0;
  let where = null;
  for (let i = 0; i < route.length; i++) {
    const a = route[i];
    const c = route[(i + 1) % route.length];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const steps = Math.max(2, Math.ceil(len / 1.5));
    for (let k = 0; k <= steps; k++) {
      const tt = k / steps;
      const x = a[0] + (c[0] - a[0]) * tt;
      const z = a[1] + (c[1] - a[1]) * tt;
      for (const o of solid) {
        const dx = x - o.x, dz = z - o.z;
        const lx = dx * o.cos - dz * o.sin;
        const lz = dx * o.sin + dz * o.cos;
        const ox = o.hw + HW - Math.abs(lx);
        const oz = o.hd + HW - Math.abs(lz);
        const over = Math.min(ox, oz);
        if (ox > 0 && oz > 0 && over > worst) { worst = over; where = [Math.round(x), Math.round(z)]; }
      }
    }
  }
  return { worst: +worst.toFixed(2), where, legs: route.length };
});
step(`  ${clearance.legs} legs, deepest overlap ${clearance.worst} units`);
/*
 * A tenth of a unit is the search's convergence floor against a disc that is
 * deliberately larger than the bus in most orientations — not a collision.
 * Anything approaching half a unit is.
 */
if (clearance.worst > 0.4)
  note(`the bus drives ${clearance.worst} units into something at ${clearance.where}`);

/*
 * Firing must not knock you off the sights. Releasing the left button used to
 * clear the aim as well as the trigger, so every shot dropped the zoom while
 * the right button was still held.
 */
step("you can shoot without losing the sights")
const shootAimed = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  p.beginPlay();
  const rifle = p.WEAPONS.find((w) => w.id === "ak47");
  p.game.slots = [{ id: "ak47", mag: rifle.mag, reserve: rifle.reserve }];
  p.game.weapon = 0;

  /*
   * The real sequence, through the real handlers: hold the right button, then
   * click the left one. Calling the aim function directly — which is what this
   * used to do — skips the handler that has the bug in it.
   */
  const down = (button, buttons) =>
    window.dispatchEvent(new PointerEvent("pointerdown", { button, buttons, pointerType: "mouse", bubbles: true }));
  const up = (button, buttons) =>
    window.dispatchEvent(new PointerEvent("pointerup", { button, buttons, pointerType: "mouse", bubbles: true }));

  /*
   * A browser under pointer lock does not reliably deliver both the pointer
   * and the mouse event for the same press, so the game listens for both and
   * ignores the duplicate. Send both here too, in the order a browser does.
   */
  const mdown = (button, buttons) =>
    window.dispatchEvent(new MouseEvent("mousedown", { button, buttons, bubbles: true }));
  const mup = (button, buttons) =>
    window.dispatchEvent(new MouseEvent("mouseup", { button, buttons, bubbles: true }));

  down(2, 2); // right button down, and held from here on
  mdown(2, 2);
  for (let i = 0; i < 40 && !p.aiming(); i++) await new Promise((r) => setTimeout(r, 100));
  const aimedFirst = p.aiming();

  const magBefore = p.game.slots[0].mag;
  down(0, 3); // left click while the right is still down
  mdown(0, 3);
  await new Promise((r) => setTimeout(r, 400));
  up(0, 2); // let go of the left; the right is still down
  mup(0, 2);
  await new Promise((r) => setTimeout(r, 400));

  const out = {
    aimedFirst,
    fired: magBefore - p.game.slots[0].mag,
    stillHeld: p.aim.held,
    stillAiming: p.aiming(),
  };
  up(2, 0);
  mup(2, 0);
  return out;
});
if (!shootAimed.aimedFirst) note("holding the right button did not raise the sights");
if (!shootAimed.fired) note("clicking the left button while aiming fired nothing");
if (!shootAimed.stillHeld) note("firing dropped the aim while the right button was still held");
if (!shootAimed.stillAiming) note("the sights came down after a shot");

// ── the two things that make the road worth taking ──
step("rares scale with difficulty, and the fog closes in off the road")
const roadAndRares = await page.evaluate(async () => {
  const p = window.__probe;
  const out = {};

  // roll a few thousand on easy and on insane and compare
  const sample = (diffId) => {
    p.game.diff = p.DIFFS.find((d) => d.id === diffId);
    let rare = 0;
    for (let i = 0; i < 4000; i++) if (p.rollKind() !== "walker") rare++;
    return rare / 4000;
  };
  out.easy = +sample("easy").toFixed(3);
  out.insane = +sample("insane").toFixed(3);
  p.game.diff = p.DIFFS.find((d) => d.id === "normal");

  // and the fog, on the road and well off it
  p.game.mapId = "tranzit";
  p.resetGame();
  p.beginPlay();
  const [rx, rz] = p.MAPS.find((m) => m.id === "tranzit").route[0];
  p.player.pos.set(rx, 0, rz);
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 100));
  out.onRoad = +p.scene.fog.density.toFixed(4);
  p.player.pos.set(rx + 90, 0, rz + 90);
  for (let i = 0; i < 60; i++) await new Promise((r) => setTimeout(r, 100));
  out.offRoad = +p.scene.fog.density.toFixed(4);
  return out;
});
step(`  rares ${(roadAndRares.easy * 100).toFixed(1)}% on easy, ${(roadAndRares.insane * 100).toFixed(1)}% on insane; fog ${roadAndRares.onRoad} on the road, ${roadAndRares.offRoad} off it`);
if (!(roadAndRares.insane > roadAndRares.easy * 1.8))
  note(`insane rolls ${roadAndRares.insane} rares against easy's ${roadAndRares.easy} — barely different`);
if (!(roadAndRares.offRoad > roadAndRares.onRoad * 2))
  note(`the fog off the road (${roadAndRares.offRoad}) is no thicker than on it (${roadAndRares.onRoad})`);

// ── the redeem code has to do both halves of what it claims ──
step("the code unlocks every skin and grants unlimited tokens")
const code = await page.evaluate(() => {
  const p = window.__probe;
  p.shopState.unlimited = false;
  p.toLobby();
  const box = document.getElementById("code-box");
  const input = box.querySelector("#code-input");
  if (!input) return { error: "no code box on the main screen" };
  input.value = p.REDEEM_CODE;
  p.redeem();
  const afterRedeem = p.shopState.unlimited;

  /*
   * The case the first version of this missed entirely: redeemed long ago,
   * before the code granted tokens. The box shows a toggle by then, not an
   * input, so there is no way left to ask for them.
   */
  p.shopState.unlimited = false;
  p.saveShop?.();
  p.grantIfRedeemed();

  return {
    unlimited: afterRedeem,
    retroactive: p.shopState.unlimited,
    codeOn: p.wallet.code.active === true,
    message: document.getElementById("code-msg")?.textContent ?? "",
  };
});
if (code.error) note(code.error);
else {
  step(`  "${code.message}"`);
  if (!code.codeOn) note("the code did not unlock the skins");
  if (!code.unlimited) note("the code did not grant unlimited tokens");
  if (!code.retroactive)
    note("someone who redeemed the code before tokens existed never gets them");
  if (!/TOKEN/i.test(code.message)) note("the code says nothing about the tokens it grants");
}

// ── the minimap ──
step("the minimap draws zombies as dots")
const mini = await page.evaluate(async () => {
  const p = window.__probe;
  p.game.mapId = "forest";
  p.resetGame();
  p.beginPlay();
  p.player.pos.set(0, 0, 0);
  for (const z of [...p.zombies]) p.killZombie(z);

  const cv = document.getElementById("minimap");
  if (!cv) return { error: "no minimap canvas" };
  const ctx = cv.getContext("2d");
  const red = () => {
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 110 && d[i + 3] > 40) n++;
    return n;
  };

  await new Promise((r) => setTimeout(r, 900));
  const empty = red();

  // stand a few of them right next to us and see the dots appear
  for (let i = 0; i < 5; i++) {
    const z = p.spawnZombie(3);
    z.kind = "walker";
    z.rising = 0;
    z.group.position.set(6 + i * 2, 0, 4);
  }
  await new Promise((r) => setTimeout(r, 1200));
  const withZombies = red();
  return { empty, withZombies, shown: cv.style.display !== "none" };
});
if (mini.error) note(mini.error);
else {
  step(`  ${mini.empty} red pixels with the map clear, ${mini.withZombies} with five zombies alongside`);
  if (!mini.shown) note("the minimap is not showing during a game");
  if (!(mini.withZombies > mini.empty + 20)) note("zombies did not appear as dots on the minimap");
}

// ── the last-resort panel must stay out of the way when nothing is wrong ──
step("no crash panel on a healthy load");
const crash = await page.evaluate(() => {
  const el = document.getElementById("crash");
  return { shown: el && el.style.display !== "none", started: window.__started === true };
});
if (crash.shown) note("the crash panel is showing on a load that worked");
if (!crash.started) note("the game never signalled that it started");

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
