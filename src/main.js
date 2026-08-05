import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import "./style.css";

/* ════════════════════════════════════════════════════════════════
   OUTBREAK — a playable prototype
   Single player, wave survival. Multiplayer and the weapon store are
   deliberately absent: this build exists to answer one question —
   is shooting these zombies fun on its own?
   ════════════════════════════════════════════════════════════════ */

const HALF = 31; // arena half-width
const EYE = 1.7;
const PLAYER_R = 0.42;
const GRAVITY = 22;

// ── weapons ──────────────────────────────────────────────────────
// unlockAt is a kill count: the "earn" path from the design. The
// "buy" path is not built — that is the untested half of the idea.
const WEAPONS = [
  {
    id: "pistol",
    name: "Pistol",
    damage: 34,
    headMult: 3,
    rpm: 0.26,
    mag: 12,
    pellets: 1,
    spread: 0.008,
    auto: false,
    reload: 1.1,
    recoil: 0.055,
    unlockAt: 0,
    pickup: 6,
    volume: 0.5,
    tone: 780,
  },
  {
    id: "rifle",
    name: "Rifle",
    damage: 26,
    headMult: 3,
    rpm: 0.096,
    mag: 30,
    pellets: 1,
    spread: 0.016,
    auto: true,
    reload: 1.7,
    recoil: 0.035,
    unlockAt: 15,
    pickup: 14,
    volume: 0.45,
    tone: 560,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    damage: 17,
    headMult: 2,
    rpm: 0.78,
    mag: 6,
    pellets: 9,
    spread: 0.075,
    auto: false,
    reload: 2.2,
    recoil: 0.13,
    unlockAt: 40,
    pickup: 3,
    volume: 0.75,
    tone: 300,
  },
];

// ── dom ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $("hud"),
  crosshair: $("crosshair"),
  healthBar: $("health-bar"),
  healthText: $("health-text"),
  weaponName: $("weapon-name"),
  mag: $("mag"),
  reserve: $("reserve"),
  reloading: $("reloading"),
  wave: $("wave"),
  kills: $("kills"),
  remaining: $("remaining"),
  loadout: $("loadout"),
  toast: $("toast"),
  banner: $("banner"),
  vignette: $("vignette"),
  start: $("start"),
  pause: $("pause"),
  dead: $("dead"),
  deadWave: $("dead-wave"),
  deadKills: $("dead-kills"),
};

// ── audio (synthesised — no asset files to ship) ─────────────────
let actx = null;

function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}

function noiseBurst(duration, freq, gainValue, type = "lowpass") {
  const ctx = audio();
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // decaying white noise
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

function tone(freq, duration, gainValue, type = "sawtooth", slideTo = null) {
  const ctx = audio();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo)
    osc.frequency.exponentialRampToValueAtTime(
      slideTo,
      ctx.currentTime + duration,
    );
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

const sfx = {
  shot: (w) => {
    noiseBurst(0.13, w.tone * 2.4, w.volume);
    tone(w.tone, 0.09, w.volume * 0.5, "square", w.tone * 0.35);
  },
  dryFire: () => tone(180, 0.05, 0.18, "square"),
  reload: () => {
    noiseBurst(0.05, 2600, 0.28, "highpass");
    setTimeout(() => noiseBurst(0.06, 1500, 0.3, "highpass"), 220);
  },
  flesh: () => noiseBurst(0.09, 420, 0.34),
  headshot: () => {
    noiseBurst(0.14, 700, 0.5);
    tone(1400, 0.06, 0.12, "sine", 400);
  },
  growl: () => tone(70 + Math.random() * 40, 0.5, 0.055, "sawtooth", 45),
  hurt: () => {
    noiseBurst(0.22, 260, 0.4);
    tone(140, 0.2, 0.12, "square", 70);
  },
  unlock: () => {
    tone(520, 0.12, 0.14, "sine");
    setTimeout(() => tone(780, 0.18, 0.14, "sine"), 110);
  },
  waveClear: () => {
    tone(392, 0.18, 0.12, "triangle");
    setTimeout(() => tone(523, 0.28, 0.12, "triangle"), 150);
  },
  death: () => tone(200, 1.1, 0.22, "sawtooth", 40),
};

// ── renderer / scene ─────────────────────────────────────────────
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);
scene.fog = new THREE.FogExp2(0x0a1018, 0.021);

