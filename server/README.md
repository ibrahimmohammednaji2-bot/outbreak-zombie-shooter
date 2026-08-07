# Zombie Attack — server

Real accounts, server-held progress, and paid skins that cannot be faked.

Run it:

```bash
node server/server.js
```

No `npm install` — it uses only Node's own `http`, `crypto` and `fetch`.
Data lives in `server/data.json`.

## Why a server exists at all

Anything running in the player's browser can be edited by the player. If the
page decided "payment succeeded, unlock the skin", anyone could claim that. So
the rule here is: **the game may ask what it owns, but may never say what it
owns.**

That shows up in `/api/save`. Coins and free skins sent by the client are
accepted at face value — they are only worth cheating for bragging rights.
**Entitlements are ignored completely.** The one and only place an entitlement
is ever granted is the Stripe webhook, after Stripe confirms real money moved.

## Endpoints

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/signup` | Create an account. Returns a token. |
| POST | `/api/login` | Sign in. Returns a token. |
| GET | `/api/save` | Read this account's progress and entitlements. |
| PUT | `/api/save` | Write progress. Entitlements in the body are discarded. |
| POST | `/api/checkout` | Start a Stripe payment. Returns a checkout URL. |
| POST | `/api/webhook/stripe` | Stripe calls this. Grants the skin. |
| GET | `/api/health` | Is it up, and are payments configured. |

Passwords are stored as scrypt hashes with a per-user salt, and compared in
constant time. Tokens are random UUIDs.

## What only you can do

The code is finished. These four steps need a real person with a real
identity, and I cannot do them on your behalf.

1. **Turn 18, or ask a parent.** Every payment processor requires the account
   holder to be an adult. If you are under 18 the account must be in a
   parent's or guardian's name, and the money arrives in their bank account.
   This is their legal requirement, not a technical one.

2. **Open a Stripe account** at <https://dashboard.stripe.com/register>.
   Stripe supports the UAE. You will need an ID document, an address and a
   bank account. Verification usually takes a day or two.

   Paddle and Lemon Squeezy are worth considering instead — they act as
   "merchant of record", meaning they deal with VAT and tax paperwork for you.
   Slightly higher fees, far less admin.

3. **Host the server somewhere.** It has to be reachable from the internet so
   Stripe can call the webhook — a tunnel from a home PC is not good enough
   for money. Railway, Render and Fly.io all have free or near-free tiers that
   run this file as-is.

4. **Set three environment variables** where you host it:

   ```
   STRIPE_SECRET=sk_live_...          # Stripe dashboard → Developers → API keys
   STRIPE_WEBHOOK_SECRET=whsec_...    # created when you add the webhook below
   SITE_URL=https://your-game-url     # where players come back to after paying
   ```

   Then in Stripe → Developers → Webhooks, add an endpoint pointing at
   `https://your-server/api/webhook/stripe` and subscribe it to
   `checkout.session.completed`.

Test everything with Stripe's **test mode** keys first. Card `4242 4242 4242
4242`, any future expiry, any CVC. No real money moves.

## What it costs you

Stripe takes roughly **3–5% plus a small fixed fee** per sale. On a 10 AED
skin you keep about 8–9 AED. Payouts land in your bank account on a schedule
you set in the dashboard.

## Prices

Set in `PRICES` at the top of `server.js`, in fils:

```js
const PRICES = { special: 1000, op: 2000 };   // 10 AED and 20 AED
```

The price is always taken from that table, never from the browser's request —
otherwise a player could ask to be charged one fil.

## Still to do once the server is live

The game currently keeps profiles in browser storage. Pointing it at this
server instead is a small change to `src/account.js` and `src/skins.js`:
sign-in calls `/api/login`, progress calls `/api/save`, and the skin store
checks `entitlements` for Special and OP. That is worth doing only once the
server has a permanent home.
