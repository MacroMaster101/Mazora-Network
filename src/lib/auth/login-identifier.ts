/**
 * Sign-in accepts a username or an email address.
 *
 * Supabase Auth has no concept of a username: the password hash lives in
 * `auth.users` keyed to the email, and signInWithPassword() takes an email or a
 * phone number and nothing else. `profiles.username` is this application's own
 * table, invisible to Supabase. So a username sign-in is a translation — find
 * the address that username belongs to, then verify email + password normally.
 *
 * Pure so the branching and the sentinel can be tested without a database.
 */

/**
 * An address that is syntactically valid and can never belong to anyone.
 *
 * Used when a username does not resolve. Returning early there would make an
 * unknown username fail measurably faster than a wrong password, which is a
 * timing oracle for "does this username exist". Sending this to Supabase
 * instead keeps one code path and one indistinguishable failure.
 *
 * `.invalid` is reserved by RFC 2606 precisely so it can never be registered.
 */
export const UNRESOLVED_IDENTIFIER = "unresolved-login@mazora.invalid";

/** Whether the typed value should be treated as an email address. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

/**
 * The single message shown for every failed sign-in.
 *
 * One string for "no such username", "no such email" and "wrong password"
 * alike. Distinguishing them would let anyone confirm which usernames and
 * addresses exist on the server, one guess at a time.
 */
export const SIGN_IN_FAILED = "Wrong username or password.";