const camera = new THREE.PerspectiveCamera(
  76,
  innerWidth / innerHeight,
  0.1,
  260,
);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── lighting ─────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0x3d5273, 0x0a0d12, 0.55));

const moon = new THREE.DirectionalLight(0xa8c0e0, 0.65);
moon.position.set(24, 48, -18);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -42;
moon.shadow.camera.right = 42;
moon.shadow.camera.top = 42;
moon.shadow.camera.bottom = -42;
moon.shadow.camera.far = 120;
moon.shadow.bias = -0.0012;
scene.add(moon);

// flickering fires for atmosphere and readability in the dark corners
const fires = [];
for (const [fx, fz] of [
  [-17, -14],
  [19, 12],
  [-13, 20],
]) {
  const light = new THREE.PointLight(0xff7a2a, 2.4, 22, 2);
  light.position.set(fx, 1.5, fz);
  scene.add(light);
  fires.push(light);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.45, 1.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.9 }),
  );
  barrel.position.set(fx, 0.55, fz);
  barrel.castShadow = true;
  scene.add(barrel);
}

// ── world ────────────────────────────────────────────────────────
const obstacles = []; // { x, z, r } for movement collision
const blockers = []; // meshes that stop bullets

function groundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#1b2028";
  g.fillRect(0, 0, 256, 256);
  // grit
  for (let i = 0; i < 5200; i++) {
    const v = 22 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v + 4},${v + 9},${Math.random() * 0.55})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // slab seams
  g.strokeStyle = "rgba(9,11,15,0.75)";
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(HALF, HALF);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF * 2, HALF * 2),
  new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.96 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
blockers.push(floor);

const wallMat = new THREE.MeshStandardMaterial({
  color: 0x2c3038,
  roughness: 0.92,
});

for (const [px, pz, sx, sz] of [
  [0, -HALF, HALF * 2, 1],
  [0, HALF, HALF * 2, 1],
  [-HALF, 0, 1, HALF * 2],
  [HALF, 0, 1, HALF * 2],
]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 7, sz), wallMat);
  wall.position.set(px, 3.5, pz);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  blockers.push(wall);
}

// cover: crates and containers, placed off-centre so spawn is clear
const crateMat = new THREE.MeshStandardMaterial({
  color: 0x5a4632,
  roughness: 0.85,
});
const containerMats = [0x2f4f4a, 0x5a3230, 0x3a4358].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
);

function addBox(x, z, w, h, d, mat, rot = 0) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  box.position.set(x, h / 2, z);
  box.rotation.y = rot;
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  blockers.push(box);
  obstacles.push({ x, z, r: Math.max(w, d) * 0.55 });
}

// shipping containers
addBox(-14, -6, 9, 3.2, 3, containerMats[0], 0.15);
addBox(16, -12, 3, 3.2, 9, containerMats[1], -0.1);
addBox(8, 17, 10, 3.2, 3, containerMats[2], 0.05);
addBox(-20, 10, 3, 3.2, 8, containerMats[0], -0.2);

// scattered crates
for (let i = 0; i < 22; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = 7 + Math.random() * 21;
  const s = 0.9 + Math.random() * 0.7;
  addBox(
    Math.cos(a) * d,
    Math.sin(a) * d,
    s,
    s,
    s,
    crateMat,
    Math.random() * Math.PI,
  );
}

// stacked pair, gives the arena a landmark
addBox(0, -20, 2.2, 2.2, 2.2, crateMat, 0.4);

