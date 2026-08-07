---
project_name: 'Zombie Attack'
user_name: 'Ibrahim Mohammed'
date: '2026-08-07'
sections_completed: ['technology_stack', 'critical_rules']
existing_patterns_found: 14
---

# Project Context for AI Agents

_Critical rules and patterns for anyone — human or model — writing code here.
Deliberately restricted to the unobvious: things that have already caused real
bugs in this codebase, not general JavaScript advice._

---

## Technology Stack & Versions

- **Vite 8.2** — `dev`, `build`, `preview`. `vite.config.js` sets
  `allowedHosts: true` and proxies `/api` to `localhost:8787`, so one tunnel
  serves the game and the API from the same origin.
- **Three.js 0.185** — WebGL, `PointerLockControls`, `BufferGeometryUtils`.
- **No framework, no bundled dependencies beyond Three.** No React, no state
  library, no test runner.
- **Node ≥ 20** for the server, which uses only `node:http`, `node:crypto` and
  global `fetch` — deliberately dependency-free.
- **Layout**: `src/main.js` is ~4,800 lines and holds the engine, gameplay and
  most UI. `skins.js`, `mp.js`, `party.js`, `account.js` are data and
  persistence modules. `server/server.js` is the account and payment server.

## Critical Implementation Rules

### Load order — the mistake this codebase keeps making

`main.js` runs several functions at module level (`syncHud`, `renderPanel`,
`renderLoadout`, `applySkin`, `renderCodeBox`, `renderAccount`). **Anything
those functions touch must be declared above them in the file.**

Three separate features were silently destroyed by breaking this: `kit`,
`mpClasses` and `EQUIP_LETHAL` were each declared near the bottom while
`syncHud` read them during startup. A `const` in its temporal dead zone throws,
**module evaluation stops there**, and every declaration after that point never
happens. Hoisted `function` declarations still exist, so menus keep responding
while the state behind them is missing — the symptom looks like a broken
feature, never like a startup crash.

- New shared state goes **near the top**, with the other game state.
- Never append state to the end of the file "next to the code that uses it".
- Guard cross-module reads that might run early: `mpClasses?.[mpIndex]`.

### Rendering budget

- **Map geometry is merged** at load: every prop sharing a colour becomes one
  mesh via `mergeGeometries`. A city of ~2,000 pieces draws in about a dozen
  calls. Bullets still raycast against the merged meshes.
- **Three shared geometries** (`UNIT_BOX`, `UNIT_CYL`, `UNIT_CONE`) are scaled
  per instance. `clearMap()` must **never** dispose them — check `SHARED_GEO`
  first or the whole game goes blank.
- **HUD writes are throttled to ~8 Hz** (`hudAcc`). Rebuilding `innerHTML`
  every frame — which the scoreboard and bonus bar used to do — costs more than
  the 3D scene.
- Zombies are ~30 meshes each; the concurrent cap is 16 for that reason.
  Only the torso casts a shadow.

### Collision

- Obstacles are **oriented boxes with a top and a bottom**, never circles. A
  circle sized to a long wall becomes an enormous invisible cylinder — this
  produced the "trapped in an invisible box" bug.
- `top <= feetY + STEP` means you stand on it; `bottom >= feetY + height` means
  you walk under it. Both are needed for doorways, roofs and upper floors.
- Everything is bucketed into a 5-unit grid (`buildGrid`, `near`). Never
  iterate `obstacles` directly in a per-frame path.
- **Path probes must step less than twice the probe radius** (`PROBE_STEP`
  1.2). A coarser step walked straight through 0.6-thick house walls, and the
  zombies looked stupid because their avoidance never triggered.

### Input

- **Desktop and touch are separate paths.** `pointerdown` handlers must ignore
  `pointerType === "touch"` and bail when `touchMode` — otherwise every tap on
  a tablet fires the weapon.
- On touch there is no pointer lock: the camera is driven by `yaw`/`pitch`
  directly, and `controls.lock()` must not be called.
- **The trigger is a held flag, so it can stick.** It is released by pointerup,
  pointercancel, blur, tab hidden, pointer-lock exit, and a mouse-move with no
  buttons down. Add to that list rather than trusting one event.
- Clicks are **banked at pointerdown** (`game.queued`), because a tap that
  starts and ends between two frames would otherwise be dropped.

### Game rules that are easy to get wrong

- The knife's damage is derived at impact (`z.maxHp / game.wave`) so wave N
  always takes N hits. Do not give it a fixed damage number.
- **Equipment is multiplayer-only** and has no defaults: if the class has not
  chosen a lethal or tactical, the player carries none.
- Skin powers never apply in multiplayer.
- Points: 10 a hit, 60 a kill, 130 for a knife kill, doubled by the drop.

### Money and trust

The server treats coins and free skins from the client as advisory, and
**ignores entitlements entirely**. The only code path that may grant a paid
item is the Stripe webhook, after Stripe confirms payment. Never add an
endpoint that lets the browser assert ownership.

### Honesty in the UI

Where something is not built — real-player multiplayer, real-money purchases,
cross-device accounts — the interface says so plainly instead of simulating it.
Keep that. A button that pretends is worse than a button that explains.
