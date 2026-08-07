---
title: 'Zombie Attack — Epics and Stories'
status: final
created: '2026-08-07'
updated: '2026-08-07'
---

# Zombie Attack — Epics and Stories

Derived from [prd.md](prd.md) and [architecture.md](architecture.md). Only the
unbuilt work is broken down; shipped capability is listed once for context and
not re-planned.

**Sequencing rule:** E1 unblocks E2 and E3. Nothing in E2 can start before E1
because Stripe must be able to reach a webhook, and real players need a
stateful host. E4 is independent and can run at any time.

---

## E0 — Shipped (context only)

Zombies mode, bot deathmatch, 20 weapons, mystery box and points, 140 skins
with powers, create-a-class, local profiles, parties, touch controls, and
GitHub Pages hosting. No stories; this is the baseline.

---

## E1 — Put the server somewhere real

**Why:** everything else is blocked on it. The server is written and tested but
runs only on the owner's laptop, which Stripe cannot reach and other players
cannot join.

**Done when:** the API answers at a public HTTPS address that stays up when the
owner's computer is off.

### E1.S1 — Choose and provision a host
Pick between Railway, Render and Fly on free tiers. Create the account, connect
the GitHub repository, deploy `server/server.js`.
**AC:** `GET /api/health` returns 200 from outside the owner's network.
**Blocked by:** account creation, which needs the owner.

### E1.S2 — Point the game at the deployed API
Replace the same-origin proxy assumption with a configured API base URL, so the
static site on Pages can reach the server on another domain.
**AC:** the game reads its API base from build config; CORS allows the Pages
origin; a signed-in profile loads from the server.

### E1.S3 — Move accounts from browser to server
Swap `src/account.js` local profiles for `/api/signup` and `/api/login`. Keep
guest play working with nothing saved.
**AC:** signing in on a second device shows the same coins and skins.
**AC:** with the server unreachable, the game still plays as a guest.

---

## E2 — Real-player free-for-all

**Why:** FR-17 and FR-18. The mode exists against bots; the missing half is the
network.

**Depends on:** E1.

### E2.S1 — Rooms over WebSocket
Add a WebSocket endpoint to the server. Reuse the five-digit party code as the
room key. Players join, are listed, and leave cleanly.
**AC:** two browsers on different networks see each other in one room.

### E2.S2 — Authoritative state
The server owns positions, health and score. Clients send intent — movement
input and fire events — never outcomes.
**AC:** a client that claims a kill it did not make is ignored.

### E2.S3 — Broadcast and interpolation
Broadcast state at 10–20 Hz; clients interpolate between snapshots so movement
looks smooth below frame rate.
**AC:** another player's movement is smooth at 15 Hz on a 60 fps client.

### E2.S4 — Spawns, scoring, match end
Server-side spawn selection away from opponents, kill attribution, and the
match ending at the limit for everyone at once.
**AC:** all clients end the match on the same tick with the same standings.

### E2.S5 — Retire the honest placeholder
Remove the "needs netcode and a hosted server" message once the mode works.
**AC:** REAL PLAYERS enters matchmaking; the message only appears if the server
is unreachable.

---

## E3 — Paid items, end to end

**Why:** FR-23. Server code exists; nothing has ever been charged.

**Depends on:** E1. **Also gated on:** the owner (or a guardian) being able to
hold a payment account — a legal requirement, not a technical one.

### E3.S1 — Stripe in test mode
Configure keys, run a full purchase with a test card, confirm the webhook
grants the entitlement and the duplicate guard holds.
**AC:** a test purchase unlocks the skin; replaying the webhook grants nothing.

### E3.S2 — Buy flow in the skins screen
Wire Special and OP cards to `/api/checkout`, handle return and cancellation.
**AC:** an owned paid skin equips; an unpaid one never can.

### E3.S3 — Go live
Swap to live keys once the account is verified.
**AC:** a real purchase reaches the bank account.

---

## E4 — Keep it fast and honest

**Why:** performance regressions have shipped repeatedly, and each was found by
the owner playing rather than by anything catching it.

### E4.S1 — A frame-time budget that is visible
Show frame time behind a debug flag; record it before and after each feature.
**AC:** a change that costs more than 2 ms is noticed before release.

### E4.S2 — Split `main.js`
Extract world building, entities and HUD along existing seams.
**AC:** no file over 1,500 lines; no behaviour change.
**Note:** do this between features, never during one.

### E4.S3 — Guard the declaration-order trap
Add a check that fails the build if module-level calls read state declared
below them.
**AC:** reintroducing the bug that killed three features fails CI.

### E4.S4 — Quality setting
Expose shadows, resolution scale and enemy cap so weak devices can trade
fidelity for frame rate instead of the owner guessing at hardware.
**AC:** a low setting holds 60 fps on integrated graphics.

---

## Readiness

| Epic | Ready to start | Blocker |
| --- | --- | --- |
| E1 | No | Host account — owner |
| E2 | No | E1 |
| E3 | No | E1, plus a payment account the owner can legally hold |
| E4 | **Yes** | None |

**E4 is the only epic that can start today.** Everything else waits on an
account only the owner can create.