// ── weapon viewmodels ────────────────────────────────────────────
const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x24262b,
  roughness: 0.45,
  metalness: 0.75,
});
const gunGrip = new THREE.MeshStandardMaterial({
  color: 0x171a1f,
  roughness: 0.85,
});

function part(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildViewmodel(id) {
  const g = new THREE.Group();
  if (id === "pistol") {
    g.add(part(0.09, 0.1, 0.36, 0, 0, -0.12, gunMetal)); // slide
    g.add(part(0.08, 0.2, 0.1, 0, -0.14, 0.03, gunGrip)); // grip
  } else if (id === "rifle") {
    g.add(part(0.08, 0.1, 0.72, 0, 0, -0.28, gunMetal)); // receiver
    g.add(part(0.05, 0.05, 0.3, 0, 0.01, -0.78, gunMetal)); // barrel
    g.add(part(0.08, 0.19, 0.1, 0, -0.14, 0.02, gunGrip)); // grip
    g.add(part(0.07, 0.18, 0.12, 0, -0.13, -0.24, gunGrip)); // magazine
    g.add(part(0.07, 0.11, 0.26, 0, -0.02, 0.2, gunGrip)); // stock
  } else {
    g.add(part(0.11, 0.12, 0.8, 0, 0, -0.3, gunMetal)); // body
    g.add(part(0.07, 0.07, 0.34, 0, -0.09, -0.5, gunGrip)); // pump
    g.add(part(0.09, 0.2, 0.11, 0, -0.14, 0.06, gunGrip)); // grip
  }
  g.position.set(0.26, -0.24, -0.5);
  g.visible = false;
  g.traverse((o) => (o.castShadow = false));
  camera.add(g);
  return g;
}

const viewmodels = Object.fromEntries(
  WEAPONS.map((w) => [w.id, buildViewmodel(w.id)]),
);

const muzzleLight = new THREE.PointLight(0xffd28a, 0, 9, 2);
muzzleLight.position.set(0.26, -0.2, -1.1);
camera.add(muzzleLight);

// ── effects pools ────────────────────────────────────────────────
const bloodGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e1414 });
const blood = [];
for (let i = 0; i < 130; i++) {
  const m = new THREE.Mesh(bloodGeo, bloodMat);
  m.visible = false;
  scene.add(m);
  blood.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
}
let bloodCursor = 0;

function spatter(at, dir, count) {
  for (let i = 0; i < count; i++) {
    const p = blood[bloodCursor];
    bloodCursor = (bloodCursor + 1) % blood.length;
    p.mesh.position.copy(at);
    p.mesh.visible = true;
    p.life = 0.55 + Math.random() * 0.35;
    p.vel
      .copy(dir)
      .multiplyScalar(1.6 + Math.random() * 3)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3.4,
          (Math.random() - 0.5) * 4,
        ),
      );
  }
}

const tracers = [];
for (let i = 0; i < 14; i++) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffe0a0,
    transparent: true,
    opacity: 0,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}
let tracerCursor = 0;

function tracer(from, to) {
  const t = tracers[tracerCursor];
  tracerCursor = (tracerCursor + 1) % tracers.length;
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.life = 0.06;
  t.line.material.opacity = 0.85;
}

// ── zombies ──────────────────────────────────────────────────────
const zombies = [];
const hitboxes = []; // raycast targets, mapped back via userData

const SKINS = [0x4a6b46, 0x5c6b52, 0x3f5a4a, 0x63614a];

