import "server-only";
import { countBreaches, splitPasswordHash } from "@/lib/pwned-password-shared";

export * from "@/lib/pwned-password-shared";

/**
 * Rejects passwords that already appear in a public breach corpus, using the
 * Have I Been Pwned range API.
 *
 * Supabase offers this as "leaked password protection", but only on the Pro
 * plan and above, so it is done here instead. The composition rules in
 * lib/validation/auth are otherwise the only defence, and they are the weaker
 * kind: they accept `Password1!` — which is in the corpus millions of times
 * over — while actively steering people towards that shape of password.
 *
 * The password never leaves this server. The API takes the first five hex
 * characters of the SHA-1 and returns every suffix sharing that prefix; the
 * comparison happens locally, so the service learns neither the password, nor
 * its hash, nor which of the hashes it returned was the one asked about.
 * `Add-Padding` asks for the response to be padded with fabricated suffixes at
 * count 0 so its size cannot narrow the prefix down either.
 *
 * It fails open, deliberately. A timeout, an outage or a malformed response all
 * return "not breached". This runs on the registration and password-reset
 * paths, and a third-party service being down must never stop people creating
 * accounts or recovering them. The composition rules still apply either way.
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** Long enough for a normal round trip, short enough not to stall a signup. */
const REQUEST_TIMEOUT_MS = 2_000;

export async function isPasswordBreached(password: string): Promise<boolean> {
  if (!password) return false;

  try {
    const { prefix, suffix } = await splitPasswordHash(password);
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // The prefix is not user-identifying, but there is no reason to let a
      // CDN hold answers on a path that decides whether a password is allowed.
      cache: "no-store",
    });
    if (!response.ok) return false;
    return countBreaches(await response.text(), suffix) > 0;
  } catch {
    // Timeout, DNS failure, offline build environment — all mean "carry on".
    return false;
  }
}
