/*
 * Parties.
 *
 * There is no game server, so this cannot reach another person's computer.
 * What it does do is genuinely work between tabs of this browser: the party
 * lives in shared local storage, and every tab watches it, so creating a
 * party in one tab and joining it from another really does sync — codes,
 * members, kicks and all.
 *
 * Swapping the three functions at the bottom for calls to a WebSocket server
 * is what would make it work between real players.
 */

import { account } from "./account.js";

const key = (code) => `outbreak:party:${code}`;
const ME_KEY = "outbreak:partyName";

/** A stable name for this tab, so the same person is recognisable. */
function myName() {
  if (account.name) return account.name;
  let n = null;
  try {
    n = sessionStorage.getItem(ME_KEY);
  } catch {
    /* storage unavailable */
  }
  if (!n) {
    n = `GUEST-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      sessionStorage.setItem(ME_KEY, n);
    } catch {
      /* storage unavailable */
    }
  }
  return n;
}

export const party = {
  code: null,
  host: false,
  members: [],
  me: myName(),
  message: "",
};

function readParty(code) {
  try {
    return JSON.parse(localStorage.getItem(key(code)) ?? "null");
  } catch {
    return null;
  }
}

function writeParty(record) {
  try {
    localStorage.setItem(key(record.code), JSON.stringify(record));
  } catch {
    /* storage unavailable */
  }
}

function destroyParty(code) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* storage unavailable */
  }
}

const newCode = () => String(Math.floor(10000 + Math.random() * 90000));

export function createParty() {
  party.me = myName();
  let code = newCode();
  let guard = 0;
  while (readParty(code) && guard++ < 50) code = newCode();

  party.code = code;
  party.host = true;
  party.members = [party.me];
  party.message = "";
  writeParty({ code, host: party.me, members: party.members });
  return code;
}

/** Returns an error string, or null on success. */
export function joinParty(code) {
  const clean = String(code).trim();
  if (!/^\d{5}$/.test(clean)) return "Codes are five digits.";

  const record = readParty(clean);
  if (!record) return "No party with that code.";

  party.me = myName();
  if (record.members.includes(party.me)) {
    // already in it — just re-attach
  } else if (record.members.length >= 4) {
    return "That party is full.";
  } else {
    record.members.push(party.me);
    writeParty(record);
  }

  party.code = clean;
  party.host = record.host === party.me;
  party.members = record.members;
  party.message = "";
  return null;
}

export function leaveParty() {
  if (!party.code) return;
  const record = readParty(party.code);

  if (record) {
    if (party.host) {
      destroyParty(party.code); // the host leaving ends it
    } else {
      record.members = record.members.filter((m) => m !== party.me);
      writeParty(record);
    }
  }

  party.code = null;
  party.host = false;
  party.members = [];
}

export function kickMember(name) {
  if (!party.host || !party.code || name === party.me) return;
  const record = readParty(party.code);
  if (!record) return;
  record.members = record.members.filter((m) => m !== name);
  writeParty(record);
  party.members = record.members;
}

/**
 * Re-read the party. Returns "kicked" if the host removed you, "gone" if the
 * party no longer exists, or null if nothing notable happened.
 */
export function refreshParty() {
  if (!party.code) return null;
  const record = readParty(party.code);

  if (!record) {
    party.code = null;
    party.host = false;
    party.members = [];
    return "gone";
  }

  if (!record.members.includes(party.me)) {
    party.code = null;
    party.host = false;
    party.members = [];
    return "kicked";
  }

  party.members = record.members;
  party.host = record.host === party.me;
  return null;
}