function buildZombie(kind) {
  const skin = new THREE.MeshLambertMaterial({
    color: SKINS[(Math.random() * SKINS.length) | 0],
    transparent: true,
  });
  const cloth = new THREE.MeshLambertMaterial({
    color: kind === "brute" ? 0x3a2d3a : 0x2f3742,
    transparent: true,
  });

  const g = new THREE.Group();
  const torso = part(0.62, 1.0, 0.34, 0, 1.05, 0, cloth);
  const head = part(0.34, 0.36, 0.32, 0, 1.72, 0.02, skin);
  const armL = part(0.16, 0.72, 0.16, -0.4, 1.25, -0.22, skin);
  const armR = part(0.16, 0.72, 0.16, 0.4, 1.25, -0.22, skin);
  const legL = part(0.2, 0.78, 0.2, -0.17, 0.39, 0, cloth);
  const legR = part(0.2, 0.78, 0.2, 0.17, 0.39, 0, cloth);

  // arms reach forward — reads as "zombie" at a glance
  armL.rotation.x = -1.15;
  armR.rotation.x = -1.15;

  for (const m of [torso, head, armL, armR, legL, legR]) {
    m.castShadow = true;
    g.add(m);
  }

  return { group: g, torso, head, legL, legR, skin, cloth };
}

function spawnZombie(wave) {
  const roll = Math.random();
  let kind = "walker";
  if (wave >= 4 && roll < 0.2) kind = "runner";
  else if (wave >= 6 && roll > 0.9) kind = "brute";

  const model = buildZombie(kind);
  const scale = kind === "brute" ? 1.42 : kind === "runner" ? 0.92 : 1;
  model.group.scale.setScalar(scale);

  // spawn on the perimeter, clear of the player
  let x,
    z,
    tries = 0;
  do {
    const a = Math.random() * Math.PI * 2;
    const d = 21 + Math.random() * 7;
    x = Math.cos(a) * d;
    z = Math.sin(a) * d;
    tries++;
  } while (tries < 30 && Math.hypot(x - player.pos.x, z - player.pos.z) < 16);

  model.group.position.set(x, 0, z);
  scene.add(model.group);

  const waveScale = 1 + 0.13 * (wave - 1);
  const base =
    kind === "brute"
      ? { hp: 300, speed: 1.25, dmg: 26 }
      : kind === "runner"
        ? { hp: 60, speed: 3.5, dmg: 8 }
        : { hp: 100, speed: 1.75, dmg: 13 };

  const z0 = {
    kind,
    ...model,
    hp: base.hp * waveScale,
    maxHp: base.hp * waveScale,
    speed: base.speed * (1 + 0.035 * (wave - 1)) * (0.9 + Math.random() * 0.2),
    damage: base.dmg,
    radius: 0.45 * scale,
    phase: Math.random() * Math.PI * 2,
    attackCd: 0,
    flash: 0,
    dying: 0,
    growlCd: Math.random() * 6,
  };

  model.torso.userData.zombie = z0;
  model.head.userData.zombie = z0;
  model.head.userData.isHead = true;
  hitboxes.push(model.torso, model.head);
  zombies.push(z0);
  return z0;
}

function removeZombie(z, index) {
  scene.remove(z.group);
  z.group.traverse((o) => o.geometry?.dispose?.());
  z.skin.dispose();
  z.cloth.dispose();
  for (const part of [z.torso, z.head]) {
    const i = hitboxes.indexOf(part);
    if (i !== -1) hitboxes.splice(i, 1);
  }
  zombies.splice(index, 1);
}

// ── player / game state ──────────────────────────────────────────
const player = {
  pos: new THREE.Vector3(0, 0, 8),
  vel: new THREE.Vector3(),
  vy: 0,
  grounded: true,
  hp: 100,
  lastHit: -99,
  bob: 0,
};

const game = {
  running: false,
  over: false,
  time: 0,
  wave: 0,
  kills: 0,
  toSpawn: 0,
  spawnTimer: 0,
  intermission: 0,
  weapon: 0,
  unlocked: ["pistol"],
  mag: WEAPONS[0].mag,
  reserve: 90,
  cooldown: 0,
  reloadTimer: 0,
  recoil: 0,
  triggerHeld: false,
  firedThisPress: false,
};

const keys = new Set();

// ── hud ──────────────────────────────────────────────────────────
function renderLoadout() {
  ui.loadout.innerHTML = "";
  WEAPONS.forEach((w, i) => {
    const el = document.createElement("div");
    const has = game.unlocked.includes(w.id);
    el.className =
      "slot" + (i === game.weapon ? " active" : "") + (has ? "" : " locked");
    el.textContent = has ? `${i + 1} ${w.name}` : `${i + 1} ${w.unlockAt} KILLS`;
    ui.loadout.appendChild(el);
  });
}

