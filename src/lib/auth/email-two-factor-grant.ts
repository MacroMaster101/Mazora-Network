import "server-only";

import { cookies } from "next/headers";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { deriveGrantKey, signSessionGrant, verifySessionGrant, type ResetGrantSubject } from "./reset-grant-core";

// An application sign-in pass, not a Supabase AAL2 token or an owner/recovery
// pass. Security-setting changes still demand an authenticator or recovery code.
const COOKIE = "mz_mfa_email";
const TTL_SECONDS = 30 * 24 * 60 * 60;

function key() {
  const secret = supabaseSecretKey();
  return secret ? deriveGrantKey(secret, "mfa-email-sign-in") : null;
}

export async function issueEmailTwoFactorGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  if (!k || !subject.userId || !subject.sessionId) return false;
  (await cookies()).set(COOKIE, signSessionGrant(subject, k, Math.floor(Date.now() / 1000), TTL_SECONDS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return true;
}

export async function hasEmailTwoFactorGrant(subject: ResetGrantSubject): Promise<boolean> {
  const k = key();
  return Boolean(k && verifySessionGrant((await cookies()).get(COOKIE)?.value, subject, k, Math.floor(Date.now() / 1000)));
}

export async function clearEmailTwoFactorGrant(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    // Rendering cannot write cookies; user/session/enrollment binding still applies.
  }
}
