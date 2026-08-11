# Epics and stories

Ordered so that each epic is shippable on its own and nothing later is blocked
by something earlier being half-done.

Estimates are in days for one developer. `S` ≈ 1, `M` ≈ 2–3, `L` ≈ 5.

---

## E1 — The shell: a Next.js app that serves the game

**Why first:** everything else needs somewhere to live, and this is the only
epic that risks breaking what already works.

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 1.1 | Next.js 16 app in `web/`, App Router, TypeScript | M | `next dev` serves a page |
| 1.2 | The game builds into `web/public/game/` and runs in an iframe on `/play` | M | The game plays at `/play` exactly as it does today |
| 1.3 | Design tokens from DESIGN.md as CSS variables; dark and light | S | Both themes render, contrast checked |
| 1.4 | Header, footer, nav shell, 404 | S | Every route has the same frame |
| 1.5 | Deploy to Vercel from `main` | S | A public URL that updates on push |

**Risk:** the game is a Vite build and assumes it owns the page. It goes in an
iframe rather than being ported — porting a working 6,000-line game to React to
satisfy a checkbox is how you break a working game.

---

## E2 — Accounts

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 2.1 | Supabase project, `profiles` table, RLS on | M | A row cannot be read by another user, proven by a test |
| 2.2 | Sign up with email and password, with confirmation | M | A new account exists and is confirmed |
| 2.3 | Sign in, sign out, session persisted across reloads | S | Refresh keeps you signed in |
| 2.4 | Forgot password: request, email, reset form | M | End to end on a real address |
| 2.5 | Middleware: `/home`, `/account` require a session | S | Signed out visits redirect to sign in and come back after |
| 2.6 | Merge anonymous local progress into the account on first sign in | M | Neither side is lost; the higher of each is kept |

**Guarded rule:** 2.6 merges *coins and owned cosmetics earned in play*. It
never merges entitlements. See E4.

---

## E3 — The pages

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 3.1 | Landing: the game running, one primary action, what it is, no signup wall | M | A signed-out visitor can play from it |
| 3.2 | Home: continue, coins, equipped skin, last run, daily reward | M | First paint shows real numbers |
| 3.3 | Account: email, display name, change password, delete account | M | Deletion actually deletes, and says what it removes |
| 3.4 | Settings: language, theme, reduced motion, notification opt-in | S | Choices survive a reload |
| 3.5 | Security: active sessions, sign out everywhere, last sign-in | M | Signing out everywhere invalidates other devices |
| 3.6 | Support: FAQs, and a contact form that sends real email | M | A submitted form arrives in the inbox with a reference |
| 3.7 | Arabic and English throughout, with RTL | L | Every page reads correctly in both |

---

## E4 — Money

**Nothing here starts until a registered entity exists.** That is a founder
task and no amount of code substitutes for it.

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 4.1 | `entitlements` table, server-only writes | M | A client write is rejected, proven by a test |
| 4.2 | Payment provider checkout for Special and OP skins and token packs | L | A test-mode purchase completes |
| 4.3 | Verified webhook is the only thing that grants an entitlement | M | A forged callback is rejected |
| 4.4 | Receipts, purchase history, refund route | M | A buyer can see what they bought and when |
| 4.5 | Restore purchases on a new device | S | Signing in elsewhere returns everything owned |

**The invariant, restated because it is the expensive one:** the client may
never assert ownership of a paid item. The save endpoint already discards
entitlements entirely. Only 4.3 grants them.

---

## E5 — Knowing whether any of it works

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 5.1 | Server-side events: landed, started a run, run ended, signed up, purchased | M | A funnel can be read without a third-party pixel |
| 5.2 | A dashboard showing that funnel | M | One page answers "is this working" |
| 5.3 | Error reporting from the game to the server | S | A crash on a device we do not own is visible to us |

---

## E6 — Getting in front of people

| | Story | Size | Done when |
| --- | --- | --- | --- |
| 6.1 | Portal build: relative paths, no external calls, size budget | S | A zip a portal will accept |
| 6.2 | Submit to CrazyGames and Poki | S | Submitted, with whatever they ask for |
| 6.3 | Trailer and screenshots | M | Assets that meet portal specs |

---

## Order, and why

```
E1 ──► E2 ──► E3 ──► E5
        │              │
        └──► E4 ◄──────┘   (E4 also needs a registered entity)
                    E6 can run any time after E1
```

**E6 is the cheapest revenue line and needs nothing from E4.** If money is the
goal and time is short, do E1 and E6 and nothing else.