function syncHud() {
  const w = WEAPONS[game.weapon];
  ui.healthBar.style.width = `${Math.max(0, player.hp)}%`;
  ui.healthBar.classList.toggle("low", player.hp <= 35);
  ui.healthText.textContent = Math.max(0, Math.round(player.hp));
  ui.weaponName.textContent = w.name;
  ui.mag.textContent = game.mag;
  ui.mag.classList.toggle("empty", game.mag === 0);
  ui.reserve.textContent = `/ ${game.reserve}`;
  ui.reloading.classList.toggle("hidden", game.reloadTimer <= 0);
  ui.wave.textContent = game.wave;
  ui.kills.textContent = game.kills;
  ui.remaining.textContent = zombies.filter((z) => !z.dying).length + game.toSpawn;
}

let toastTimer = null;
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2200);
}

let bannerTimer = null;
function banner(text, ms = 1800) {
  ui.banner.textContent = text;
  ui.banner.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.remove("show"), ms);
}

// ── shooting ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.far = 180;
const shotDir = new THREE.Vector3();
const camDir = new THREE.Vector3();
const muzzlePoint = new THREE.Vector3();

function fire() {
  const w = WEAPONS[game.weapon];
  if (game.reloadTimer > 0 || game.cooldown > 0) return;

  if (game.mag <= 0) {
    sfx.dryFire();
    game.cooldown = 0.22;
    startReload();
    return;
  }

  game.mag--;
  game.cooldown = w.rpm;
  game.recoil = w.recoil;
  sfx.shot(w);

  muzzleLight.intensity = 7;
  ui.crosshair.classList.add("bloom");
  setTimeout(() => ui.crosshair.classList.remove("bloom"), 70);

  camera.getWorldDirection(camDir);
  muzzlePoint.copy(camera.position).addScaledVector(camDir, 0.6);

  let hitAny = false;

  for (let p = 0; p < w.pellets; p++) {
    shotDir
      .copy(camDir)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * w.spread * 2,
          (Math.random() - 0.5) * w.spread * 2,
          (Math.random() - 0.5) * w.spread * 2,
        ),
      )
      .normalize();

    raycaster.set(camera.position, shotDir);

    const zHits = raycaster.intersectObjects(hitboxes, false);
    const wHits = raycaster.intersectObjects(blockers, false);
    const zDist = zHits.length ? zHits[0].distance : Infinity;
    const wDist = wHits.length ? wHits[0].distance : Infinity;

    if (zDist < wDist) {
      const hit = zHits[0];
      const z = hit.object.userData.zombie;
      const head = hit.object.userData.isHead === true;
      if (z && !z.dying) {
        hitAny = true;
        damageZombie(z, w.damage * (head ? w.headMult : 1), head, shotDir, hit.point);
      }
      tracer(muzzlePoint, hit.point);
    } else if (wHits.length) {
      tracer(muzzlePoint, wHits[0].point);
    } else {
      tracer(
        muzzlePoint,
        muzzlePoint.clone().addScaledVector(shotDir, raycaster.far),
      );
    }
  }

  if (hitAny) {
    ui.crosshair.classList.add("hit");
    setTimeout(() => ui.crosshair.classList.remove("hit"), 110);
  }
  syncHud();
}

function damageZombie(z, amount, head, dir, point) {
  z.hp -= amount;
  z.flash = 1;
  spatter(point, dir, head ? 14 : 7);
  head ? sfx.headshot() : sfx.flesh();

  if (z.hp <= 0) {
    z.dying = 0.001;
    game.kills++;
    game.reserve = Math.min(400, game.reserve + WEAPONS[game.weapon].pickup);
    checkUnlocks();
  }
}

