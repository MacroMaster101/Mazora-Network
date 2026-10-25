import "server-only";

import { createHash, createHmac, randomInt } from "node:crypto";
import { deriveGrantKey, type ResetGrantSubject } from "@/lib/auth/reset-grant-core";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";
import { redisCommand } from "@/lib/redis";
import { sendEmail } from "@/lib/email/send";
import { buildCodeEmail } from "@/lib/email/code-email";
import { resolvePublicOrigin } from "@/lib/site";
import { supportEmail } from "@/lib/support-contact";

/**
 * Single-use inbox proofs for account changes/deletion, and the email
 * fallback at the second sign-in step. Callers enforce which
 * proof an account may use; these purposes never substitute for one another.
 *
 * Each code is bound to the user, the requesting session and its purpose, so a
 * code sent for one cannot be spent on the other, nor from another browser.
 * Only a keyed digest is stored, for ten minutes.
 */
export type EmailProofPurpose = "account-deletion" | "account-change" | "two-factor-sign-in";

const TTL_MS = 10 * 60_000;
// Compare and delete in one command: concurrent requests cannot spend a code twice.
const CONSUME = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

function proof(purpose: EmailProofPurpose, subject: ResetGrantSubject, code: string): { key: string; hash: string } | null {
  const secret = supabaseSecretKey();
  if (!secret || !subject.userId || !subject.sessionId) return null;
  const binding = JSON.stringify([subject.userId, subject.sessionId]);
  return {
    key: `${purpose}:${createHash("sha256").update(binding).digest("hex")}`,
    hash: createHmac("sha256", deriveGrantKey(secret, `${purpose}-code`)).update(`${binding}:${code}`).digest("hex"),
  };
}

/** The recipient comes only from the authenticated, confirmed Supabase user. */
export async function sendEmailProofCode(purpose: EmailProofPurpose, subject: ResetGrantSubject, email: string): Promise<boolean> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const value = proof(purpose, subject, code);
  if (!value) return false;
  try {
    if ((await redisCommand(["SET", value.key, value.hash, "PX", TTL_MS])) !== "OK") return false;
    const mail = buildCodeEmail({ purpose, code, origin: resolvePublicOrigin(), support: supportEmail });
    const sent = await sendEmail({ to: email, ...mail });
    if (!sent) await redisCommand(["EVAL", CONSUME, 1, value.key, value.hash]);
    return sent;
  } catch {
    return false;
  }
}

/** Fails closed on missing configuration, expiry, a wrong session or purpose, or a replay. */
export async function consumeEmailProofCode(purpose: EmailProofPurpose, subject: ResetGrantSubject, input: string): Promise<boolean> {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const value = proof(purpose, subject, code);
  if (!value) return false;
  try {
    return (await redisCommand(["EVAL", CONSUME, 1, value.key, value.hash])) === 1;
  } catch {
    return false;
  }
}

export function sendAccountDeletionCode(subject: ResetGrantSubject, email: string): Promise<boolean> {
  return sendEmailProofCode("account-deletion", subject, email);
}

export function consumeAccountDeletionCode(subject: ResetGrantSubject, input: string): Promise<boolean> {
  return consumeEmailProofCode("account-deletion", subject, input);
}
