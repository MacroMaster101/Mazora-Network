"use server";

import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmailProofCode } from "@/lib/auth/account-deletion-proof";
import { hasOwnerGrant, issueOwnerGrant } from "@/lib/auth/owner-grant";
import { confirmAccountOwner, ownerGrantSubject, ownerProofFor } from "@/lib/auth/owner-confirmation";
import type { OwnerProof } from "@/lib/auth/owner-proof-kind";
import { throttleAuthAction } from "@/lib/rate-limit";

/**
 * "Confirm it's you" (lib/auth/owner-confirmation), shared by every change that
 * checks the owner pass: adding a passkey, linking Google or Discord, setting a
 * first password, and turning two-step verification on.
 */

export interface OwnerConfirmResult {
  ok: boolean;
  message?: string;
}

export interface OwnerConfirmStatus {
  /** False while a pass from the last 15 minutes still holds. */
  needed: boolean;
  proof: OwnerProof;
}

const UNAVAILABLE = "That couldn't be checked right now. Please try again.";
const EXPIRED = "Your session has expired. Sign in again.";

/** A completed sign-in: one still owing its two-step code, or a suspended account, is not. */
async function signedIn() {
  if (!(await getSession())) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

/** Whether the form must ask, and what it asks for. Null when signed out or unavailable. */
export async function ownerConfirmationStatusAction(): Promise<OwnerConfirmStatus | null> {
  const actor = await signedIn();
  if (!actor) return null;
  const proof = await ownerProofFor(actor.supabase, actor.user);
  if (!proof) return null;
  return { needed: !(await hasOwnerGrant(await ownerGrantSubject(actor.user.id))), proof };
}

/** Checks the proof and, on success, issues the owner pass for 15 minutes. */
export async function confirmAccountOwnerAction(formData: FormData): Promise<OwnerConfirmResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: EXPIRED };

  const throttled = await throttleAuthAction("owner-confirm", { limit: 10, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  const proofError = await confirmAccountOwner(actor.supabase, actor.user, formData);
  if (proofError) return { ok: false, message: proofError };

  if (!(await issueOwnerGrant(await ownerGrantSubject(actor.user.id)))) return { ok: false, message: UNAVAILABLE };
  return { ok: true };
}

/**
 * For accounts with no password and no authenticator: email a code that
 * confirms it's the owner. It goes only to the account's own confirmed address
 * and works only in this session.
 */
export async function sendOwnerEmailCodeAction(): Promise<OwnerConfirmResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: EXPIRED };

  const proof = await ownerProofFor(actor.supabase, actor.user);
  if (!proof) return { ok: false, message: UNAVAILABLE };
  if (proof !== "email") return { ok: false, message: "Confirm with your password or authenticator code instead." };
  if (!actor.user.email || !actor.user.email_confirmed_at) {
    return { ok: false, message: "A confirmed email address is needed to confirm it's you." };
  }

  const throttled = await throttleAuthAction("owner-email-send", { limit: 3, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  const sent = await sendEmailProofCode("account-change", await ownerGrantSubject(actor.user.id), actor.user.email);
  return sent
    ? { ok: true, message: "We sent a 6-digit code to your account email. It expires in 10 minutes." }
    : { ok: false, message: "The code couldn't be sent. Try again later." };
}