function checkUnlocks() {
  for (const w of WEAPONS) {
    if (!game.unlocked.includes(w.id) && game.kills >= w.unlockAt) {
      game.unlocked.push(w.id);
      sfx.unlock();
      toast(`${w.name.toUpperCase()} UNLOCKED — PRESS ${WEAPONS.indexOf(w) + 1}`);
      renderLoadout();
    }
  }
}

function startReload() {
  const w = WEAPONS[game.weapon];
  if (game.reloadTimer > 0 || game.mag >= w.mag || game.reserve <= 0) return;
  game.reloadTimer = w.reload;
  sfx.reload();
  syncHud();
}

function finishReload() {
  const w = WEAPONS[game.weapon];
  const need = w.mag - game.mag;
  const take = Math.min(need, game.reserve);
  game.mag += take;
  game.reserve -= take;
  syncHud();
}

function switchWeapon(index) {
  const w = WEAPONS[index];
  if (!w || index === game.weapon) return;
  if (!game.unlocked.includes(w.id)) {
    toast(`${w.name.toUpperCase()} LOCKED — ${w.unlockAt} KILLS`);
    return;
  }
  viewmodels[WEAPONS[game.weapon].id].visible = false;
  game.weapon = index;
  viewmodels[w.id].visible = true;
  game.mag = Math.min(game.mag, w.mag);
  if (game.mag < w.mag && game.reserve > 0) {
    game.mag = Math.min(w.mag, game.mag + game.reserve);
  }
  game.reloadTimer = 0;
  game.cooldown = 0.25;
  renderLoadout();
  syncHud();
}

// ── waves ────────────────────────────────────────────────────────
function startWave(n) {
  game.wave = n;
  game.toSpawn = 5 + n * 3;
  game.spawnTimer = 0;
  banner(`WAVE ${n}`);
  syncHud();
}

// ── movement + collision ─────────────────────────────────────────
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();

function movePlayer(dt) {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (keys.has("KeyW")) wish.add(forward);
  if (keys.has("KeyS")) wish.sub(forward);
  if (keys.has("KeyD")) wish.add(right);
  if (keys.has("KeyA")) wish.sub(right);

  const moving = wish.lengthSq() > 0;
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = sprinting ? 8.4 : 5.4;

  if (moving) wish.normalize().multiplyScalar(speed);

  // smooth acceleration — instant velocity feels slippery
  player.vel.lerp(wish, Math.min(1, dt * 14));
  player.pos.addScaledVector(player.vel, dt);

  // vertical
  player.vy -= GRAVITY * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vy = 0;
    player.grounded = true;
  }

  // arena bounds
  const limit = HALF - 0.8;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -limit, limit);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -limit, limit);

  // push out of obstacles
  for (const o of obstacles) {
    const dx = player.pos.x - o.x;
    const dz = player.pos.z - o.z;
    const min = o.r + PLAYER_R;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      player.pos.x = o.x + (dx / d) * min;
      player.pos.z = o.z + (dz / d) * min;
    }
  }

  // head bob while grounded and moving
  const speedNow = player.vel.length();
  player.bob += dt * speedNow * 1.5;
  const bobAmount = player.grounded ? Math.sin(player.bob) * 0.035 : 0;

  camera.position.set(
    player.pos.x,
    player.pos.y + EYE + bobAmount,
    player.pos.z,
  );
}

// ── zombie ai ────────────────────────────────────────────────────
const toPlayer = new THREE.Vector3();
const sep = new THREE.Vector3();

