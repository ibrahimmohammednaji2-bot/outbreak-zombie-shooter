---
title: 'Zombie Attack — Architecture'
status: final
created: '2026-08-07'
updated: '2026-08-07'
---

# Zombie Attack — Architecture

The spine: the invariants everything else is built from. Brownfield — this
describes the system as it stands, and marks the shape the planned work must
take.

## 1. Shape

A static site plus an optional server.

```
browser ──── GitHub Pages (static: HTML, JS, CSS)      [live]
   │
   └──────── /api  ──►  Node server (accounts, payments) [not deployed]
                              │
                              └──►  Stripe (webhook confirms payment)
```

The game is **playable with the server absent**. Everything it does — modes,
skins, classes, progression — works from the static bundle alone, with browser
storage. The server adds identity that follows you between devices, and paid
items. Nothing in the game may hard-depend on it.

## 2. Technology and why

| Choice | Reason |
| --- | --- |
| **Three.js** | WebGL without writing WebGL. The only runtime dependency. |
| **Vite** | Dev server, bundling, a `preview` that doubles as the host. |
| **No framework** | The UI is a dozen screens of generated markup. React would cost more than it saved. |
| **Node with no dependencies** | The server uses `node:http`, `node:crypto` and global `fetch`. Nothing to audit, nothing to update. |
| **JSON file storage** | Adequate at this size. The seam to replace with Postgres is `load()` / `save()` in `server/server.js`. |
| **GitHub Pages** | Free, permanent, deploys on push. Static-only, which is why the server has no home yet. |

## 3. Module map

| File | Holds |
| --- | --- |
| `src/main.js` | Engine, gameplay, and most UI. ~4,800 lines. |
| `src/skins.js` | The 140 skins, their powers, the wallet, the redeem code. |
| `src/mp.js` | Class data: perks, attachments, wildcards, point budget. |
| `src/party.js` | Party codes and membership over shared browser storage. |
| `src/account.js` | Local profiles; the seam where server auth replaces them. |
| `server/server.js` | Accounts, progress, Stripe checkout and webhook. |

**`main.js` is too large.** It was not designed at that size; it grew. Splitting
it is worthwhile, but only along seams that already exist — world building,
entities, weapons, HUD — and only when a change is not in flight, because the
file is where every feature currently meets.

## 4. Invariants

These are the rules that hold the system together. Breaking one has already
caused a real outage in this project.

### 4.1 Declaration order

`main.js` calls functions at module level during startup. **Anything they read
must be declared above them.** A `const` read in its temporal dead zone throws,
module evaluation halts at that line, and every declaration below it silently
never happens — while hoisted functions still exist, so the UI keeps responding
over missing state. This destroyed three features before it was understood.

### 4.2 The client is never trusted

The browser may ask what it owns. It may never say what it owns. Coins and free
skins are advisory; **entitlements come only from a verified Stripe webhook.**
Any endpoint that lets the client assert ownership is a defect.

### 4.3 Shared GPU resources are never disposed by a caller

Three unit geometries are scaled per instance across every prop and every
zombie. `clearMap()` checks `SHARED_GEO` before disposing. Miss that and the
whole scene blanks.

### 4.4 Per-frame work is budgeted

Map geometry is merged by colour at load, so a 2,000-piece city draws in about
a dozen calls. HUD markup regenerates at 8 Hz, not 60. Obstacles are bucketed
into a 5-unit grid; nothing iterates all of them per frame.

### 4.5 Collision has three dimensions

Obstacles are oriented boxes with a **top and a bottom**. Top decides what you
stand on, bottom decides what you walk under. Circles cannot express a wall,
and path probes must step less than twice their radius or thin geometry is
invisible to them.

### 4.6 Input paths are separate

Desktop uses pointer events and pointer lock. Touch uses its own handlers and
drives the camera directly. **Each must ignore the other's events**, or a tap
fires the gun.

## 5. Deployment

- **Push to `main`** → GitHub Actions builds and publishes to Pages.
- `base` is conditional: `/outbreak-zombie-shooter/` for Pages, `/` elsewhere,
  so the same commit deploys correctly to Vercel or any root-served host.
- The server has **no deployment**. It runs locally on 8787 and is proxied
  under `/api` by the Vite config so one origin serves both.

## 6. What the planned work requires

**Real-player multiplayer (FR-17, FR-18)** needs a stateful server the static
host cannot provide — Railway, Render or Fly. The shape:

- WebSocket transport; clients send intent, never outcomes.
- The server owns positions, health and hit registration. A client claiming a
  kill is a client to distrust.
- 10–20 Hz state broadcast with client-side interpolation.
- The existing party code is the natural room identifier.

**Payments (FR-23)** need the server hosted first, because Stripe must reach the
webhook. Everything else is written and tested.

## 7. Known debt

| Debt | Cost | When |
| --- | --- | --- |
| `main.js` size | Every change risks unrelated breakage | Before the next large feature |
| No tests | Regressions are found by playing | When a rule stops being obvious |
| JSON storage | Fine now, will not survive concurrency | Before real accounts matter |
| No error tracking beyond an on-screen overlay | Failures on other people's devices are invisible | When strangers play it |
