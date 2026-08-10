/*
 * The bank: points that survive dying.
 *
 * Points are gone the moment a run ends. What is in the bank is not, so a good
 * run can pay for the next one's Juggernaut before the first zombie is up. You
 * can only ever take out what you put in — this stores a number, it does not
 * make one.
 */

const KEY = "za:bank";
const CAP = 200000; // a ceiling, so a stored number can never be absurd

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const points = Number(raw.points);
    return { points: Number.isFinite(points) ? Math.max(0, Math.min(CAP, Math.round(points))) : 0 };
  } catch {
    return { points: 0 };
  }
}

export const bank = read();

export function saveBank() {
  bank.points = Math.max(0, Math.min(CAP, Math.round(bank.points)));
  try {
    localStorage.setItem(KEY, JSON.stringify(bank));
  } catch {
    /* private browsing */
  }
}

export function clearBank() {
  bank.points = 0;
  saveBank();
}
