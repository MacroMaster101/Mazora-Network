import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey } from "@/lib/auth/reset-grant-core";
import {
  KNOWN_DEVICE_TTL_SECONDS,
  knownDeviceHolds,
  readKnownDevice,
  signKnownDevice,
  withKnownAccount,
  accountTag,
} from "@/lib/auth/login-lockout";
import { accountKey, actionClientKey, rateLimitShared, tooManyAttemptsMessage } from "@/lib/rate-limit";

/**
 * The guess limit on an account's six-digit authenticator code, split so that
 * someone who knows the password cannot keep the owner from entering theirs.
 *
 * One bucket per account (5 per 15 minutes, from anywhere) let whoever had the
 * password type five wrong codes each window and lock the owner out for good.
 * The password lockout (lib/auth/login-lockout) answers the same problem with
 * a per-address bucket and a known-device exemption from the account-wide one.
 * That shape cannot be copied here as it stands, for two reasons:
 *
 * - its known-device pass is issued when the PASSWORD matches, so the very
 *   person this is about would hold it;
 * - an exemption bounded only per address would hand anyone holding a pass
 *   five guesses per address, and a six-digit code has only a million values.
 *
 * So there are two account-wide buckets and a pass of its own:
 *
 * - a browser that has never passed this account's second step counts in the
 *   first bucket. Someone with only the password fills it, and blocks only
 *   other browsers that have never passed it;
 * - a browser that has passed it before (the pass below) counts in the second,
 *   which nobody without a pass can touch, so the owner still gets in.
 *
 * Both are 5 per 30 minutes: together 20 guesses an hour, which is what the
 * single bucket allowed, and half that for anyone without a pass. The
 * per-address bucket across all accounts is unchanged.
 *
 * Every attempt counts, right or wrong, as before. Every place that checks an
 * authenticator code goes through here, so none of them adds guesses.
 */

const WINDOW_MS = 30 * 60_000;
const ADDRESS = { scope: "mfa-verify:ip", limit: 25, windowMs: 15 * 60_000 };
const NEW_BROWSER = { scope: "mfa-verify", limit: 5, windowMs: WINDOW_MS };
const PROVEN_BROWSER = { scope: "mfa-verify-proven", limit: 5, windowMs: WINDOW_MS };

/** A retry message when this caller may not try a code for the account now, or null. Counts the attempt. */
export async function throttleSecondStepCode(userId: string): Promise<string | null> {
  const bucket = (await isSecondStepDevice(userId)) ? PROVEN_BROWSER : NEW_BROWSER;
  const verdicts = await Promise.all([
    rateLimitShared(await actionClientKey(ADDRESS.scope), {
      limit: ADDRESS.limit,
      windowMs: ADDRESS.windowMs,
      failureMode: "closed",
    }),
    rateLimitShared(accountKey(bucket.scope, userId), {
      limit: bucket.limit,
      windowMs: bucket.windowMs,
      failureMode: "closed",
    }),
  ]);
  const blocked = verdicts.filter((verdict) => !verdict.ok);
  if (blocked.length === 0) return null;
  return tooManyAttemptsMessage(Math.max(...blocked.map((verdict) => verdict.retryAfter)));
}

/* ------------------------------------------------------- second-step pass */

/**
 * "This browser has passed this account's second step before": an
 * authenticator code or a recovery code, never the password alone. Kept for
 * 180 days and about the device, not a session, like the known-device pass it
 * shares its format with.
 *
 * It grants nothing but which of the two buckets above the browser counts in:
 * never a session, never a skipped code. Signed with its own purpose key, so
 * a known-device pass (which a password alone earns) never verifies as one.
 */

const COOKIE = "mz_second_step_device";

export function secondStepDeviceKey(secret: string): Buffer {
  return deriveGrantKey(secret, "known-second-step-device");
}

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? secondStepDeviceKey(secret) : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Remember this browser for the account that just passed its second step. Best-effort. */
export async function rememberSecondStepDevice(userId: string | null | undefined): Promise<void> {
  const k = key();
  if (!k || !userId) return;
  try {
    const store = await cookies();
    const now = nowSeconds();
    const entries = withKnownAccount(readKnownDevice(store.get(COOKIE)?.value, k, now), accountTag(userId, k), now);
    store.set(COOKIE, signKnownDevice(entries, k), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: KNOWN_DEVICE_TTL_SECONDS,
    });
  } catch (error) {
    // Without the pass the browser only counts as a new one next time.
    console.error("Second-step pass could not be issued:", error);
  }
}

/** Whether this browser holds a valid pass for the account. */
export async function isSecondStepDevice(userId: string): Promise<boolean> {
  const k = key();
  if (!k) return false;
  return knownDeviceHolds((await cookies()).get(COOKIE)?.value, userId, k, nowSeconds());
}
