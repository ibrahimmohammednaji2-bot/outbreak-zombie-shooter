/*
 * Zombie Attack — game server.
 *
 * Deliberately dependency-free: Node's own http, crypto and fetch are enough.
 * Run it with `node server/server.js`.
 *
 * What it is for:
 *   • real accounts, so progress lives on the server rather than in a browser
 *   • entitlements, so a paid skin cannot be granted by editing the page
 *   • checkout + webhook, so money is confirmed by Stripe and not by the client
 *
 * The rule that shapes all of it: never trust the browser. The game may ask
 * "what do I own?" but it may never say "I own this now".
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(HERE, "data.json");

const PORT = process.env.PORT ?? 8787;
const STRIPE_SECRET = process.env.STRIPE_SECRET ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const SITE_URL = process.env.SITE_URL ?? "http://localhost:4173";

// what real money buys, in fils/cents of AED
const PRICES = { special: 1000, op: 2000 };

/* ── storage ─────────────────────────────────────────────────────
 * A JSON file is plenty for a game this size and keeps the server
 * dependency-free. Swap for Postgres when it stops being enough.
 */
function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: {}, sessions: {}, orders: {} };
  }
}

function save(db) {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic, so a crash cannot half-write it
}

let db = load();

/* ── passwords ───────────────────────────────────────────────── */

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
}

/* ── http helpers ────────────────────────────────────────────── */

const send = (res, code, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  });
  res.end(payload);
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function userFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const name = db.sessions[token];
  return name ? { name, user: db.users[name] } : null;
}

/* ── routes ──────────────────────────────────────────────────── */

async function handle(req, res, url) {
  // ── accounts ──
  if (url.pathname === "/api/signup" && req.method === "POST") {
    const { name, password } = JSON.parse(await readBody(req));
    const id = String(name ?? "").trim().toLowerCase();
    if (!id || !password || password.length < 6) {
      return send(res, 400, { error: "Name and a password of six or more characters." });
    }
    if (db.users[id]) return send(res, 409, { error: "That name is taken." });

    db.users[id] = {
      name: String(name).trim(),
      password: hashPassword(password),
      wallet: { coins: 0, owned: [], equipped: null, code: { redeemed: false, active: false } },
      entitlements: [],
      created: Date.now(),
    };
    const token = crypto.randomUUID();
    db.sessions[token] = id;
    save(db);
    return send(res, 200, { token, name: db.users[id].name });
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const { name, password } = JSON.parse(await readBody(req));
    const id = String(name ?? "").trim().toLowerCase();
    const user = db.users[id];
    if (!user || !verifyPassword(password ?? "", user.password)) {
      return send(res, 401, { error: "Wrong name or password." });
    }
    const token = crypto.randomUUID();
    db.sessions[token] = id;
    save(db);
    return send(res, 200, { token, name: user.name });
  }

  // ── progress ──
  if (url.pathname === "/api/save") {
    const auth = userFrom(req);
    if (!auth) return send(res, 401, { error: "Sign in first." });

    if (req.method === "GET") {
      return send(res, 200, {
        wallet: auth.user.wallet,
        entitlements: auth.user.entitlements,
      });
    }

    if (req.method === "PUT") {
      const body = JSON.parse(await readBody(req));
      const w = body.wallet ?? {};
      // Coins and owned skins come from the client, which the player controls,
      // so they are advisory. Entitlements never are — those only ever come
      // from a verified payment below.
      auth.user.wallet = {
        coins: Math.max(0, Number(w.coins) || 0),
        owned: Array.isArray(w.owned) ? w.owned.slice(0, 500) : [],
        equipped: typeof w.equipped === "string" ? w.equipped : null,
        code: { redeemed: !!w.code?.redeemed, active: !!w.code?.active },
      };
      save(db);
      return send(res, 200, { ok: true });
    }
  }

  // ── checkout ──
  if (url.pathname === "/api/checkout" && req.method === "POST") {
    const auth = userFrom(req);
    if (!auth) return send(res, 401, { error: "Sign in first." });
    if (!STRIPE_SECRET) {
      return send(res, 501, {
        error: "No payment key configured on the server yet.",
      });
    }

    const { rarity, skinId } = JSON.parse(await readBody(req));
    const amount = PRICES[rarity];
    if (!amount) return send(res, 400, { error: "That rarity is not for sale." });

    // Price is taken from the table above, never from the request — otherwise
    // a player could ask to pay one fil.
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "aed",
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": `Zombie Attack — ${rarity} skin`,
      success_url: `${SITE_URL}/?paid=1`,
      cancel_url: `${SITE_URL}/?paid=0`,
      "metadata[user]": auth.name,
      "metadata[skinId]": String(skinId ?? ""),
      "metadata[rarity]": rarity,
    });

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${STRIPE_SECRET}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const session = await r.json();
    if (!r.ok) return send(res, 502, { error: session.error?.message ?? "Stripe refused." });

    return send(res, 200, { url: session.url });
  }

  // ── webhook: the only thing that may grant an entitlement ──
  if (url.pathname === "/api/webhook/stripe" && req.method === "POST") {
    const raw = await readBody(req);

    if (STRIPE_WEBHOOK_SECRET) {
      const header = req.headers["stripe-signature"] ?? "";
      const parts = Object.fromEntries(
        header.split(",").map((p) => p.split("=").map((s) => s.trim())),
      );
      const expected = crypto
        .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
        .update(`${parts.t}.${raw.toString()}`)
        .digest("hex");
      const given = Buffer.from(parts.v1 ?? "");
      const mine = Buffer.from(expected);
      if (given.length !== mine.length || !crypto.timingSafeEqual(given, mine)) {
        return send(res, 400, { error: "Bad signature." });
      }
    }

    const event = JSON.parse(raw.toString());
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const id = String(s.metadata?.user ?? "");
      const user = db.users[id];
      if (user && s.payment_status === "paid" && !db.orders[s.id]) {
        db.orders[s.id] = { user: id, skinId: s.metadata.skinId, at: Date.now() };
        if (!user.entitlements.includes(s.metadata.skinId)) {
          user.entitlements.push(s.metadata.skinId);
        }
        save(db);
        console.log(`granted ${s.metadata.skinId} to ${id}`);
      }
    }
    return send(res, 200, { received: true });
  }

  if (url.pathname === "/api/health") {
    return send(res, 200, {
      ok: true,
      users: Object.keys(db.users).length,
      payments: STRIPE_SECRET ? "configured" : "not configured",
    });
  }

  send(res, 404, { error: "No such endpoint." });
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host}`);
    handle(req, res, url).catch((err) => {
      console.error(err);
      send(res, 500, { error: "Server error." });
    });
  })
  .listen(PORT, () => {
    console.log(`Zombie Attack server on http://localhost:${PORT}`);
    console.log(`payments: ${STRIPE_SECRET ? "configured" : "NOT configured"}`);
  });
