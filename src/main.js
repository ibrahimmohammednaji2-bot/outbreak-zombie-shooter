import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import "./style.css";
import {
  EYE,
  PLAYER_R,
  GRAVITY,
  WALK,
  SPRINT,
  JUMP,
  getDifficulty,
  DM_SCORE_LIMIT,
  DM_RESPAWN,
} from "./config.js";
import { byId } from "./weapons.js";
import { mapById } from "./maps.js";
import { applyAttachments } from "./attachments.js";
import { lethalById, tacticalById } from "./equipment.js";
import { sfx, audio } from "./audio.js";
import { createEffects } from "./effects.js";
import { createLobby, stats } from "./menu.js";

/* ════════════════════════════════════════════════════════════════
   OUTBREAK — Zombies and Deathmatch, six maps, five loadouts.
   Multiplayer opponents are AI: networked play needs a game server,
   which a static build cannot provide.
   ════════════════════════════════════════════════════════════════ */

/* ── crash reporting ──────────────────────────────────────────────
 * A thrown error used to leave a silent black screen. Now it says so,
 * on screen and in the console (which the dev server also records).
 */
function fatal(what, err) {
  const msg = `${what}: ${err?.message ?? err}\n${err?.stack ?? ""}`;
  console.error("[outbreak]", msg);
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal";
    el.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:999;background:#5a0d0d;" +
      "color:#fff;font:12px/1.6 ui-monospace,monospace;padding:14px;" +
      "white-space:pre-wrap;max-height:50vh;overflow:auto;border-top:2px solid #ff5a5a";
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

addEventListener("error", (e) =>
  fatal("uncaught", e.error ?? { message: `${e.message} @ ${e.filename}:${e.lineno}` }),
);
addEventListener("unhandledrejection", (e) => fatal("promise", e.reason));

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
  equipLine: $("equip-line"),
  top: $("hud-top"),
  scoreboard: $("scoreboard"),
  killfeed: $("killfeed"),
  loadoutBar: $("loadout-bar"),
  toast: $("toast"),
  banner: $("banner"),
  vignette: $("vignette"),
  flash: $("flash"),
  respawning: $("respawning"),
  respawnIn: $("respawn-in"),
  pause: $("pause"),
  result: $("result"),
  resultTitle: $("result-title"),
  resultSub: $("result-sub"),
  resultBody: $("result-body"),
};

// ── renderer ─────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

/*
 * A browser only allows a handful of live WebGL contexts. Open the game in
 * several tabs and the oldest ones have their context taken away — they then
 * render solid black with no error at all. Say so instead of dying quietly.
 */
$("scene").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  fatal(
    "WebGL context lost",
    new Error(
      "The browser took this tab's 3D context away — usually because the game " +
        "is open in several tabs at once. Close the other tabs and reload.",
    ),
  );
});
$("scene").addEventListener("webglcontextrestored", () => {
  location.reload();
});

const scene = new THREE.Scene();
const BASE_FOV = 76;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 300);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);
const fx = createEffects(scene);

addEventListener("resize", () => {
  camera.aspect = lobbyCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  lobbyCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── shared materials ─────────────────────────────────────────────
const MATS = {
  metal: new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.45, metalness: 0.75 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8 }),
};

const propMats = new Map();
const propMat = (hex) => {
  if (!propMats.has(hex))
    propMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 }));
  return propMats.get(hex);
};

