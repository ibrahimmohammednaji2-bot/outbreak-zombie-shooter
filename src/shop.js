/*
 * The shop: tokens, the daily freebie, and the offer that rotates each day.
 *
 * A token buys you one revive after dying, three at most in a single game.
 * Tokens are bought with coins or with real money — and the real-money side
 * cannot work until there is a payment provider and a server to verify it, so
 * those prices are shown and refused rather than faked.
 */

const KEY = "za:shop";
export const DAILY_COINS = 25;
export const MAX_REVIVES = 3;

/** Coin prices. Only the single token is buyable with coins. */
export const TOKEN_PACKS = [
  { id: "t1", tokens: 1, coins: 100, aed: 2 },
  { id: "t5", tokens: 5, aed: 10 },
  { id: "t10", tokens: 10, aed: 15 },
  { id: "t25", tokens: 25, aed: 40 },
  { id: "t50", tokens: 50, aed: 75 },
  { id: "t100", tokens: 100, aed: 150 },
  { id: "unlimited", tokens: Infinity, aed: 250, name: "Unlimited" },
];

/** What rotates. One is chosen per day from the date itself. */
const OFFERS = [
  { id: "op-skin", name: "An OP skin", detail: "Any OP rarity skin", aed: 10 },
  { id: "special-skin", name: "A Special skin", detail: "Any Special rarity skin", aed: 5 },
  { id: "tokens-half", name: "Tokens at half price", detail: "Every pack, half off, today only", half: true },
];

const today = () => new Date().toISOString().slice(0, 10);

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      tokens: Number.isFinite(raw.tokens) ? raw.tokens : 0,
      unlimited: raw.unlimited === true,
      lastFreebie: typeof raw.lastFreebie === "string" ? raw.lastFreebie : "",
    };
  } catch {
    return { tokens: 0, unlimited: false, lastFreebie: "" };
  }
}

export const shop = read();

export function saveShop() {
  try {
    localStorage.setItem(KEY, JSON.stringify(shop));
  } catch {
    /* private browsing */
  }
}

/** A stable pick for the day, so everyone sees the same offer. */
export function offerOfTheDay() {
  const d = today();
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d.charCodeAt(i);
  return OFFERS[sum % OFFERS.length];
}

export const freebieReady = () => shop.lastFreebie !== today();

export function claimFreebie() {
  if (!freebieReady()) return 0;
  shop.lastFreebie = today();
  saveShop();
  return DAILY_COINS;
}

export const tokenCount = () => (shop.unlimited ? Infinity : shop.tokens);
export const hasToken = () => shop.unlimited || shop.tokens > 0;

export function spendToken() {
  if (shop.unlimited) return true;
  if (shop.tokens <= 0) return false;
  shop.tokens--;
  saveShop();
  return true;
}

export function grantUnlimited() {
  shop.unlimited = true;
  saveShop();
}

/** Price after today's offer is taken into account. */
export function priceOf(pack) {
  const offer = offerOfTheDay();
  return offer.half ? Math.round(pack.aed / 2) : pack.aed;
}

/** Returns "ok", "poor" or "real-money". */
export function buyPack(pack, wallet, saveWallet) {
  if (pack.coins) {
    if (wallet.coins < pack.coins) return "poor";
    wallet.coins -= pack.coins;
    shop.tokens += pack.tokens;
    saveWallet();
    saveShop();
    return "ok";
  }
  return "real-money";
}