function updateZombies(dt) {
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    const g = z.group;

    if (z.dying > 0) {
      z.dying += dt;
      const t = Math.min(1, z.dying / 1.3);
      g.rotation.x = -t * Math.PI * 0.5;
      g.position.y = -t * 0.35;
      z.skin.opacity = z.cloth.opacity = 1 - t;
      if (t >= 1) removeZombie(z, i);
      continue;
    }

    toPlayer.set(
      player.pos.x - g.position.x,
      0,
      player.pos.z - g.position.z,
    );
    const dist = toPlayer.length();
    toPlayer.normalize();

    // keep the horde from stacking into one body
    sep.set(0, 0, 0);
    for (const other of zombies) {
      if (other === z || other.dying) continue;
      const dx = g.position.x - other.group.position.x;
      const dz = g.position.z - other.group.position.z;
      const need = z.radius + other.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < need * need && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        sep.x += (dx / d) * (need - d);
        sep.z += (dz / d) * (need - d);
      }
    }

    if (dist > 1.35) {
      g.position.x += (toPlayer.x * z.speed + sep.x * 5) * dt;
      g.position.z += (toPlayer.z * z.speed + sep.z * 5) * dt;
    } else {
      g.position.x += sep.x * 4 * dt;
      g.position.z += sep.z * 4 * dt;

      z.attackCd -= dt;
      if (z.attackCd <= 0) {
        z.attackCd = 1.05;
        hurtPlayer(z.damage);
      }
    }

    // don't walk through cover
    for (const o of obstacles) {
      const dx = g.position.x - o.x;
      const dz = g.position.z - o.z;
      const min = o.r + z.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        g.position.x = o.x + (dx / d) * min;
        g.position.z = o.z + (dz / d) * min;
      }
    }

    g.position.x = THREE.MathUtils.clamp(g.position.x, -HALF + 1, HALF - 1);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -HALF + 1, HALF - 1);

    g.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // shambling walk
    z.phase += dt * z.speed * 3.4;
    const swing = Math.sin(z.phase);
    z.legL.rotation.x = swing * 0.75;
    z.legR.rotation.x = -swing * 0.75;
    g.position.y = Math.abs(Math.sin(z.phase * 0.5)) * 0.05;
    g.rotation.z = Math.sin(z.phase * 0.5) * 0.06;

    // hit flash
    if (z.flash > 0) {
      z.flash = Math.max(0, z.flash - dt * 5);
      z.skin.emissive?.setRGB(z.flash * 0.9, 0, 0);
      z.cloth.emissive?.setRGB(z.flash * 0.9, 0, 0);
    }

    // occasional growl, quieter with distance
    z.growlCd -= dt;
    if (z.growlCd <= 0) {
      z.growlCd = 4 + Math.random() * 8;
      if (dist < 22 && game.running) sfx.growl();
    }
  }
}

function hurtPlayer(amount) {
  if (game.over) return;
  player.hp -= amount;
  player.lastHit = game.time;
  sfx.hurt();
  ui.vignette.style.opacity = "0.85";
  setTimeout(() => (ui.vignette.style.opacity = "0"), 130);
  syncHud();
  if (player.hp <= 0) endGame();
}

// ── loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (game.running && !game.over) {
    game.time += dt;

    movePlayer(dt);
    updateZombies(dt);

    // spawn drip
    if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0 && zombies.length < 26) {
        game.spawnTimer = Math.max(0.25, 0.85 - game.wave * 0.04);
        spawnZombie(game.wave);
        game.toSpawn--;
        syncHud();
      }
    } else if (zombies.every((z) => z.dying > 0)) {
      if (game.intermission <= 0) {
        game.intermission = 4;
        sfx.waveClear();
        banner(`WAVE ${game.wave} CLEARED`, 2600);
        player.hp = Math.min(100, player.hp + 25);
        game.reserve = Math.min(400, game.reserve + 30);
        toast("+25 HP · +30 AMMO");
        syncHud();
      } else {
        game.intermission -= dt;
        if (game.intermission <= 0) startWave(game.wave + 1);
      }
    }

    // weapon timers
    game.cooldown = Math.max(0, game.cooldown - dt);
    if (game.reloadTimer > 0) {
      game.reloadTimer -= dt;
      if (game.reloadTimer <= 0) {
        game.reloadTimer = 0;
        finishReload();
      }
    }

    // full-auto hold
    const w = WEAPONS[game.weapon];
    // an empty magazine still reaches fire(), which dry-fires and reloads
    if (game.triggerHeld && (w.auto || !game.firedThisPress)) {
      if (game.cooldown <= 0 && game.reloadTimer <= 0) {
        game.firedThisPress = true;
        fire();
      }
    }

    // health regen after a lull
    if (game.time - player.lastHit > 5 && player.hp < 100) {
      player.hp = Math.min(100, player.hp + 7 * dt);
      syncHud();
    }
  }

  // viewmodel sway + recoil (runs even when paused so it settles)
  game.recoil = Math.max(0, game.recoil - dt * 3.4);
  const vm = viewmodels[WEAPONS[game.weapon].id];
  const reloadDip = game.reloadTimer > 0 ? 0.16 : 0;
  vm.position.set(
    0.26,
    -0.24 - reloadDip + Math.sin(player.bob) * 0.008,
    -0.5 + game.recoil * 0.9,
  );
  vm.rotation.set(game.recoil * 3.2, game.reloadTimer > 0 ? 0.45 : 0, 0);
  muzzleLight.intensity *= 0.72;

  // effects
  for (const p of blood) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vel.y -= 15 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.mesh.position.y < 0.03) {
      p.mesh.position.y = 0.03;
      p.vel.set(0, 0, 0);
    }
    if (p.life <= 0) p.mesh.visible = false;
  }

  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.85;
  }

  // fire flicker
  const f = game.time;
  fires.forEach((light, i) => {
    light.intensity = 2.1 + Math.sin(f * 9 + i * 2.1) * 0.5 + Math.random() * 0.3;
  });

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ── input ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (!game.running) return;
  if (e.code === "KeyR") startReload();
  if (e.code === "Digit1") switchWeapon(0);
  if (e.code === "Digit2") switchWeapon(1);
  if (e.code === "Digit3") switchWeapon(2);
  if (e.code === "Space" && player.grounded) {
    player.vy = 7.2;
    player.grounded = false;
  }
});

addEventListener("keyup", (e) => keys.delete(e.code));

addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !game.running || game.over) return;
  game.triggerHeld = true;
  game.firedThisPress = false;
});

addEventListener("mouseup", (e) => {
  if (e.button === 0) game.triggerHeld = false;
});

controls.addEventListener("unlock", () => {
  if (game.over || !game.running) return;
  game.running = false;
  keys.clear();
  game.triggerHeld = false;
  ui.pause.classList.remove("hidden");
});

// ── start / restart ──────────────────────────────────────────────
function beginPlay() {
  ui.start.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.dead.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  game.running = true;
  clock.getDelta(); // drop the accumulated idle time
  controls.lock();
  audio();
}

function resetGame() {
  for (let i = zombies.length - 1; i >= 0; i--) removeZombie(zombies[i], i);
  player.pos.set(0, 0, 8);
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.hp = 100;
  player.lastHit = 0;

  viewmodels[WEAPONS[game.weapon].id].visible = false;
  Object.assign(game, {
    over: false,
    time: 0,
    kills: 0,
    toSpawn: 0,
    intermission: 0,
    weapon: 0,
    unlocked: ["pistol"],
    mag: WEAPONS[0].mag,
    reserve: 90,
    cooldown: 0,
    reloadTimer: 0,
    recoil: 0,
    triggerHeld: false,
  });
  viewmodels.pistol.visible = true;

  renderLoadout();
  startWave(1);
  syncHud();
}

function endGame() {
  game.over = true;
  game.running = false;
  sfx.death();
  ui.deadWave.textContent = game.wave;
  ui.deadKills.textContent = game.kills;
  controls.unlock();
  ui.dead.classList.remove("hidden");
}

$("start-btn").addEventListener("click", () => {
  resetGame();
  beginPlay();
});

$("resume-btn").addEventListener("click", beginPlay);

$("retry-btn").addEventListener("click", () => {
  resetGame();
  beginPlay();
});

// prime the view before the first click
viewmodels.pistol.visible = true;
camera.position.set(0, EYE, 8);
renderLoadout();
syncHud();