const groundTextures = new Map();
function groundTexture(hex, repeat) {
  const key = `${hex}:${repeat}`;
  if (groundTextures.has(key)) return groundTextures.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const base = new THREE.Color(hex);
  g.fillStyle = `rgb(${(base.r * 255) | 0},${(base.g * 255) | 0},${(base.b * 255) | 0})`;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = Math.random() * 0.45 + 0.8;
    g.fillStyle = `rgba(${(base.r * 255 * v) | 0},${(base.g * 255 * v) | 0},${
      (base.b * 255 * v) | 0
    },${Math.random() * 0.6})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  groundTextures.set(key, tex);
  return tex;
}

const part = (w, h, d, x, y, z, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

function humanoid(skinHex, clothHex) {
  const skin = new THREE.MeshLambertMaterial({ color: skinHex, transparent: true });
  const cloth = new THREE.MeshLambertMaterial({ color: clothHex, transparent: true });
  const group = new THREE.Group();
  const torso = part(0.62, 1.0, 0.34, 0, 1.05, 0, cloth);
  const head = part(0.34, 0.36, 0.32, 0, 1.72, 0.02, skin);
  const armL = part(0.16, 0.72, 0.16, -0.4, 1.25, -0.22, skin);
  const armR = part(0.16, 0.72, 0.16, 0.4, 1.25, -0.22, skin);
  const legL = part(0.2, 0.78, 0.2, -0.17, 0.39, 0, cloth);
  const legR = part(0.2, 0.78, 0.2, 0.17, 0.39, 0, cloth);
  // Only the bulk casts a shadow. Limbs tripled the shadow pass for detail
  // nobody can see at night, and thirty zombies made that expensive.
  for (const m of [torso, head, armL, armR, legL, legR]) {
    m.castShadow = m === torso || m === head;
    group.add(m);
  }
  return { group, torso, head, armL, armR, legL, legR, skin, cloth };
}

// ── lobby scene (the character you see behind the menu) ──────────
const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0x0a1220);
lobbyScene.fog = new THREE.FogExp2(0x0a1220, 0.05);
const lobbyCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
lobbyCam.position.set(0, 1.5, 5.2);
lobbyCam.lookAt(0, 1.1, 0);

{
  lobbyScene.add(new THREE.HemisphereLight(0x5878a8, 0x0a0d14, 0.9));
  const key = new THREE.DirectionalLight(0xdce8ff, 1.1);
  key.position.set(3, 6, 4);
  lobbyScene.add(key);
  const rim = new THREE.PointLight(0x7fd1b9, 2.4, 12, 2);
  rim.position.set(-2.5, 2, -2);
  lobbyScene.add(rim);

  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.3, 0.18, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.6 }),
  );
  dais.position.y = 0.09;
  lobbyScene.add(dais);
}

const lobbyGuy = humanoid(0xc7a887, 0x35506e);
lobbyGuy.group.position.y = 0.18;
lobbyScene.add(lobbyGuy.group);

// ── world ────────────────────────────────────────────────────────
let mapGroup = null;
let mapDef = null;
const blockers = [];
const obstacles = [];
const fires = [];

function clearMap() {
  if (!mapGroup) return;
  mapGroup.traverse((o) => o.isMesh && o.geometry.dispose());
  scene.remove(mapGroup);
  mapGroup = null;
  blockers.length = 0;
  obstacles.length = 0;
  fires.length = 0;
}

function buildMap(def) {
  clearMap();
  mapDef = def;
  mapGroup = new THREE.Group();
  scene.add(mapGroup);

  scene.background = new THREE.Color(def.fogColor);
  scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity);
  mapGroup.add(new THREE.HemisphereLight(def.hemiSky, def.hemiGround, 0.9));

  const moon = new THREE.DirectionalLight(def.moon, def.moonIntensity);
  moon.position.set(def.half * 0.8, def.half * 1.6, -def.half * 0.6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const s = def.half + 12;
  Object.assign(moon.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: s * 4 });
  moon.shadow.camera.updateProjectionMatrix();
  moon.shadow.bias = -0.0012;
  mapGroup.add(moon);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(def.half * 2, def.half * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(def.ground, def.half), roughness: 0.96 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mapGroup.add(floor);
  blockers.push(floor);

  const wallMat = propMat(0x2c3038);
  for (const [px, pz, sx, sz] of [
    [0, -def.half, def.half * 2, 1],
    [0, def.half, def.half * 2, 1],
    [-def.half, 0, 1, def.half * 2],
    [def.half, 0, 1, def.half * 2],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 7, sz), wallMat);
    wall.position.set(px, 3.5, pz);
    wall.castShadow = wall.receiveShadow = true;
    mapGroup.add(wall);
    blockers.push(wall);
  }

  for (const p of def.props) {
    let mesh;
    // Props shorter than this are scenery you simply walk over — blocking on
    // a bench or a kerb feels like a bug even when it is "correct".
    const solid = p.h >= 1;

    if (p.t === "cyl") {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(p.rt, p.rb, p.h, 12), propMat(p.c));
      mesh.position.set(p.x, p.h / 2, p.z);
      if (solid)
        obstacles.push({ round: true, x: p.x, z: p.z, r: Math.max(p.rt, p.rb) + 0.05 });
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), propMat(p.c));
      mesh.position.set(p.x, p.h / 2, p.z);
      mesh.rotation.y = p.r;
      // A real oriented box. Using a circle here turned long walls into
      // enormous invisible cylinders.
      if (solid)
        obstacles.push({
          round: false,
          x: p.x,
          z: p.z,
          hw: p.w / 2,
          hd: p.d / 2,
          cos: Math.cos(p.r),
          sin: Math.sin(p.r),
        });
    }
    mesh.castShadow = mesh.receiveShadow = true;
    mapGroup.add(mesh);
    blockers.push(mesh);
  }

  for (const [bx, bz] of def.fires ?? []) {
    const light = new THREE.PointLight(0xff7a2a, 2.4, 24, 2);
    light.position.set(bx, 1.6, bz);
    mapGroup.add(light);
    fires.push(light);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.1, 12), propMat(0x3a2b22));
    barrel.position.set(bx, 0.55, bz);
    barrel.castShadow = true;
    mapGroup.add(barrel);
    blockers.push(barrel);
    obstacles.push({ x: bx, z: bz, r: 0.6 });
  }
}

// ── entity registry ──────────────────────────────────────────────
const targets = [];

function registerTarget(entity, model) {
  model.torso.userData.entity = entity;
  model.head.userData.entity = entity;
  model.head.userData.isHead = true;
  targets.push(model.torso, model.head);
}

function unregisterTarget(model) {
  for (const m of [model.torso, model.head]) {
    const i = targets.indexOf(m);
    if (i !== -1) targets.splice(i, 1);
  }
}

// ── state ────────────────────────────────────────────────────────
const state = {
  phase: "menu",
  mode: "zombies",
  diff: getDifficulty("normal"),
  time: 0,
  wave: 0,
  toSpawn: 0,
  spawnTimer: 0,
  intermission: 0,
  botCount: 5,
};

const player = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  vy: 0,
  grounded: true,
  hp: 100,
  alive: true,
  respawn: 0,
  lastHit: -99,
  bob: 0,
  score: 0,
  kills: 0,
  blind: 0,
  slow: 0,
  name: "YOU",
  type: "player",
};

const gun = {
  cooldown: 0,
  reloadT: 0,
  recoil: 0,
  held: false,
  queued: 0, // clicks banked between frames — never drop a shot
  firedThisPress: false,
  aiming: false,
};

let slots = [];
let cur = 0;
let viewmodels = [];
let equip = { lethal: null, tactical: null, lethalLeft: 0, tacticalLeft: 0 };

const zombies = [];
const bots = [];
const throwables = [];
const projectiles = [];
const smokes = [];
const keys = new Set();

const muzzleLight = new THREE.PointLight(0xffd28a, 0, 9, 2);
muzzleLight.position.set(0.26, -0.2, -1.1);
camera.add(muzzleLight);

// ── loadout runtime ──────────────────────────────────────────────
function buildViewmodel(w) {
  const g = new THREE.Group();
  for (const [pw, ph, pd, px, py, pz, mat] of w.model) g.add(part(pw, ph, pd, px, py, pz, MATS[mat]));
  g.position.set(0.26, -0.24, -0.5);
  g.visible = false;
  g.traverse((o) => (o.castShadow = false));
  camera.add(g);
  return g;
}

function setLoadout(loadout, keepAmmo = false) {
  const previous = slots;
  for (const vm of viewmodels) {
    vm.traverse((o) => o.isMesh && o.geometry.dispose());
    camera.remove(vm);
  }

  slots = loadout.weapons
    .map((entry) => {
      const base = byId(entry.id);
      if (!base) return null;
      const w = applyAttachments(base, entry.att);
      const old = keepAmmo ? previous.find((p) => p.w.id === w.id) : null;
      return { w, mag: old ? Math.min(old.mag, w.mag) : w.mag, reserve: old ? old.reserve : w.reserve };
    })
    .filter(Boolean);

  viewmodels = slots.map((s) => buildViewmodel(s.w));
  cur = 0;
  if (viewmodels[0]) viewmodels[0].visible = true;

  equip.lethal = lethalById(loadout.lethal);
  equip.tactical = tacticalById(loadout.tactical);
  if (!keepAmmo) refillEquipment();

  renderLoadoutBar();
}

function refillEquipment() {
  equip.lethalLeft = equip.lethal.count;
  equip.tacticalLeft = equip.tactical.count;
}

const weapon = () => slots[cur]?.w;

function refillAll() {
  for (const s of slots) {
    s.mag = s.w.mag;
    s.reserve = s.w.reserve;
  }
  refillEquipment();
}

function switchTo(i) {
  if (i === cur || !slots[i] || gun.reloadT > 0) return;
  viewmodels[cur].visible = false;
  cur = i;
  viewmodels[cur].visible = true;
  gun.cooldown = 0.28;
  gun.aiming = false;
  sfx.swap();
  renderLoadoutBar();
  writeHud();
}

// ── shooting ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.far = 220;
const camDir = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const muzzlePoint = new THREE.Vector3();
const tmp = new THREE.Vector3();

function fire() {
  const s = slots[cur];
  if (!s || gun.reloadT > 0 || gun.cooldown > 0) return;
  const w = s.w;

  if (s.mag <= 0) {
    sfx.dryFire();
    gun.cooldown = 0.24;
    startReload();
    return;
  }

  s.mag--;
  gun.cooldown = w.rpm;
  gun.recoil = w.recoil * (gun.aiming ? 0.6 : 1);
  sfx.shot(w);
  muzzleLight.intensity = 7;
  ui.crosshair.classList.add("bloom");
  setTimeout(() => ui.crosshair.classList.remove("bloom"), 70);

  camera.getWorldDirection(camDir);
  muzzlePoint.copy(camera.position).addScaledVector(camDir, 0.7);

  if (w.projectile) {
    launchProjectile(w, muzzlePoint, camDir);
    writeHud();
    return;
  }

  const spread = w.spread * (gun.aiming ? 0.32 : 1);
  let hitAny = false;

  for (let p = 0; p < w.pellets; p++) {
    shotDir
      .copy(camDir)
      .add(
        tmp.set(
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * spread * 2,
        ),
      )
      .normalize();

    raycaster.set(camera.position, shotDir);
    const tHits = raycaster.intersectObjects(targets, false);
    const wHits = raycaster.intersectObjects(blockers, false);
    const tDist = tHits.length ? tHits[0].distance : Infinity;
    const wDist = wHits.length ? wHits[0].distance : Infinity;

    if (tDist < wDist) {
      const hit = tHits[0];
      const ent = hit.object.userData.entity;
      const head = hit.object.userData.isHead === true;
      if (ent && ent.alive) {
        hitAny = true;
        damage(ent, w.damage * (head ? w.headMult : 1), head, shotDir, hit.point, player);
      }
      fx.tracer(muzzlePoint, hit.point);
    } else if (wHits.length) {
      fx.burst(wHits[0].point, tmp.copy(shotDir).negate(), 2, "spark");
      fx.tracer(muzzlePoint, wHits[0].point);
    } else {
      fx.tracer(muzzlePoint, tmp.copy(muzzlePoint).addScaledVector(shotDir, raycaster.far));
    }
  }

  if (hitAny) {
    ui.crosshair.classList.add("hit");
    setTimeout(() => ui.crosshair.classList.remove("hit"), 110);
  }
  writeHud();
}

function damage(ent, amount, head, dir, point, source) {
  ent.hp -= amount;
  ent.flash = 1;
  fx.burst(point, dir, head ? 14 : 7);
  head ? sfx.headshot() : sfx.flesh();
  if (ent.hp <= 0) kill(ent, source);
}

function kill(ent, source) {
  if (!ent.alive) return;
  ent.alive = false;
  ent.dying = 0.001;

  if (ent.type === "zombie") {
    if (source === player) {
      player.kills++;
      slots[cur].reserve = Math.min(900, slots[cur].reserve + slots[cur].w.pickup);
    }
  } else {
    ent.respawn = DM_RESPAWN;
    unregisterTarget(ent.model);
    if (source) {
      source.score++;
      if (source === player) {
        player.kills++;
        sfx.kill();
        const s = slots[cur];
        s.reserve = Math.min(s.w.reserve, s.reserve + Math.ceil(s.w.mag * 0.5));
      }
    }
    feed(source?.name ?? "???", ent.name);
    checkMatchEnd();
  }
}

function startReload() {
  const s = slots[cur];
  if (!s || gun.reloadT > 0 || s.mag >= s.w.mag || s.reserve <= 0) return;
  gun.reloadT = s.w.reload;
  sfx.reload();
  writeHud();
}

function finishReload() {
  const s = slots[cur];
  const take = Math.min(s.w.mag - s.mag, s.reserve);
  s.mag += take;
  s.reserve -= take;
  writeHud();
}

// ── explosions, projectiles, equipment ───────────────────────────
const boomGeo = new THREE.SphereGeometry(1, 16, 12);

function explode(pos, radius, dmg, source) {
  const shell = new THREE.Mesh(
    boomGeo,
    new THREE.MeshBasicMaterial({ color: 0xffb057, transparent: true, opacity: 0.7 }),
  );
  shell.position.copy(pos);
  shell.scale.setScalar(0.4);
  scene.add(shell);

  const light = new THREE.PointLight(0xffa050, 30, radius * 3.5, 2);
  light.position.copy(pos);
  scene.add(light);

  blasts.push({ shell, light, t: 0, radius });

  fx.burst(pos, new THREE.Vector3(0, 1, 0), 26, "spark");
  sfx.explosion(pos.distanceTo(player.pos));

  const hurt = (ent, entPos) => {
    const d = entPos.distanceTo(pos);
    if (d > radius) return;
    const falloff = 1 - d / radius;
    if (!hasLineOfSight(pos, entPos, false)) return; // walls absorb the blast
    const amount = dmg * falloff;
    if (ent === player) hurtPlayer(amount * 0.6, source === player ? null : source);
    else if (ent.alive) {
      ent.hp -= amount;
      ent.flash = 1;
      fx.burst(entPos.clone().setY(1), new THREE.Vector3(0, 1, 0), 6);
      if (ent.hp <= 0) kill(ent, source);
    }
  };

  for (const z of zombies) if (z.alive) hurt(z, z.group.position);
  for (const b of bots) if (b.alive) hurt(b, b.group.position);
  if (player.alive) hurt(player, player.pos);
}

const blasts = [];

function launchProjectile(w, from, dir) {
  const p = w.projectile;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.11, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6a60, roughness: 0.5 }),
  );
  mesh.position.copy(from);
  scene.add(mesh);
  projectiles.push({
    mesh,
    vel: dir.clone().multiplyScalar(p.speed),
    gravity: p.gravity,
    radius: p.radius,
    damage: p.damage,
    life: 6,
    owner: player,
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.vel.y -= p.gravity * dt;

    const step = tmp.copy(p.vel).multiplyScalar(dt);
    const dist = step.length();
    raycaster.set(p.mesh.position, tmp.copy(p.vel).normalize());
    raycaster.far = dist + 0.4;
    const hits = [
      ...raycaster.intersectObjects(blockers, false),
      ...raycaster.intersectObjects(targets, false),
    ].sort((a, b) => a.distance - b.distance);
    raycaster.far = 220;

    if (hits.length) {
      explode(hits[0].point, p.radius, p.damage, p.owner);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      projectiles.splice(i, 1);
      continue;
    }

    p.mesh.position.add(step);
    p.mesh.lookAt(tmp.copy(p.mesh.position).add(p.vel));
    p.mesh.rotateX(Math.PI / 2);

    if (p.life <= 0 || p.mesh.position.y < 0) {
      explode(p.mesh.position, p.radius, p.damage, p.owner);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      projectiles.splice(i, 1);
    }
  }
}

function throwEquipment(def, isLethal) {
  camera.getWorldDirection(camDir);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size, def.size, def.size * 1.4),
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }),
  );
  mesh.castShadow = true;
  mesh.position.copy(camera.position).addScaledVector(camDir, 0.8);
  scene.add(mesh);

  throwables.push({
    def,
    isLethal,
    mesh,
    vel: camDir.clone().multiplyScalar(def.kind === "proximity" ? 9 : 17).add(new THREE.Vector3(0, 3, 0)),
    fuse: def.fuse ?? Infinity,
    armed: def.kind === "proximity" ? -def.arm : 0,
    resting: false,
    live: true,
  });

  sfx.throwSound();
}

function detonateC4() {
  let any = false;
  for (let i = throwables.length - 1; i >= 0; i--) {
    const t = throwables[i];
    if (t.def.kind !== "remote") continue;
    explode(t.mesh.position, t.def.radius, t.def.damage, player);
    removeThrowable(i);
    any = true;
  }
  if (!any) toast("NO C4 DEPLOYED");
}

function removeThrowable(i) {
  const t = throwables[i];
  scene.remove(t.mesh);
  t.mesh.geometry.dispose();
  t.mesh.material.dispose();
  throwables.splice(i, 1);
}

function updateThrowables(dt) {
  for (let i = throwables.length - 1; i >= 0; i--) {
    const t = throwables[i];
    const m = t.mesh;

    if (!t.resting) {
      t.vel.y -= GRAVITY * dt;
      m.position.addScaledVector(t.vel, dt);
      m.rotation.x += dt * 6;
      m.rotation.z += dt * 4;

      const floorY = t.def.size / 2;
      if (m.position.y <= floorY) {
        m.position.y = floorY;
        if (Math.abs(t.vel.y) < 2.2) {
          t.vel.set(0, 0, 0);
          t.resting = true;
        } else {
          t.vel.y *= -0.42;
          t.vel.x *= 0.6;
          t.vel.z *= 0.6;
        }
      }
      const lim = mapDef.half - 0.5;
      if (Math.abs(m.position.x) > lim) {
        m.position.x = THREE.MathUtils.clamp(m.position.x, -lim, lim);
        t.vel.x *= -0.5;
      }
      if (Math.abs(m.position.z) > lim) {
        m.position.z = THREE.MathUtils.clamp(m.position.z, -lim, lim);
        t.vel.z *= -0.5;
      }
    }

    if (t.def.kind === "fuse") {
      t.fuse -= dt;
      if (t.fuse <= 0) {
        if (t.isLethal) explode(m.position, t.def.radius, t.def.damage, player);
        else tacticalBurst(t.def, m.position);
        removeThrowable(i);
      }
    } else if (t.def.kind === "proximity" && t.resting) {
      t.armed += dt;
      if (t.armed > 0) {
        m.material.emissive?.setRGB(0.4, 0, 0);
        const near =
          [...zombies, ...bots].some(
            (e) => e.alive && e.group.position.distanceTo(m.position) < t.def.trigger,
          ) ||
          (state.mode === "dm" && player.alive && player.pos.distanceTo(m.position) < t.def.trigger);
        if (near) {
          explode(m.position, t.def.radius, t.def.damage, player);
          removeThrowable(i);
        }
      }
    }
  }
}

function tacticalBurst(def, pos) {
  sfx.flashbang(pos.distanceTo(player.pos));

  if (def.tactical === "smoke") {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 0.65, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xb8bcc0, transparent: true, opacity: 0.5 }),
    );
    cloud.position.copy(pos).setY(1.4);
    scene.add(cloud);
    smokes.push({ mesh: cloud, pos: cloud.position.clone(), radius: def.radius * 0.65, life: def.duration });
    return;
  }

  const affect = (entPos, apply) => {
    const d = entPos.distanceTo(pos);
    if (d > def.radius) return;
    if (!hasLineOfSight(pos, entPos, false)) return;
    apply(1 - d / def.radius);
  };

  if (player.alive) {
    affect(player.pos, (k) => {
      if (def.tactical === "blind") player.blind = Math.max(player.blind, def.blind * k);
      else player.slow = Math.max(player.slow, def.slow * k);
    });
  }
  for (const b of bots) {
    if (!b.alive) continue;
    affect(b.group.position, (k) => {
      if (def.tactical === "blind") b.blind = Math.max(b.blind ?? 0, def.blind * k);
      else b.slowT = Math.max(b.slowT ?? 0, def.slow * k);
    });
  }
  for (const z of zombies) {
    if (!z.alive) continue;
    affect(z.group.position, (k) => {
      z.stun = Math.max(z.stun ?? 0, (def.blind ?? def.slow) * k * 0.6);
    });
  }
}

function updateBlasts(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.t += dt;
    const k = Math.min(1, b.t / 0.45);
    b.shell.scale.setScalar(0.4 + k * b.radius);
    b.shell.material.opacity = 0.7 * (1 - k);
    b.light.intensity = 30 * (1 - k);
    if (k >= 1) {
      scene.remove(b.shell, b.light);
      b.shell.material.dispose();
      blasts.splice(i, 1);
    }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.life -= dt;
    s.mesh.material.opacity = 0.5 * Math.min(1, s.life / 1.5);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      smokes.splice(i, 1);
    }
  }
}

// ── zombies ──────────────────────────────────────────────────────
const SKINS = [0x4a6b46, 0x5c6b52, 0x3f5a4a, 0x63614a];

function spawnZombie() {
  const d = state.diff;
  const roll = Math.random();
  let kind = "walker";
  if (state.wave >= 4 && roll < 0.2) kind = "runner";
  else if (state.wave >= 6 && roll > 0.9) kind = "brute";

  const model = humanoid(
    SKINS[(Math.random() * SKINS.length) | 0],
    kind === "brute" ? 0x3a2d3a : 0x2f3742,
  );
  const scale = kind === "brute" ? 1.42 : kind === "runner" ? 0.92 : 1;
  model.group.scale.setScalar(scale);
  model.armL.rotation.x = -1.15;
  model.armR.rotation.x = -1.15;

  const radius = mapDef.half * 0.82;
  let x, z, tries = 0;
  do {
    const a = Math.random() * Math.PI * 2;
    const dd = radius * (0.75 + Math.random() * 0.25);
    x = Math.cos(a) * dd;
    z = Math.sin(a) * dd;
    tries++;
  } while (tries < 30 && Math.hypot(x - player.pos.x, z - player.pos.z) < 15);

  model.group.position.set(x, 0, z);
  scene.add(model.group);

  const waveScale = 1 + 0.13 * (state.wave - 1);
  const base =
    kind === "brute"
      ? { hp: 300, speed: 1.25, dmg: 26 }
      : kind === "runner"
        ? { hp: 60, speed: 3.4, dmg: 8 }
        : { hp: 100, speed: 1.75, dmg: 13 };

  const z0 = {
    type: "zombie",
    kind,
    model,
    group: model.group,
    alive: true,
    hp: base.hp * waveScale * d.health,
    speed: base.speed * (1 + 0.035 * (state.wave - 1)) * d.speed * (0.9 + Math.random() * 0.2),
    dmg: base.dmg * d.damage,
    radius: 0.45 * scale,
    phase: Math.random() * Math.PI * 2,
    attackCd: 0,
    flash: 0,
    dying: 0,
    stun: 0,
    growlCd: Math.random() * 6,
  };
  registerTarget(z0, model);
  zombies.push(z0);
}

const toT = new THREE.Vector3();
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
      z.model.skin.opacity = z.model.cloth.opacity = 1 - t;
      if (t >= 1) {
        unregisterTarget(z.model);
        scene.remove(g);
        g.traverse((o) => o.isMesh && o.geometry.dispose());
        zombies.splice(i, 1);
      }
      continue;
    }

    if (z.stun > 0) z.stun -= dt;
    const speed = z.speed * (z.stun > 0 ? 0.25 : 1);

    toT.set(player.pos.x - g.position.x, 0, player.pos.z - g.position.z);
    const dist = toT.length();
    toT.normalize();

    sep.set(0, 0, 0);
    for (const other of zombies) {
      if (other === z || !other.alive) continue;
      const dx = g.position.x - other.group.position.x;
      const dz = g.position.z - other.group.position.z;
      const need = z.radius + other.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < need * need && d2 > 0.0001) {
        const dd = Math.sqrt(d2);
        sep.x += (dx / dd) * (need - dd);
        sep.z += (dz / dd) * (need - dd);
      }
    }

    if (dist > 1.35 || !player.alive) {
      g.position.x += (toT.x * speed + sep.x * 5) * dt;
      g.position.z += (toT.z * speed + sep.z * 5) * dt;
    } else {
      g.position.x += sep.x * 4 * dt;
      g.position.z += sep.z * 4 * dt;
      z.attackCd -= dt;
      if (z.attackCd <= 0) {
        z.attackCd = 1.05;
        hurtPlayer(z.dmg, null);
      }
    }

    pushOut(g.position, z.radius);
    g.position.x = THREE.MathUtils.clamp(g.position.x, -mapDef.half + 1, mapDef.half - 1);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -mapDef.half + 1, mapDef.half - 1);
    g.rotation.y = Math.atan2(toT.x, toT.z);

    z.phase += dt * speed * 3.4;
    const swing = Math.sin(z.phase);
    z.model.legL.rotation.x = swing * 0.75;
    z.model.legR.rotation.x = -swing * 0.75;
    g.position.y = Math.abs(Math.sin(z.phase * 0.5)) * 0.05;
    g.rotation.z = Math.sin(z.phase * 0.5) * 0.06;

    if (z.flash > 0) {
      z.flash = Math.max(0, z.flash - dt * 5);
      z.model.skin.emissive.setRGB(z.flash * 0.9, 0, 0);
      z.model.cloth.emissive.setRGB(z.flash * 0.9, 0, 0);
    }

    z.growlCd -= dt;
    if (z.growlCd <= 0) {
      z.growlCd = 4 + Math.random() * 8;
      if (dist < 26) sfx.growl(dist);
    }
  }
}

// ── bots ─────────────────────────────────────────────────────────
const BOT_NAMES = ["VIPER", "HAWK", "GHOST", "RAVEN", "WOLF", "ECHO", "NOMAD"];
const BOT_COLORS = [0xb5453f, 0x3f6fb5, 0xb59a3f, 0x7a3fb5, 0x3fb583, 0xb5643f, 0x5b5b5b];
const BOT_GUN = { damage: 15, range: 48, tone: 520, volume: 0.4 };

function spawnPoint(awayFrom) {
  const spots = mapDef.spawns ?? [mapDef.playerStart ?? [0, 0]];
  let best = spots[0];
  let bestD = -1;
  for (const sp of spots) {
    const d = awayFrom ? Math.hypot(sp[0] - awayFrom.x, sp[1] - awayFrom.z) : Math.random();
    if (d > bestD && Math.random() > 0.35) {
      bestD = d;
      best = sp;
    }
  }
  return best;
}

function createBot(i) {
  const color = BOT_COLORS[i % BOT_COLORS.length];
  const model = humanoid(0xc7a887, color);
  model.armL.rotation.x = -1.3;
  model.armR.rotation.x = -1.3;
  const rifle = part(0.08, 0.1, 0.62, 0.28, 1.28, -0.5, MATS.metal);
  rifle.castShadow = true;
  model.group.add(rifle);
  scene.add(model.group);

  const [x, z] = mapDef.spawns[i % mapDef.spawns.length];
  model.group.position.set(x, 0, z);

  const bot = {
    type: "bot",
    name: BOT_NAMES[i % BOT_NAMES.length],
    color,
    model,
    group: model.group,
    alive: true,
    hp: 100,
    dying: 0,
    respawn: 0,
    score: 0,
    flash: 0,
    blind: 0,
    slowT: 0,
    fireCd: 1 + Math.random(),
    losCd: 0,
    hasLos: false,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 1 + Math.random() * 2,
    phase: Math.random() * 6,
    radius: 0.45,
  };
  registerTarget(bot, model);
  bots.push(bot);
}

const eyeA = new THREE.Vector3();
const eyeB = new THREE.Vector3();
const dirV = new THREE.Vector3();
const segTmp = new THREE.Vector3();

/** Distance from a point to a segment — used to test smoke against sightlines. */
function pointToSegment(p, a, b) {
  segTmp.subVectors(b, a);
  const len2 = segTmp.lengthSq();
  if (len2 < 0.0001) return p.distanceTo(a);
  let t = ((p.x - a.x) * segTmp.x + (p.y - a.y) * segTmp.y + (p.z - a.z) * segTmp.z) / len2;
  t = THREE.MathUtils.clamp(t, 0, 1);
  return p.distanceTo(tmp.copy(a).addScaledVector(segTmp, t));
}

function hasLineOfSight(fromPos, toPos, checkSmoke = true) {
  eyeA.set(fromPos.x, 1.5, fromPos.z);
  eyeB.set(toPos.x, 1.5, toPos.z);
  if (checkSmoke) {
    for (const s of smokes) if (pointToSegment(s.pos, eyeA, eyeB) < s.radius) return false;
  }
  dirV.subVectors(eyeB, eyeA);
  const dist = dirV.length();
  dirV.normalize();
  raycaster.set(eyeA, dirV);
  const hits = raycaster.intersectObjects(blockers, false);
  return !hits.length || hits[0].distance > dist - 0.5;
}

function updateBots(dt) {
  const d = state.diff;

  for (const bot of bots) {
    const g = bot.group;

    if (!bot.alive) {
      if (bot.dying > 0) {
        bot.dying += dt;
        const t = Math.min(1, bot.dying / 1.0);
        g.rotation.x = -t * Math.PI * 0.5;
        bot.model.skin.opacity = bot.model.cloth.opacity = 1 - t * 0.85;
        if (t >= 1) {
          bot.dying = 0;
          g.visible = false;
        }
      }
      bot.respawn -= dt;
      if (bot.respawn <= 0) {
        const [sx, sz] = spawnPoint(player.pos);
        g.position.set(sx, 0, sz);
        g.rotation.set(0, 0, 0);
        g.visible = true;
        bot.model.skin.opacity = bot.model.cloth.opacity = 1;
        bot.alive = true;
        bot.hp = 100;
        bot.blind = 0;
        bot.slowT = 0;
        bot.fireCd = 0.8;
        registerTarget(bot, bot.model);
      }
      continue;
    }

    if (bot.blind > 0) bot.blind -= dt;
    if (bot.slowT > 0) bot.slowT -= dt;

    let target = null;
    let bestD = Infinity;
    if (player.alive) {
      const pd = g.position.distanceTo(player.pos);
      target = { pos: player.pos, ent: player, d: pd };
      bestD = pd;
    }
    for (const other of bots) {
      if (other === bot || !other.alive) continue;
      const od = g.position.distanceTo(other.group.position);
      if (od < bestD) {
        bestD = od;
        target = { pos: other.group.position, ent: other, d: od };
      }
    }
    if (!target) continue;

    bot.losCd -= dt;
    if (bot.losCd <= 0) {
      bot.losCd = 0.18;
      bot.hasLos = hasLineOfSight(g.position, target.pos);
    }

    dirV.set(target.pos.x - g.position.x, 0, target.pos.z - g.position.z).normalize();
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) {
      bot.strafeT = 1 + Math.random() * 2.2;
      bot.strafe *= -1;
    }

    const slowK = bot.slowT > 0 ? 0.4 : 1;
    const speed = (bestD > 16 ? 5.4 : 3.6) * slowK;
    if (bestD > 11 || !bot.hasLos) {
      g.position.x += dirV.x * speed * dt;
      g.position.z += dirV.z * speed * dt;
    } else if (bestD < 7) {
      g.position.x -= dirV.x * 3 * slowK * dt;
      g.position.z -= dirV.z * 3 * slowK * dt;
    }
    g.position.x += -dirV.z * bot.strafe * 3.4 * slowK * dt;
    g.position.z += dirV.x * bot.strafe * 3.4 * slowK * dt;

    pushOut(g.position, bot.radius);
    g.position.x = THREE.MathUtils.clamp(g.position.x, -mapDef.half + 1, mapDef.half - 1);
    g.position.z = THREE.MathUtils.clamp(g.position.z, -mapDef.half + 1, mapDef.half - 1);
    g.rotation.y = Math.atan2(dirV.x, dirV.z);

    bot.phase += dt * 7 * slowK;
    bot.model.legL.rotation.x = Math.sin(bot.phase) * 0.6;
    bot.model.legR.rotation.x = -Math.sin(bot.phase) * 0.6;

    if (bot.flash > 0) {
      bot.flash = Math.max(0, bot.flash - dt * 5);
      bot.model.skin.emissive.setRGB(bot.flash * 0.9, 0, 0);
      bot.model.cloth.emissive.setRGB(bot.flash * 0.9, 0, 0);
    }

    bot.fireCd -= dt;
    if (bot.blind <= 0 && bot.hasLos && bestD < BOT_GUN.range && bot.fireCd <= 0) {
      bot.fireCd = d.botReaction * (0.65 + Math.random() * 0.7) * (bot.slowT > 0 ? 1.8 : 1);
      shootFromBot(bot, target, bestD, d);
    }
  }
}

function shootFromBot(bot, target, dist, d) {
  const from = new THREE.Vector3(bot.group.position.x, 1.45, bot.group.position.z);
  const to = new THREE.Vector3(target.pos.x, 1.45, target.pos.z);

  let chance = d.botAccuracy * THREE.MathUtils.clamp(1.25 - dist / BOT_GUN.range, 0.25, 1);
  // a suppressed player is harder to pin down
  if (target.ent === player) chance *= 1 - (weapon()?.stealth ?? 0);

  sfx.shot(BOT_GUN, dist);

  if (Math.random() < chance) {
    fx.tracer(from, to, 0xff9c6a);
    if (target.ent === player) hurtPlayer(BOT_GUN.damage, bot);
    else {
      target.ent.hp -= BOT_GUN.damage;
      target.ent.flash = 1;
      fx.burst(to, dirV, 5);
      if (target.ent.hp <= 0) kill(target.ent, bot);
    }
  } else {
    to.add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        (Math.random() - 0.5) * 2.2,
        (Math.random() - 0.5) * 3.5,
      ),
    );
    fx.tracer(from, to, 0xff9c6a);
  }
}

// ── physics ──────────────────────────────────────────────────────
function pushOut(pos, radius) {
  for (const o of obstacles) {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;

    if (o.round) {
      const min = o.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.0001) {
        const dd = Math.sqrt(d2);
        pos.x = o.x + (dx / dd) * min;
        pos.z = o.z + (dz / dd) * min;
      }
      continue;
    }

    // into the box's own frame
    const lx = dx * o.cos - dz * o.sin;
    const lz = dx * o.sin + dz * o.cos;
    const ex = o.hw + radius;
    const ez = o.hd + radius;
    if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;

    // eject along whichever face is nearest — the shortest way out
    let nx = lx;
    let nz = lz;
    if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = (lx < 0 ? -1 : 1) * ex;
    else nz = (lz < 0 ? -1 : 1) * ez;

    pos.x = o.x + nx * o.cos + nz * o.sin;
    pos.z = o.z - nx * o.sin + nz * o.cos;
  }
}

const forward = new THREE.Vector3();
const rightV = new THREE.Vector3();
const wish = new THREE.Vector3();

function movePlayer(dt) {
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  rightV.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (keys.has("KeyW")) wish.add(forward);
  if (keys.has("KeyS")) wish.sub(forward);
  if (keys.has("KeyD")) wish.add(rightV);
  if (keys.has("KeyA")) wish.sub(rightV);

  const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && !gun.aiming;
  let speed = (sprinting ? SPRINT : WALK) * (gun.aiming ? 0.55 : 1);
  if (player.slow > 0) speed *= 0.45;
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

  player.vel.lerp(wish, Math.min(1, dt * 14));
  player.pos.addScaledVector(player.vel, dt);

  player.vy -= GRAVITY * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vy = 0;
    player.grounded = true;
  }

  const limit = mapDef.half - 0.8;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -limit, limit);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -limit, limit);
  pushOut(player.pos, PLAYER_R);

  player.bob += dt * player.vel.length() * 1.5;
  const bob = player.grounded ? Math.sin(player.bob) * 0.035 : 0;
  camera.position.set(player.pos.x, player.pos.y + EYE + bob, player.pos.z);
}

function hurtPlayer(amount, source) {
  if (!player.alive || state.phase !== "playing") return;
  player.hp -= amount;
  player.lastHit = state.time;
  sfx.hurt();
  ui.vignette.style.opacity = "0.85";
  setTimeout(() => (ui.vignette.style.opacity = "0"), 130);

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    if (state.mode === "zombies") endMatch(false);
    else {
      player.respawn = DM_RESPAWN;
      if (source) source.score++;
      feed(source?.name ?? "???", player.name);
      ui.respawning.classList.remove("hidden");
      sfx.death();
      checkMatchEnd();
    }
  }
  writeHud();
}

function respawnPlayer() {
  const [x, z] = spawnPoint(null);
  player.pos.set(x, 0, z);
  pushOut(player.pos, PLAYER_R);
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.hp = 100;
  player.alive = true;
  player.blind = 0;
  player.slow = 0;
  player.lastHit = state.time;
  refillAll();
  ui.respawning.classList.add("hidden");
  writeHud();
}

// ── hud ──────────────────────────────────────────────────────────
let hudAcc = 0;
const feedRows = [];

function feed(killer, victim) {
  feedRows.push({ killer, victim, t: 5 });
  if (feedRows.length > 5) feedRows.shift();
}

function renderLoadoutBar() {
  ui.loadoutBar.innerHTML = slots
    .map((s, i) => `<div class="slot ${i === cur ? "active" : ""}">${i + 1} ${s.w.name}</div>`)
    .join("");
}

function writeHud() {
  const s = slots[cur];
  ui.healthBar.style.width = `${Math.max(0, player.hp)}%`;
  ui.healthBar.classList.toggle("low", player.hp <= 35);
  ui.healthText.textContent = Math.max(0, Math.round(player.hp));

  if (s) {
    ui.weaponName.textContent = s.w.name;
    ui.mag.textContent = s.mag;
    ui.mag.classList.toggle("empty", s.mag === 0);
    ui.reserve.textContent = `/ ${s.reserve}`;
  }
  ui.reloading.classList.toggle("hidden", gun.reloadT <= 0);
  ui.equipLine.innerHTML =
    `G <b>${equip.lethalLeft}</b> ${equip.lethal?.name ?? ""} · ` +
    `Q <b>${equip.tacticalLeft}</b> ${equip.tactical?.name ?? ""}`;

  if (state.mode === "zombies") {
    const left = zombies.filter((z) => z.alive).length + state.toSpawn;
    ui.top.innerHTML =
      `<span>WAVE <b>${state.wave}</b></span><span><b>${player.kills}</b> KILLS</span>` +
      `<span><b>${left}</b> LEFT</span><span>${state.diff.label}</span>`;
  } else {
    ui.top.innerHTML =
      `<span>FIRST TO <b>${DM_SCORE_LIMIT}</b></span><span>YOUR SCORE <b>${player.score}</b></span>`;
    const rows = [
      { name: "YOU", score: player.score, color: 0x7fd1b9, you: true },
      ...bots.map((b) => ({ name: b.name, score: b.score, color: b.color })),
    ].sort((a, b) => b.score - a.score);
    ui.scoreboard.innerHTML = rows
      .map(
        (r) => `<div class="score-row ${r.you ? "you" : ""}">
            <span><i class="dot" style="background:#${r.color.toString(16).padStart(6, "0")}"></i>${r.name}</span>
            <span>${r.score}</span></div>`,
      )
      .join("");
  }

  ui.killfeed.innerHTML = feedRows
    .map((r) => `<div class="feed-row"><b>${r.killer}</b> → <i>${r.victim}</i></div>`)
    .join("");
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

// ── match flow ───────────────────────────────────────────────────
let lastConfig = null;

function startWave(n) {
  state.wave = n;
  state.toSpawn = Math.round((5 + n * 3) * state.diff.count);
  state.spawnTimer = 0;
  banner(`WAVE ${n}`);
}

function clearEntities() {
  for (const z of zombies) {
    unregisterTarget(z.model);
    scene.remove(z.group);
    z.group.traverse((o) => o.isMesh && o.geometry.dispose());
  }
  zombies.length = 0;
  for (const b of bots) {
    unregisterTarget(b.model);
    scene.remove(b.group);
    b.group.traverse((o) => o.isMesh && o.geometry.dispose());
  }
  bots.length = 0;
  targets.length = 0;
  feedRows.length = 0;
  while (throwables.length) removeThrowable(0);
  for (const p of projectiles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
  }
  projectiles.length = 0;
  for (const s of smokes) scene.remove(s.mesh);
  smokes.length = 0;
}

function startMatch(config) {
  console.log(
    `[outbreak] startMatch mode=${config.mode} map=${config.mapId} diff=${config.difficulty} ` +
      `weapons=${config.loadout.weapons.map((w) => w.id).join(",")}`,
  );
  lastConfig = config;
  state.mode = config.mode;
  state.diff = getDifficulty(config.difficulty);
  state.botCount = config.bots;
  state.time = 0;
  state.intermission = 0;

  clearEntities();
  fx.clear();
  buildMap(mapById(config.mapId));
  setLoadout(config.loadout);

  Object.assign(player, {
    hp: 100,
    alive: true,
    respawn: 0,
    lastHit: 0,
    score: 0,
    kills: 0,
    vy: 0,
    blind: 0,
    slow: 0,
  });
  player.vel.set(0, 0, 0);
  const [px, pz] = mapDef.playerStart ?? [0, 0];
  player.pos.set(px, 0, pz);
  pushOut(player.pos, PLAYER_R); // never start the match inside a prop
  camera.position.set(player.pos.x, EYE, player.pos.z);

  Object.assign(gun, { cooldown: 0, reloadT: 0, held: false, queued: 0, aiming: false });

  ui.respawning.classList.add("hidden");
  ui.result.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.flash.style.opacity = "0";
  ui.hud.classList.remove("hidden");
  ui.scoreboard.classList.toggle("hidden", state.mode !== "dm");

  if (state.mode === "zombies") startWave(1);
  else {
    state.toSpawn = 0;
    for (let i = 0; i < state.botCount; i++) createBot(i);
    banner("DEATHMATCH", 2200);
    toast(`FIRST TO ${DM_SCORE_LIMIT} KILLS`);
  }

  writeHud();
  state.phase = "playing";
  clock.getDelta();
  controls.lock();
  audio();
}

function checkMatchEnd() {
  if (state.mode !== "dm") return;
  const top = Math.max(player.score, ...bots.map((b) => b.score));
  if (top >= DM_SCORE_LIMIT) endMatch(player.score >= DM_SCORE_LIMIT);
}

function endMatch(won) {
  state.phase = "over";
  controls.unlock();
  ui.respawning.classList.add("hidden");
  stats.bump(player.kills, state.mode === "zombies" ? state.wave : 0);

  if (state.mode === "zombies") {
    ui.resultTitle.textContent = "YOU DIED";
    ui.resultTitle.className = "small red";
    ui.resultSub.textContent = `${state.diff.label} · ${mapDef.name}`;
    ui.resultBody.innerHTML =
      `<div>Reached wave <b class="win">${state.wave}</b></div>` +
      `<div><b class="win">${player.kills}</b> zombies killed</div>`;
    sfx.death();
  } else {
    ui.resultTitle.textContent = won ? "VICTORY" : "DEFEATED";
    ui.resultTitle.className = won ? "small" : "small red";
    ui.resultSub.textContent = `${mapDef.name} · ${state.diff.label} bots`;
    const rows = [
      { name: "YOU", score: player.score },
      ...bots.map((b) => ({ name: b.name, score: b.score })),
    ].sort((a, b) => b.score - a.score);
    ui.resultBody.innerHTML = rows
      .map(
        (r, i) =>
          `<div>${i + 1}. <b class="${r.name === "YOU" ? "win" : ""}">${r.name}</b> — ${r.score}</div>`,
      )
      .join("");
    won ? sfx.win() : sfx.death();
  }
  ui.result.classList.remove("hidden");
}

function quitToLobby() {
  state.phase = "menu";
  controls.unlock();
  clearEntities();
  clearMap();
  ui.hud.classList.add("hidden");
  ui.pause.classList.add("hidden");
  ui.result.classList.add("hidden");
  lobby.open();
}

// ── loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.phase === "menu") {
    lobbyGuy.group.rotation.y += dt * 0.35;
    renderer.render(lobbyScene, lobbyCam);
    return;
  }

  if (state.phase === "playing") {
    state.time += dt;

    if (player.alive) movePlayer(dt);
    else if (state.mode === "dm") {
      player.respawn -= dt;
      ui.respawnIn.textContent = Math.max(1, Math.ceil(player.respawn));
      if (player.respawn <= 0) respawnPlayer();
    }

    if (state.mode === "zombies") {
      updateZombies(dt);
      if (state.toSpawn > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && zombies.length < 30) {
          state.spawnTimer = Math.max(0.2, 0.85 - state.wave * 0.04) * state.diff.spawnRate;
          spawnZombie();
          state.toSpawn--;
        }
      } else if (zombies.every((z) => !z.alive)) {
        if (state.intermission <= 0) {
          state.intermission = 4;
          sfx.waveClear();
          banner(`WAVE ${state.wave} CLEARED`, 2600);
          player.hp = Math.min(100, player.hp + 25);
          for (const s of slots)
            s.reserve = Math.min(s.w.reserve, s.reserve + Math.ceil(s.w.mag * 1.2));
          refillEquipment();
          toast("+25 HP · AMMO & EQUIPMENT RESUPPLIED");
        } else {
          state.intermission -= dt;
          if (state.intermission <= 0) startWave(state.wave + 1);
        }
      }
    } else updateBots(dt);

    updateThrowables(dt);
    updateProjectiles(dt);
    updateBlasts(dt);

    // weapon timers
    gun.cooldown = Math.max(0, gun.cooldown - dt);
    if (gun.reloadT > 0) {
      gun.reloadT -= dt;
      if (gun.reloadT <= 0) {
        gun.reloadT = 0;
        finishReload();
      }
    }

    // banked clicks first, so a tap between frames is never swallowed
    const w = weapon();
    if (player.alive && w) {
      while (gun.queued > 0 && gun.cooldown <= 0 && gun.reloadT <= 0) {
        gun.queued--;
        fire();
      }
      if (gun.held && w.auto && gun.cooldown <= 0 && gun.reloadT <= 0) fire();
    }
    gun.queued = Math.min(gun.queued, 2);

    if (player.alive && state.time - player.lastHit > 5 && player.hp < 100) {
      player.hp = Math.min(100, player.hp + 7 * dt);
    }

    // status effects
    if (player.blind > 0) {
      player.blind -= dt;
      ui.flash.style.opacity = String(Math.min(1, player.blind / 1.4) * 0.95);
    } else ui.flash.style.opacity = "0";
    if (player.slow > 0) player.slow -= dt;

    // aim-down-sights zoom
    const targetFov = gun.aiming && w ? w.zoomFov : BASE_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12 * (w?.adsSpeed ?? 1));
      camera.updateProjectionMatrix();
    }

    for (let i = feedRows.length - 1; i >= 0; i--) {
      feedRows[i].t -= dt;
      if (feedRows[i].t <= 0) feedRows.splice(i, 1);
    }

    hudAcc += dt;
    if (hudAcc > 0.08) {
      hudAcc = 0;
      writeHud();
    }
  }

  gun.recoil = Math.max(0, gun.recoil - dt * 3.4);
  const vm = viewmodels[cur];
  if (vm) {
    const dip = gun.reloadT > 0 ? 0.16 : 0;
    const ads = gun.aiming ? 1 : 0;
    vm.position.set(
      0.26 - ads * 0.26,
      -0.24 - dip - ads * 0.02 + Math.sin(player.bob) * 0.008,
      -0.5 + gun.recoil * 0.9 + ads * 0.08,
    );
    vm.rotation.set(gun.recoil * 3.2, gun.reloadT > 0 ? 0.45 : 0, 0);
  }
  muzzleLight.intensity *= 0.72;

  fx.update(dt);
  for (let i = 0; i < fires.length; i++)
    fires[i].intensity = 2.1 + Math.sin(state.time * 9 + i * 2.1) * 0.5 + Math.random() * 0.3;

  renderer.render(scene, camera);
}

/*
 * An exception inside the animation callback stops the loop dead, and the
 * last rendered frame just sits there — which is what a "black screen" is.
 * Report the first one and keep the loop alive.
 */
let loopFailed = false;
renderer.setAnimationLoop(() => {
  try {
    animate();
  } catch (err) {
    if (!loopFailed) {
      loopFailed = true;
      fatal("render loop", err);
    }
  }
});

// ── input ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (state.phase !== "playing" || !player.alive) return;
  if (e.code === "KeyR") startReload();
  if (e.code === "Digit1") switchTo(0);
  if (e.code === "Digit2") switchTo(1);
  if (e.code === "Digit3") switchTo(2);
  if (e.code === "KeyG" && equip.lethalLeft > 0) {
    equip.lethalLeft--;
    throwEquipment(equip.lethal, true);
    writeHud();
  }
  if (e.code === "KeyQ" && equip.tacticalLeft > 0) {
    equip.tacticalLeft--;
    throwEquipment(equip.tactical, false);
    writeHud();
  }
  if (e.code === "KeyV") detonateC4();
  if (e.code === "Space" && player.grounded) {
    player.vy = JUMP;
    player.grounded = false;
  }
});

addEventListener("keyup", (e) => keys.delete(e.code));

/*
 * Pointer events rather than mouse events: they fire for mouse, pen and
 * trackpad alike, and they arrive even when a key is already held down.
 */
addEventListener("pointerdown", (e) => {
  if (state.phase !== "playing" || !player.alive) return;
  if (e.button === 0) {
    gun.held = true;
    gun.queued++; // bank it now; the loop can never miss the click
  }
  if (e.button === 2) {
    gun.aiming = true;
    ui.crosshair.classList.add("ads");
  }
});

addEventListener("pointerup", (e) => {
  if (e.button === 0) gun.held = false;
  if (e.button === 2) {
    gun.aiming = false;
    ui.crosshair.classList.remove("ads");
  }
});

// Releasing outside the window used to leave the trigger stuck down.
addEventListener("blur", () => {
  gun.held = false;
  gun.aiming = false;
  keys.clear();
});

addEventListener("contextmenu", (e) => e.preventDefault());

controls.addEventListener("unlock", () => {
  if (state.phase !== "playing") return;
  state.phase = "paused";
  keys.clear();
  gun.held = false;
  gun.queued = 0;
  gun.aiming = false;
  ui.crosshair.classList.remove("ads");
  ui.pause.classList.remove("hidden");
});

$("resume-btn").addEventListener("click", () => {
  ui.pause.classList.add("hidden");
  state.phase = "playing";
  clock.getDelta();
  controls.lock();
});

$("change-loadout-btn").addEventListener("click", () => {
  ui.pause.classList.add("hidden");
  lobby.open({ inGame: true });
});

$("quit-btn").addEventListener("click", quitToLobby);
$("menu-btn").addEventListener("click", quitToLobby);
$("again-btn").addEventListener("click", () => lastConfig && startMatch(lastConfig));

// ── boot ─────────────────────────────────────────────────────────
const lobby = createLobby({
  onStart: startMatch,
  onApply(loadout) {
    setLoadout(loadout, true);
    toast("LOADOUT UPDATED");
    state.phase = "playing";
    clock.getDelta();
    controls.lock();
    writeHud();
  },
});

lobby.open();
