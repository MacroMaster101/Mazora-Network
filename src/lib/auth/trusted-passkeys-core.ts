/**
 * Which passkeys on an account the site trusts.
 *
 * The site only adds a passkey after "Confirm it's you"
 * (finishPasskeyRegistrationAction), but Supabase's own API registers one for
 * anyone holding the account's session token: a copied cookie is enough to add
 * a lasting way in that survives a password change. So the account keeps, in
 * server-only app_metadata, the passkey ids it trusts, and any other passkey is
 * removed (lib/auth/trusted-passkeys), as an unrecognised Google or Discord
 * login is (lib/auth/linked-logins-core).
 *
 * A passkey is trusted when:
 * - it was there when the list was first written (migration 089, or the first
 *   time the account is seen without one);
 * - the site's own add-a-passkey action stored it and wrote its id to the list.
 *
 * Between Supabase storing a new passkey and the site writing its id there is
 * a moment when the passkey is on the account and not on the list. The action
 * records `passkey_pending` before it asks Supabase to store anything, and
 * nothing is removed while that is in force.
 *
 * Unlike a linked login, the passkeys are not part of the user the auth server
 * returns, so they are read from the database together with the list, in one
 * statement (see readPasskeyState). Everything here is about that one row.
 */

/**
 * How long an add started on the site keeps passkeys from being removed. Longer
 * than any request can run, so the action that stored the passkey has either
 * written its id or failed by then. It is never ended early: a second add in
 * another tab may still be relying on it.
 */
export const PASSKEY_PENDING_MS = 2 * 60_000;

/** One account's passkeys and what the site has recorded about them, read together. */
export interface PasskeyState {
  /** The trusted ids, or null when the account has no list yet. */
  trusted: string[] | null;
  /** When the add in progress stops protecting new passkeys (ms), or null. */
  pendingUntil: number | null;
  /** The id of every passkey on the account now. */
  passkeys: string[];
  /** The database's clock (ms) when it was read: the clock `pendingUntil` was written with. */
  now: number;
}

const idOf = (value: string) => value.trim().toLowerCase();

/** A JSON column arrives parsed from postgres-js; text is parsed here. Undefined when it is not JSON. */
function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** The trusted ids, or null when the account has no list yet. */
export function trustedPasskeyIds(meta: Record<string, unknown> | undefined): string[] | null {
  const value = meta?.trusted_passkeys;
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is string => typeof id === "string").map(idOf);
}

/** When the add in progress ends, whether or not that has passed; null when none is recorded. */
export function passkeyPendingUntil(meta: Record<string, unknown> | undefined): number | null {
  const value = meta?.passkey_pending;
  if (!value || typeof value !== "object") return null;
  const { until } = value as { until?: unknown };
  return typeof until === "number" && Number.isFinite(until) ? until : null;
}

/**
 * The row readPasskeyState selects, as a PasskeyState. Null when anything about
 * it is not what was asked for: the caller then knows nothing, and must not
 * read that as "this account has passkeys nobody trusted".
 */
export function parsePasskeyState(row: unknown): PasskeyState | null {
  if (!row || typeof row !== "object") return null;
  const { trusted, pending, passkeys, now } = row as Record<string, unknown>;
  const ids = json(passkeys);
  const clock = typeof now === "string" ? Number(now) : now;
  if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === "string")) return null;
  if (typeof clock !== "number" || !Number.isFinite(clock) || clock <= 0) return null;
  const meta = { trusted_passkeys: json(trusted), passkey_pending: json(pending) };
  return {
    trusted: trustedPasskeyIds(meta),
    pendingUntil: passkeyPendingUntil(meta),
    passkeys: ids.map(idOf),
    now: clock,
  };
}

export type PasskeyReview =
  | { baseline: true }
  | {
      baseline: false;
      /** Passkeys nobody added through the site: removed. */
      remove: string[];
    };

/** What to do about the account's passkeys right now. Pure. */
export function reviewPasskeys(state: PasskeyState): PasskeyReview {
  // No list is "never looked at", not "trusts nothing": everything is kept.
  if (!state.trusted) return { baseline: true };
  // The site is adding a passkey: its id reaches the list in a moment.
  if (state.pendingUntil !== null && state.pendingUntil > state.now) return { baseline: false, remove: [] };
  const known = new Set(state.trusted);
  return { baseline: false, remove: state.passkeys.filter((id) => !known.has(id)) };
}
