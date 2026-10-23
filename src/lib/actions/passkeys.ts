"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSession, getSessionUserId, isTwoFactorPending, landingPathFor, twoFactorPath } from "@/lib/auth";
import { hasOwnerGrant } from "@/lib/auth/owner-grant";
import { ownerGrantSubject } from "@/lib/auth/owner-confirmation";
import { issuePasskeySignInGrant } from "@/lib/auth/passkey-signin-grant";
import { assertionUserVerified } from "@/lib/passkeys/user-verified";
import { passkeyAssertionSchema } from "@/lib/passkeys/assertion-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { STATUS_UNREADABLE, accountStatusFor } from "@/lib/data/account-status";
import { SUSPENDED_PATH } from "@/lib/auth/login-identifier";
import { endLocalSession } from "@/lib/auth/signup-trust";
import { dispatchSignInNotifications } from "@/lib/notifications-auto";
import { scheduleSecurityAlerts } from "@/lib/security-alerts";
import { throttleAuthAction } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { SESSION_ONLY_COOKIE, sessionOnlyMarkerOptions } from "@/lib/supabase/session-cookie";
import { recordAudit } from "@/lib/audit-log";

/**
 * Passkeys (Supabase Auth, WebAuthn), driven from the server.
 *
 * Every ceremony is two calls: the server fetches a challenge from Supabase,
 * the browser signs it with the passkey (src/lib/passkeys/webauthn-json.ts),
 * and the server verifies the answer. Keeping both ends here means a passkey
 * sign-in writes the session cookies exactly as the password sign-in does
 * (including "remember me"), and goes through the same checks afterwards.
 *
 * A passkey the device unlocked with a fingerprint, face or PIN counts as both
 * steps, as on GitHub and Google: the sign-in skips the authenticator code (see
 * finishPasskeySignInAction). One that only proved presence still owes it.
 *
 * Everything is behind Settings > "Passkey Sign-in" (site.general
 * passkeysEnabled), which stays off until Supabase Auth > Passkeys is set up
 * for the site's domain.
 */

export type PasskeyResult = { ok: true; message?: string; redirectTo?: string } | { ok: false; message: string };
export type PasskeyChallenge =
  | { ok: true; challengeId: string; options: Record<string, unknown> }
  | { ok: false; message: string };

const UNAVAILABLE = "Passkeys aren't available right now. Use your password or another sign-in option.";
const SIGN_IN_FAILED = "That passkey couldn't be used to sign in. Try again, or use your password.";
const EXPIRED = "That took too long. Try the passkey again.";
const CONFIRM_FIRST = "Confirm it's you again, then create the passkey.";
const CREDENTIAL_LIMIT = 20_000;

/** The browser's answer: a JSON object, small, as Supabase's verify endpoints expect. */
const credentialSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= CREDENTIAL_LIMIT, "Credential too large.");
const challengeIdSchema = z.string().trim().min(1).max(200);
const passkeyIdSchema = z.string().uuid();
const passkeyNameSchema = z
  .string()
  .transform((value) => value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069]/g, "").trim())
  .pipe(z.string().min(1, "Give the passkey a name.").max(60, "Keep the name under 60 characters."));

async function passkeysOn(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return (await getSiteGeneralSettings()).passkeysEnabled;
}


/** The Supabase session id inside an access token (the claim every session-bound pass is tied to). */
function sessionIdOf(accessToken: string | undefined): string {
  const payload = accessToken?.split(".")[1];
  if (!payload) return "";
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof claims.session_id === "string" ? claims.session_id : "";
  } catch {
    return "";
  }
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

/* ---------------------------------------------------------------- sign-in */

/** Step 1 of signing in: a challenge for the browser's passkey prompt. */
export async function startPasskeySignInAction(): Promise<PasskeyChallenge> {
  if (!(await passkeysOn())) return { ok: false, message: UNAVAILABLE };
  // Per address only: there is no account named yet (the passkey picks it).
  const throttled = await throttleAuthAction("passkey-login", { limit: 10, windowMs: 15 * 60_000 });
  if (throttled) return { ok: false, message: throttled };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: UNAVAILABLE };
  const { data, error } = await supabase.auth.passkey.startAuthentication();
  if (error || !data) return { ok: false, message: UNAVAILABLE };
  return { ok: true, challengeId: data.challenge_id, options: data.options as unknown as Record<string, unknown> };
}

/**
 * Step 2 of signing in: verify the signed challenge, then the same checks the
 * password sign-in (loginAction) runs once the password has matched: refuse an
 * unreadable account status, end a suspended account's session, send the
 * sign-in notices, and hand an account with two-step verification on to
 * /two-factor. Returns where to go next (`redirectTo`), always a path on this
 * site (safeNext, twoFactorPath or a fixed path).
 */
