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

/**
 * Which version of the privacy policy a recorded choice was made against.
 *
 * The cookie used to hold a bare "accepted", which meant a choice lasted its
 * full 180 days no matter what the policy said by the end of them: change what
 * is collected, and every existing visitor stays opted in to terms they never
 * saw, with no way to ask them again short of renaming the cookie.
 *
 * Bump this whenever the privacy policy changes in a way that affects what the
 * banner is asking for — new cookies, a new processor, a new purpose. Everyone
 * is asked once more; nobody is asked for cosmetic edits.
 */
export const CONSENT_POLICY_VERSION = 1;

/** Fired on `window` whenever the choice changes, so beacons can react immediately. */
export const CONSENT_EVENT = "mazora:consent-change";

export type ConsentChoice = typeof CONSENT_ACCEPTED | typeof CONSENT_REJECTED;

function isChoice(value: string): value is ConsentChoice {
  return value === CONSENT_ACCEPTED || value === CONSENT_REJECTED;
}

/** The cookie value to store for a choice made against the current policy. */
export function serializeConsent(choice: ConsentChoice): string {
  return `${choice}:${CONSENT_POLICY_VERSION}`;
}

/**
 * Read a stored cookie value back, or null when there is no usable answer.
 *
 * Shared by the banner and by the server-side beacon guard so there is exactly
 * one definition of what counts as consent — the two disagreeing is how a site
 * ends up counting visits it was told not to.
 *
 * A value with no version is one written before versioning existed. It is
 * grandfathered to the current policy rather than discarded: the policy those
 * visitors agreed to has not changed, and re-prompting all of them on deploy
 * would be throwing away consent that is still good.
 *
 * A version *newer* than we know about is honoured too. That is a visitor who
 * answered on a newer deploy and then hit an older cached bundle; asking again
 * would be the wrong way round.
 */
export function resolveConsent(
  raw: string | null | undefined,
  currentVersion: number = CONSENT_POLICY_VERSION,
): ConsentChoice | null {
  if (!raw) return null;

  const parts = raw.split(":");
  if (parts.length === 1) {
    return isChoice(parts[0]) ? parts[0] : null;
  }
  if (parts.length !== 2) return null;

  const [choice, rawVersion] = parts;
  if (!isChoice(choice)) return null;
  if (!/^\d+$/.test(rawVersion)) return null;

  return Number(rawVersion) >= currentVersion ? choice : null;
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CONSENT_COOKIE}=`;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  if (!match) return null;
  return resolveConsent(decodeURIComponent(match.slice(prefix.length)));
}

export function writeConsent(choice: ConsentChoice) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choice)}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
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
