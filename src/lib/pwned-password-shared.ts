/**
 * The k-anonymity arithmetic behind the breached-password check, kept free of
 * `server-only` so it can be unit tested and, if a form ever wants to warn
 * before submitting, reused in the browser.
 *
 * The network call lives in lib/auth/pwned-password, which is server-only.
 *
 * Web Crypto rather than node:crypto deliberately: this module has no Node
 * dependency, so it stays usable from a client component or the Edge runtime,
 * where node:crypto is not available.
 */

/** Shown against the password field when the corpus has a match. */
export const PWNED_PASSWORD_MESSAGE =
  "This password has appeared in a public data breach. Please choose a different one.";

/** The number of leading hash characters the range API is given. */
export const HASH_PREFIX_LENGTH = 5;

/**
 * Split the password's SHA-1 into the prefix that is sent upstream and the
 * suffix that never leaves this process.
 *
 * That 5/35 boundary is the entire privacy guarantee of the scheme — the
 * service is handed a prefix shared by several hundred hashes and never learns
 * which one was being asked about — so it is pinned by tests rather than left
 * to review.
 *
 * SHA-1 is not protecting anything here and is not a security choice: it is the
 * corpus's index, and the caller already holds the password in plaintext.
 */
export async function splitPasswordHash(password: string): Promise<{ prefix: string; suffix: string }> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return { prefix: hash.slice(0, HASH_PREFIX_LENGTH), suffix: hash.slice(HASH_PREFIX_LENGTH) };
}

/**
 * How many breaches the range response records for `suffix`; 0 when it is
 * absent, padded, or the body is unusable.
 *
 * Deliberately tolerant of malformed input. This runs on the registration path,
 * so an unparseable line has to mean "carry on", never an exception that takes
 * signup down with it. Padding rows arrive at count 0 and so can never fail a
 * password.
 */
export function countBreaches(body: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of body.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    if (line.slice(0, separator).trim().toUpperCase() !== wanted) continue;
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }
  return 0;
}