export async function finishPasskeySignInAction(input: {
  challengeId: string;
  credential: Record<string, unknown>;
  remember?: boolean;
  next?: string;
}): Promise<PasskeyResult> {
  if (!(await passkeysOn())) return { ok: false, message: UNAVAILABLE };
  const challengeId = challengeIdSchema.safeParse(input?.challengeId);
  const credential = passkeyAssertionSchema.safeParse(input?.credential);
  if (!challengeId.success || !credential.success) return { ok: false, message: SIGN_IN_FAILED };

  const throttled = await throttleAuthAction("passkey-login", { limit: 10, windowMs: 15 * 60_000 });
  if (throttled) return { ok: false, message: throttled };

  // "Remember me", as on the password form (see setSessionOnly in actions/auth).
  const remember = input.remember === true;
  const store = await cookies();
  if (remember) store.delete(SESSION_ONLY_COOKIE);
  else store.set(SESSION_ONLY_COOKIE, "1", sessionOnlyMarkerOptions());

  const supabase = await createSupabaseServerClient({ sessionOnly: !remember });
  if (!supabase) return { ok: false, message: UNAVAILABLE };

  const { data: signedIn, error } = await supabase.auth.passkey.verifyAuthentication({
    challengeId: challengeId.data,
    // Forward only this strict parse; the UV check below reads this same output.
    credential: credential.data,
  });
  if (error || !signedIn?.user) {
    return { ok: false, message: errorCode(error) === "webauthn_challenge_expired" ? EXPIRED : SIGN_IN_FAILED };
  }

  // Read once: both checks below must be about the same answer.
  const status = await accountStatusFor(signedIn.user.id);

  // Nothing says this account is not suspended, so refuse rather than guess.
  if (status === STATUS_UNREADABLE) {
    await endLocalSession(supabase);
    return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
  }

  /*
    Two-step verification, the industry way: a passkey the device unlocked with
    a fingerprint, face or PIN (the UV flag in the signed authenticator data,
    which Supabase has just verified) is two factors in one, so it also passes
    the second step, as on GitHub and Google. Supabase still issues an aal1
    session, so a signed pass for exactly this session records it (see
    lib/auth/passkey-signin-grant). A passkey that only proved presence leaves
    the member owing the authenticator code, as before.

    Issued before anything below asks who is signed in: getAuthState is worked
    out once per request, and must see the pass.
  */
  const hasAuthenticator = signedIn.user.factors?.some((factor) => factor.status === "verified") ?? false;
  const sessionId = sessionIdOf(signedIn.session?.access_token);
  const secondStepPassed =
    hasAuthenticator &&
    assertionUserVerified(credential.data) &&
    Boolean(sessionId) &&
    (await issuePasskeySignInGrant({ userId: signedIn.user.id, sessionId }));

  // Suspended: end the new session straight away. With two-step verification on
  // and still owed, it waits for the code, as the password sign-in does (the
  // /two-factor actions check it), so a passkey alone learns nothing either.
  if (status === "suspended" && (!hasAuthenticator || secondStepPassed)) {
    await endLocalSession(supabase);
    return { ok: true, redirectTo: SUSPENDED_PATH };
  }

  await dispatchSignInNotifications(await getSessionUserId());

  const session = await getSession();
  const requested = input.next && input.next !== "/" ? safeNext(input.next) : null;
  const destination = requested ?? (session ? landingPathFor(session.role) : "/");
  // Handed back rather than redirect()ed: the sign-in form loads it as a full
  // page, so the next page renders fresh with the new session cookies. An
  // in-app navigation from the sign-in dialog could be undone by the dialog or
  // a dev-server reload and leave the member on the page they started from.
  if (!session && (await isTwoFactorPending())) return { ok: true, redirectTo: twoFactorPath(destination) };
  return { ok: true, redirectTo: destination };
}

/* ------------------------------------------------------------ management */

/** A completed sign-in (getSession already enforces two-step and suspension). */
async function signedIn() {
  if (!(await passkeysOn())) return null;
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user, username: session.username };
}

/**
 * Adding a passkey adds a way into the account, so it needs the owner pass
 * (lib/auth/owner-grant): "Confirm it's you" from the last 15 minutes, issued by
 * confirmAccountOwnerAction in actions/owner-confirmation, the same check that
 * guards linking a login, setting a first password and turning on two-step.
 */
async function ownerConfirmed(actor: NonNullable<Awaited<ReturnType<typeof signedIn>>>): Promise<boolean> {
  return hasOwnerGrant(await ownerGrantSubject(actor.user.id));
}

