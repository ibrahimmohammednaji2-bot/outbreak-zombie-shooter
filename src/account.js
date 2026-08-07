/*
 * Local profiles.
 *
 * There is no server behind this game, so an account is a named save slot in
 * this browser rather than a real login. Signed in, progress is written to
 * that slot and survives closing the tab. Signed out, you are a guest and
 * nothing is written at all — the run is lost when the page goes.
 *
 * Real accounts that follow you between devices need a backend with auth and
 * a database. This is deliberately not pretending to be that.
 */

const LAST_KEY = "outbreak:lastUser";
const PROFILE_LIST = "outbreak:profiles";
const saveKey = (name) => `outbreak:save:${name.trim().toLowerCase()}`;

export const account = { name: null }; // null means guest

export const signedIn = () => account.name !== null;

function readList() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_LIST) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export const profiles = () => readList();

function rememberProfile(name) {
  const list = readList();
  if (!list.some((n) => n.toLowerCase() === name.toLowerCase())) list.push(name);
  try {
    localStorage.setItem(PROFILE_LIST, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function readSave() {
  if (!signedIn()) return null;
  try {
    return JSON.parse(localStorage.getItem(saveKey(account.name)) ?? "null");
  } catch {
    return null;
  }
}

export function writeSave(data) {
  if (!signedIn()) return false; // guests are never written to disk
  try {
    localStorage.setItem(saveKey(account.name), JSON.stringify(data));
    localStorage.setItem(LAST_KEY, account.name);
    return true;
  } catch {
    return false;
  }
}

/** True if this name already has a save. */
export function profileExists(name) {
  try {
    return localStorage.getItem(saveKey(name)) !== null;
  } catch {
    return false;
  }
}

/** Sign the last used profile back in, so returning players stay signed in. */
export function restoreLast() {
  try {
    const name = localStorage.getItem(LAST_KEY);
    if (name) account.name = name;
  } catch {
    /* storage unavailable */
  }
  return account.name;
}

export function signIn(name) {
  const clean = name.trim().slice(0, 18);
  if (!clean) return false;
  account.name = clean;
  rememberProfile(clean);
  return true;
}

export function signOut() {
  account.name = null;
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage unavailable */
  }
}
