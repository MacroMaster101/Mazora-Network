import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey } from "@/lib/auth/reset-grant-core";
import {
  accountKey,
  actionClientKey,
  peekRateLimitShared,
  rateLimitShared,
  tooManyAttemptsMessage,
} from "@/lib/rate-limit";

/**
 * Password sign-in lockout that a stranger cannot point at someone else.
 *
 * Counting every attempt against the account let anyone who knew a public
 * username keep that member locked out, just by typing wrong passwords for it.
 * Counting only failures does not fix that on its own (the stranger's attempts
 * ARE failures), so the buckets are split the way large sites do it:
 *
 * - every attempt from an address, whatever account it names (the "login"
 *   bucket in loginAction): brakes spraying many accounts from one source;
 * - wrong passwords for this account from this address: 8 per 15 minutes. A
 *   stranger runs out here, on their own address, long before the owner does;
 * - wrong passwords for this account from anywhere: 50 per hour, to stop
 *   guessing spread across many addresses. This is the one a stranger could
 *   fill, so a browser that has signed in to the account before (the
 *   known-device pass below) is exempt from it, and the owner gets in.
 *
 * The account buckets are checked before the password is tried and counted
 * only when it was wrong. A username that belongs to nobody is keyed on what
 * was typed and takes exactly the same path, so the lockout never says which
 * names exist.
 */

const PAIR = { scope: "login-fail-pair", limit: 8, windowMs: 15 * 60_000 };
const ACCOUNT = { scope: "login-fail-account", limit: 50, windowMs: 60 * 60_000 };

const pairKey = async (identity: string) => actionClientKey(accountKey(PAIR.scope, identity));

/** A message when this account is locked for this caller, or null. Counts nothing. */
export async function loginLockedOut(identity: string): Promise<string | null> {
  const knownDevice = await isKnownLoginDevice(identity);
  const [pair, account] = await Promise.all([
    peekRateLimitShared(await pairKey(identity), { limit: PAIR.limit, windowMs: PAIR.windowMs, failureMode: "closed" }),
    peekRateLimitShared(accountKey(ACCOUNT.scope, identity), {
      limit: ACCOUNT.limit,
      windowMs: ACCOUNT.windowMs,
      failureMode: "closed",
    }),
  ]);
  // Both are always read, pass or not, so holding one changes no timing.
  const blocked = [pair, ...(knownDevice ? [] : [account])].filter((verdict) => !verdict.ok);
  if (blocked.length === 0) return null;
  return tooManyAttemptsMessage(Math.max(...blocked.map((verdict) => verdict.retryAfter)));
}

/** Call only when the auth server said the password is wrong. */
export async function recordLoginFailure(identity: string): Promise<void> {
  await Promise.all([
    rateLimitShared(await pairKey(identity), { limit: PAIR.limit, windowMs: PAIR.windowMs, failureMode: "closed" }),
    rateLimitShared(accountKey(ACCOUNT.scope, identity), {
      limit: ACCOUNT.limit,
      windowMs: ACCOUNT.windowMs,
      failureMode: "closed",
    }),
  ]);
}

/* -------------------------------------------------------- known-device pass */

/**
 * "This browser has signed in to this account before." Issued after every
 * successful sign-in (password, passkey, Google or Discord) and kept for 180
 * days. It is about the device, not a session, so signing out leaves it.
 *
 * It grants nothing but the exemption from the account-wide failure bucket
 * above: never a session, never a skipped step, never an exemption from the
 * per-address buckets. Each account is a keyed digest of its login email, so
 * the cookie never holds the address; a few accounts can share one browser.
 * Signed with its own purpose key, httpOnly, and SameSite=Lax so it is sent on
 * an ordinary visit to the sign-in page.
 */

const COOKIE = "mz_known_device";
export const KNOWN_DEVICE_TTL_SECONDS = 180 * 24 * 60 * 60;
const MAX_ACCOUNTS = 5;

export interface KnownDeviceEntry {
  /** accountTag of the login email. */
  a: string;
  /** Expiry, in seconds. */
  e: number;
}

export function knownDeviceKey(secret: string): Buffer {
  return deriveGrantKey(secret, "known-login-device");
}

function mac(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** The account's digest. Keyed, so it cannot be matched against a list of addresses. */
export function accountTag(email: string, key: Buffer): string {
  return mac(`account:${email.trim().toLowerCase()}`, key).slice(0, 22);
}

export function signKnownDevice(entries: KnownDeviceEntry[], key: Buffer): string {
  const payload = Buffer.from(JSON.stringify({ d: entries })).toString("base64url");
  return `${payload}.${mac(payload, key)}`;
}

/** The unexpired entries of a pass signed with `key`; none for anything else. */
export function readKnownDevice(token: string | null | undefined, key: Buffer, nowSeconds: number): KnownDeviceEntry[] {
  if (!token) return [];
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return [];
  const payload = token.slice(0, dot);
  const offered = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(payload, key));
  if (offered.length !== expected.length || !timingSafeEqual(offered, expected)) return [];
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { d?: unknown };
    if (!Array.isArray(claims.d)) return [];
    return claims.d
      .filter((entry): entry is KnownDeviceEntry =>
        typeof entry?.a === "string" && typeof entry?.e === "number" && entry.e > nowSeconds,
      )
      .slice(-MAX_ACCOUNTS)
      .map((entry) => ({ a: entry.a, e: entry.e }));
  } catch {
    return [];
  }
}

/** The entries with this account (re)added for a full term, newest last. */
export function withKnownAccount(entries: KnownDeviceEntry[], tag: string, nowSeconds: number): KnownDeviceEntry[] {
  return [...entries.filter((entry) => entry.a !== tag), { a: tag, e: nowSeconds + KNOWN_DEVICE_TTL_SECONDS }].slice(
    -MAX_ACCOUNTS,
  );
}

export function knownDeviceHolds(
  token: string | null | undefined,
  email: string,
  key: Buffer,
  nowSeconds: number,
): boolean {
  const tag = accountTag(email, key);
  return readKnownDevice(token, key, nowSeconds).some((entry) => entry.a === tag);
}

function key(): Buffer | null {
  const secret = supabaseSecretKey();
  return secret ? knownDeviceKey(secret) : null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Remember this browser for the account that just signed in. Best-effort. */
export async function rememberLoginDevice(email: string | null | undefined): Promise<void> {
  const k = key();
  if (!k || !email) return;
  try {
    const store = await cookies();
    const now = nowSeconds();
    const entries = withKnownAccount(readKnownDevice(store.get(COOKIE)?.value, k, now), accountTag(email, k), now);
    store.set(COOKIE, signKnownDevice(entries, k), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: KNOWN_DEVICE_TTL_SECONDS,
    });
  } catch (error) {
    // A pass that could not be written only means the next lockout applies in full.
    console.error("Known-device pass could not be issued:", error);
  }
}

/** Whether this browser holds a valid pass for `identity` (a login email, or a name that matched nobody). */
export async function isKnownLoginDevice(identity: string): Promise<boolean> {
  const k = key();
  if (!k) return false;
  return knownDeviceHolds((await cookies()).get(COOKIE)?.value, identity, k, nowSeconds());
}
