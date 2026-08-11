# Architecture

## The shape of it

```
                    ┌─────────────────────────────┐
  browser ─────────►│  Next.js 16 (App Router)    │
                    │  on Vercel                  │
                    │                             │
                    │  /            landing       │
                    │  /play        the game      │──► /public/game/  (Vite build,
                    │  /home        signed in     │      Three.js, in an iframe)
                    │  /account/*   profile       │
                    │  /support     FAQ + form    │
                    │  /api/*       route handlers│
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  Supabase                   │
                    │  Postgres + Auth + RLS      │
                    └─────────────────────────────┘
                               ▲
                    ┌──────────┴──────────────────┐
                    │  Payment provider webhook   │  the only thing that
                    │  (verified signature)       │  grants an entitlement
                    └─────────────────────────────┘
```

## Choices, and why

**Next.js 16, App Router, on Vercel.** Required by the brief, and it is the
right shape anyway: the landing page wants to be server-rendered for portals
and search, the account pages want a session on the server, and the API routes
want to live next to them.

**The game stays as it is, in an iframe.** This is the important decision. The
game is about six thousand lines of vanilla JavaScript and Three.js, built by
Vite, and it works. Porting it to React to satisfy "use a framework" would take
weeks and the only certain outcome is that a working thing stops working. The
framework requirement is about the *application* — auth, accounts, pages, data
— and that is genuinely Next.js. The game is a compiled asset it serves, the
way a video would be.

The iframe is same-origin, so the page and the game talk with `postMessage`:
the game reports a finished run, the page saves it.

**Supabase.** Postgres with row-level security and an auth system that already
does email confirmation and password recovery. The alternative is building
password resets by hand, which is a category of thing to buy rather than build.

**Vitest and Playwright** for the app; the game keeps its own Puppeteer smoke
test, which drives the real game in a real browser and is the reason several
regressions never shipped.

## Data

```sql
-- who someone is
profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  locale       text default 'en',
  created_at   timestamptz default now()
)

-- what they have earned by playing. The client may write this.
progress (
  user_id      uuid primary key references profiles on delete cascade,
  coins        int  not null default 0 check (coins >= 0),
  best_wave    int  not null default 0,
  owned_skins  text[] not null default '{}',   -- coin-bought only
  equipped     text,
  updated_at   timestamptz default now()
)

-- what they have paid for. The client may NOT write this.
entitlements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles on delete cascade,
  sku          text not null,          -- 'op-4', 'tokens-25'
  source       text not null,          -- 'purchase' | 'grant' | 'code'
  payment_ref  text,                   -- provider id, for reconciliation
  granted_at   timestamptz default now()
)

-- what they asked us for help with
support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles on delete set null,
  email        text not null,
  subject      text not null,
  body         text not null,
  reference    text not null unique,   -- what we show them
  created_at   timestamptz default now()
)
```

## The invariants

These are the things that must stay true. Everything else is negotiable.

1. **The client may never assert ownership of a paid item.** `PUT /api/save`
   sanitises coins and coin-bought skins and **discards any entitlements in the
   payload entirely**. Only a payment webhook with a verified signature writes
   to `entitlements`. This already holds and is covered by a test that sends
   forged entitlements and asserts the server stored none.

2. **Row-level security is on, and the policy is the default deny.** A user can
   read and write their own `progress` row and nothing else. `entitlements` is
   readable by its owner and writable only by the service role.

3. **Anonymous play never breaks.** Someone who never signs in keeps a fully
   working game against local storage. Accounts are an upgrade, not a gate.

4. **Merging progress never loses either side.** On first sign-in, local and
   remote are merged by taking the higher of each and the union of owned skins.
   Neither is overwritten.

5. **Secrets live on the server.** The Supabase service role key and the
   payment provider secret are server-only environment variables and never
   reach a bundle. The anon key is public by design and is safe only because
   invariant 2 holds.

6. **The game's own budgets hold.** No more than seven dynamic lights per map;
   no more than sixteen zombies standing; corpses trimmed at ten. These are not
   style preferences — the same three limits are what took the big maps from
   unplayable to smooth, and a test asserts the first one.

## Environments

| | |
| --- | --- |
| Local | `next dev`, Supabase local or a dev project |
| Preview | Every Vercel preview deploy, against the dev Supabase project |
| Production | `main`, against the production project |

Payment keys are test-mode everywhere except production.

## What this does not have, and why

- **No real-time multiplayer server.** Free-for-all is against bots. Real
  players need a persistent authoritative server, which is a different cost
  profile from a static site plus a database, and it should wait until there
  are players to connect.
- **No third-party analytics.** The funnel is counted server-side against a
  session id. This avoids a consent banner and keeps the page fast.
- **No CDN for the game bundle beyond Vercel's.** It is a few megabytes and
  Vercel's edge is enough until it is not.
