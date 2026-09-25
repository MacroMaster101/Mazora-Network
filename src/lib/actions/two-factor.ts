"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, getSignInSessionId, getTwoFactorPendingUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit-log";
import { throttleAuthAction } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { clearRecoveryCodes, issueRecoveryCodes } from "@/lib/auth/recovery-codes";
import { redeemRecoveryCode, removeAllFactors, removeFactor } from "@/lib/auth/two-factor-recovery";
import { clearRecoveryGrant, issueRecoveryGrant } from "@/lib/auth/recovery-grant";

/**
 * Optional two-step verification (TOTP, via Supabase Auth MFA), for every
 * account.
 *
 * Turned on from Settings by enrolling an authenticator app. From then on it
 * is a login gate: getSession() treats a sign-in as signed out until it
 * reaches assurance level aal2, which only a verified code produces. Recovery
 * codes (lib/auth/recovery-codes) cover a lost phone. Turning it off, replacing
 * the authenticator and regenerating codes all need a completed sign-in —
 * which, with two-step verification on, means one that entered its code.
 */

export interface TwoFactorEnrollment {
  ok: boolean;
  message?: string;
  factorId?: string;
  /** An SVG data URL of the authenticator QR code. */
  qrCode?: string;
  /** The same secret as text, for entering by hand. */
  secret?: string;
}

export interface TwoFactorResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Plain-text recovery codes, present only in the response that created them. */
  recoveryCodes?: string[];
}

const CODE_PATTERN = /^\d{6}$/;
const FACTOR_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const UNAVAILABLE = "Two-step verification is unavailable right now. Please try again.";

/** A completed sign-in: the only kind allowed to change two-step settings. */
async function signedIn() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user, username: session.username, recovered: Boolean(session.recoveredSignIn) };
}

/** A sign-in that still owes its code: allowed only to enter it (or a recovery code). */
async function pendingSignIn() {
  const user = await getTwoFactorPendingUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  return { supabase, user };
}

