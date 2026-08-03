/**
 * Client-side consent helpers. Deliberately free of `server-only` so both the
 * banner and the analytics beacons can share one definition of "has the visitor
 * agreed to counting cookies".
 *
 * The consent cookie itself is strictly necessary (it records a privacy choice),
 * so it is scoped to the whole site and is intentionally readable by client JS —
 * unlike the analytics cookies, which are httpOnly and scoped to /api/news.
 */

export const CONSENT_COOKIE = "mazora_cookie_consent";
export const CONSENT_ACCEPTED = "accepted";
export const CONSENT_REJECTED = "rejected";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

/** Fired on `window` whenever the choice changes, so beacons can react immediately. */
export const CONSENT_EVENT = "mazora:consent-change";

export type ConsentChoice = typeof CONSENT_ACCEPTED | typeof CONSENT_REJECTED;

export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CONSENT_COOKIE}=`;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(prefix.length));
  return value === CONSENT_ACCEPTED || value === CONSENT_REJECTED ? value : null;
}

export function writeConsent(choice: ConsentChoice) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}

export function hasAccepted(): boolean {
  return readConsent() === CONSENT_ACCEPTED;
}

/**
 * Forget the recorded choice so the banner reappears. Withdrawing consent must
 * be as easy as granting it, and the same event lets the banner re-render
 * without a reload.
 */
export function clearConsent() {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<ConsentChoice | null>(CONSENT_EVENT, { detail: null }));
}