/** Adding, step 2: with a fresh confirmation, get a challenge for the device prompt. */
export async function startPasskeyRegistrationAction(): Promise<PasskeyChallenge> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };

  const throttled = await throttleAuthAction("passkey-add", { limit: 10, windowMs: 15 * 60_000, identity: actor.user.id });
  if (throttled) return { ok: false, message: throttled };

  if (!(await ownerConfirmed(actor))) {
    return { ok: false, message: CONFIRM_FIRST };
  }

  const { data, error } = await actor.supabase.auth.passkey.startRegistration();
  if (error || !data) {
    return {
      ok: false,
      message: errorCode(error) === "too_many_passkeys" ? "You've reached the passkey limit. Remove one first." : UNAVAILABLE,
    };
  }
  return { ok: true, challengeId: data.challenge_id, options: data.options as unknown as Record<string, unknown> };
}

/**
 * Adding, step 3: store the new passkey, named after the authenticator holding
 * it (see below). The member can rename it afterwards.
 *
 * A device that already holds one of the member's passkeys cannot add a second:
 * Supabase lists every existing passkey in the registration options
 * (excludeCredentials), so the browser refuses before anything reaches here.
 */
export async function finishPasskeyRegistrationAction(input: {
  challengeId: string;
  credential: Record<string, unknown>;
  name?: string;
}): Promise<PasskeyResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };
  const challengeId = challengeIdSchema.safeParse(input?.challengeId);
  const credential = credentialSchema.safeParse(input?.credential);
  const name = passkeyNameSchema.safeParse(input?.name ?? "");
  if (!challengeId.success || !credential.success) return { ok: false, message: "The passkey couldn't be saved. Try again." };
  // The grant is checked again here: a challenge alone must not be enough.
  if (!(await ownerConfirmed(actor))) return { ok: false, message: CONFIRM_FIRST };

  const { data, error } = await actor.supabase.auth.passkey.verifyRegistration({
    challengeId: challengeId.data,
    credential: credential.data as never,
  });
  if (error || !data) {
    return { ok: false, message: errorCode(error) === "webauthn_challenge_expired" ? EXPIRED : "The passkey couldn't be saved. Try again." };
  }
  // Supabase names the passkey after the authenticator that holds it ("Windows
  // Hello", "Google Password Manager", "Apple Passwords"), from a public list of
  // authenticator models: the naming the big providers use. Only when it does
  // not recognise the model ("Passkey") is the device name used instead.
  const supabaseName = data.friendly_name?.trim() ?? "";
  const friendlyName =
    supabaseName && supabaseName !== "Passkey" ? supabaseName : name.success ? name.data : "Passkey";
  if (friendlyName !== supabaseName) {
    await actor.supabase.auth.passkey.update({ passkeyId: data.id, friendlyName });
  }

  await recordAudit({
    action: "auth.passkey_added",
    actorId: actor.user.id,
    by: actor.username,
    targetType: "user",
    targetId: actor.user.id,
    metadata: { passkeyId: data.id },
  });
  // Migration 079 queued "Passkey added"; send it now rather than at next sign-in.
  scheduleSecurityAlerts(actor.user.id);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: `Passkey added as "${friendlyName}". You can rename it any time.` };
}

export async function renamePasskeyAction(input: { passkeyId: string; name: string }): Promise<PasskeyResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };
  const passkeyId = passkeyIdSchema.safeParse(input?.passkeyId);
  const name = passkeyNameSchema.safeParse(input?.name);
  if (!passkeyId.success) return { ok: false, message: "That passkey no longer exists." };
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Give the passkey a name." };

  // Supabase scopes passkey.update to the signed-in user's own passkeys.
  const { error } = await actor.supabase.auth.passkey.update({ passkeyId: passkeyId.data, friendlyName: name.data });
  if (error) return { ok: false, message: "The passkey couldn't be renamed. Try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Passkey renamed." };
}

export async function deletePasskeyAction(input: { passkeyId: string }): Promise<PasskeyResult> {
  const actor = await signedIn();
  if (!actor) return { ok: false, message: "Your session has expired. Sign in again." };
  const passkeyId = passkeyIdSchema.safeParse(input?.passkeyId);
  if (!passkeyId.success) return { ok: false, message: "That passkey no longer exists." };

  // Supabase scopes passkey.delete to the signed-in user's own passkeys.
  const { error } = await actor.supabase.auth.passkey.delete({ passkeyId: passkeyId.data });
  if (error) return { ok: false, message: "The passkey couldn't be removed. Try again." };

  await recordAudit({
    action: "auth.passkey_removed",
    actorId: actor.user.id,
    by: actor.username,
    targetType: "user",
    targetId: actor.user.id,
    metadata: { passkeyId: passkeyId.data },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Passkey removed. It can no longer be used to sign in." };
}