function qrDataUrl(qrCode: string): string {
  return qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf-8,${qrCode}`;
}

function readCode(formData: FormData): string | null {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

function refreshSettings() {
  revalidatePath("/dashboard/settings");
}

/**
 * Setup step 1 — turning it on, or replacing the authenticator: create a new,
 * unverified factor and hand back its QR code. An existing authenticator keeps
 * working until the new one is confirmed.
 */
export async function startTwoFactorEnrollmentAction(): Promise<TwoFactorEnrollment> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };

  const throttled = await throttleAuthAction("mfa-enroll", { limit: 10, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  const { data: factors, error: listError } = await actor.supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, message: UNAVAILABLE };

  // Abandoned setups leave unverified factors behind, and Supabase caps how
  // many an account may hold. None of them was ever usable, so clear them.
  for (const factor of factors.all.filter((f) => f.status !== "verified")) {
    await actor.supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const enroll = () =>
    actor.supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Mazora",
      // Friendly names must be unique per account.
      friendlyName: `Mazora ${new Date().toISOString().slice(0, 19)}`,
    });
  let { data, error } = await enroll();

  /*
    Replacing after signing in with a recovery code (a lost phone): Supabase
    only lets an aal2 session add a factor while a verified one exists, and a
    recovery-code sign-in is not aal2. The old authenticator is what was lost,
    so it is removed first and the new one set up in its place.
  */
  if (error?.code === "insufficient_aal" && actor.recovered && (await removeAllFactors(actor.user.id))) {
    ({ data, error } = await enroll());
  }
  if (error || !data) {
    console.error("Two-factor enrolment failed:", { code: error?.code, message: error?.message });
    return { ok: false, message: "Two-step verification could not be set up. Please try again." };
  }

  return { ok: true, factorId: data.id, qrCode: qrDataUrl(data.totp.qr_code), secret: data.totp.secret };
}

/**
 * Setup step 2: confirm the new authenticator with its first code. On a first
 * setup this also issues the recovery codes; on a replacement the old
 * authenticator is removed and the existing recovery codes stay valid.
 */
export async function confirmTwoFactorSetupAction(_previous: TwoFactorResult, formData: FormData): Promise<TwoFactorResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };

  const code = readCode(formData);
  if (!code) return { ok: false, errors: { code: "Enter the six-digit code from your authenticator app." } };

  const throttled = await throttleAuthAction("mfa-verify", { limit: 5, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  const factorId = String(formData.get("factorId") ?? "");
  const { data: factors, error: listError } = await actor.supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, message: UNAVAILABLE };

  // Only the unverified factor this account just enrolled.
  const factor = FACTOR_ID_PATTERN.test(factorId)
    ? factors.all.find((f) => f.id === factorId && f.factor_type === "totp" && f.status !== "verified")
    : undefined;
  if (!factor) return { ok: false, message: "This setup has expired. Close it and start again." };

  const previous = factors.totp;
  const { error } = await actor.supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { ok: false, errors: { code: "That code is incorrect or has expired." } };

  // Replacing: the old authenticator stops working now the new one is proven.
  // Checked, with the service role as fallback: a lost phone left behind as a
  // second verified factor would keep working for whoever has it.
  for (const old of previous) {
    const { error: unenrollError } = await actor.supabase.auth.mfa.unenroll({ factorId: old.id });
    if (unenrollError) await removeFactor(actor.user.id, old.id);
  }

  const replacing = previous.length > 0;
  const recoveryCodes = replacing ? undefined : ((await issueRecoveryCodes(actor.user.id)) ?? undefined);
  // The session is aal2 now; a recovery pass it may have carried is spent.
  await clearRecoveryGrant();

  await recordAudit({
    action: replacing ? "auth.two_factor_replaced" : "auth.two_factor_enabled",
    actorId: actor.user.id,
    by: actor.username,
    targetType: "mfa_factor",
    targetId: factor.id,
  });

  refreshSettings();
  return {
    ok: true,
    message: replacing ? "Your new authenticator app is set up." : "Two-step verification is on.",
    recoveryCodes,
  };
}

/** Sign-in step 2: the code from the authenticator app. Success completes the sign-in. */
export async function verifyTwoFactorAction(_previous: TwoFactorResult, formData: FormData): Promise<TwoFactorResult> {
  const pending = await pendingSignIn();
  if (!pending) return { ok: false, message: "Your session has expired. Sign in again." };

  const code = readCode(formData);
  if (!code) return { ok: false, errors: { code: "Enter the six-digit code from your authenticator app." } };

  // Bucketed per account, so a stolen password cannot be paired with a
  // brute-forced code by spreading guesses across addresses.
  const throttled = await throttleAuthAction("mfa-verify", { limit: 5, windowMs: 15 * 60_000, identity: pending.user.id });
  if (throttled) return { ok: false, message: throttled };

  const { data: factors, error: listError } = await pending.supabase.auth.mfa.listFactors();
  if (listError || !factors?.totp.length) return { ok: false, message: UNAVAILABLE };

  // Normally one authenticator; mid-replacement there can briefly be two, and a
  // code from either is valid. The throttle above counts this as one attempt.
  let verified = false;
  for (const factor of factors.totp) {
    const { error } = await pending.supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (!error) {
      verified = true;
      break;
    }
  }
  if (!verified) return { ok: false, errors: { code: "That code is incorrect or has expired." } };

  const nextValue = formData.get("next");
  redirect(safeNext(typeof nextValue === "string" ? nextValue : undefined));
}

/**
 * Sign in with a recovery code instead of the authenticator — the
 * industry-standard way. The code is used up; two-step verification, the
 * authenticator and the other codes all stay. A code cannot raise the Supabase
 * session to aal2, so this session gets a signed recovery pass instead
 * (lib/auth/recovery-grant), which getSession accepts. The member lands on
 * Settings, where the card offers to replace the authenticator.
 */
export async function redeemRecoveryCodeAction(_previous: TwoFactorResult, formData: FormData): Promise<TwoFactorResult> {
  const pending = await pendingSignIn();
  if (!pending) return { ok: false, message: "Your session has expired. Sign in again." };

  const input = String(formData.get("recoveryCode") ?? "");
  if (!input.trim()) return { ok: false, errors: { recoveryCode: "Enter one of your recovery codes." } };

  const throttled = await throttleAuthAction("mfa-recovery", { limit: 5, windowMs: 15 * 60_000, identity: pending.user.id });
  if (throttled) return { ok: false, message: throttled };

  const outcome = await redeemRecoveryCode(pending.user, input, "sign-in");
  if (!outcome.ok) {
    return { ok: false, errors: { recoveryCode: "That recovery code is incorrect or has already been used." } };
  }

  const sessionId = await getSignInSessionId();
  if (!sessionId || !(await issueRecoveryGrant({ userId: pending.user.id, sessionId }))) {
    return { ok: false, message: UNAVAILABLE };
  }

  redirect("/dashboard/settings");
}

/** Replace the recovery codes with a fresh set; the old ones stop working. */
export async function regenerateRecoveryCodesAction(): Promise<TwoFactorResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };

  const throttled = await throttleAuthAction("mfa-recovery-codes", { limit: 5, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  const { data: factors, error: listError } = await actor.supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, message: UNAVAILABLE };
  if (factors.totp.length === 0) return { ok: false, message: "Turn on two-step verification first." };

  const recoveryCodes = await issueRecoveryCodes(actor.user.id);
  if (!recoveryCodes) return { ok: false, message: UNAVAILABLE };

  await recordAudit({
    action: "auth.two_factor_codes_regenerated",
    actorId: actor.user.id,
    by: actor.username,
    targetType: "user",
    targetId: actor.user.id,
  });

  refreshSettings();
  return { ok: true, message: "New recovery codes created. Your old codes no longer work.", recoveryCodes };
}

/** Turn two-step verification off: every authenticator and recovery code goes. */
export async function disableTwoFactorAction(): Promise<TwoFactorResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };

  const throttled = await throttleAuthAction("mfa-disable", { limit: 5, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  // The service role removes the factors, so this also works from a sign-in
  // that used a recovery code (not aal2, which the member's own client needs).
  if (!(await removeAllFactors(actor.user.id))) {
    return { ok: false, message: "Two-step verification could not be turned off. Please try again." };
  }
  await clearRecoveryCodes(actor.user.id);
  await clearRecoveryGrant();

  await recordAudit({
    action: "auth.two_factor_disabled",
    actorId: actor.user.id,
    by: actor.username,
    targetType: "user",
    targetId: actor.user.id,
  });

  refreshSettings();
  return { ok: true, message: "Two-step verification is off." };
}
