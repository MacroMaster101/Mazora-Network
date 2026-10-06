"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { SESSION_ONLY_COOKIE, sessionOnlyMarkerOptions } from "@/lib/supabase/session-cookie";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/types";
import { createSession, getSession, getSessionUserId, isRoleKey, isStaff, landingPathFor, normalizeRoleKey, isTwoFactorPending, hasActiveSession, pickDiscordIdentity, twoFactorPath } from "@/lib/auth";
import { ensureRoleCatalog } from "@/lib/data/roles";
import { ensureUserProfile } from "@/lib/auth/profile";
import { site } from "@/lib/site";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { getSupabaseConfig, isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ignAvailability, linkMinecraftIgn } from "@/lib/minecraft/link";
import { dispatchSignInNotifications } from "@/lib/notifications-auto";
import { throttleAuthAction } from "@/lib/rate-limit";
import { SIGN_IN_FAILED, SUSPENDED_PATH, UNRESOLVED_IDENTIFIER, looksLikeEmail } from "@/lib/auth/login-identifier";
import { STATUS_UNREADABLE, accountStatusFor } from "@/lib/data/account-status";
import { accountHasPassword, passwordMatchesCurrent } from "@/lib/auth/reauth";
import { getDb } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import {
  authFormValues,
  authValidationErrors,
  loginSchema,
  newPasswordSchema,
  otpTypes,
  registerSchema,
  resetCodeSchema,
  resetRequestSchema,
  type OtpType,
} from "@/lib/validation/auth";
import { isPasswordBreached, PWNED_PASSWORD_MESSAGE } from "@/lib/auth/pwned-password";
import { clearResetGrant, hasResetGrant, issueResetGrant } from "@/lib/auth/reset-grant";
import {
  clearResetRequestMarker,
  hasResetRequestMarker,
  markResetRequested,
  resetRequestedHereFor,
} from "@/lib/auth/reset-request";
import {
  endLocalSession,
  findAccountByConfirmationToken,
  findAccountByEmail,
  findAccountByRecoveryToken,
  recordPasswordSet,
  removeAccountPassword,
  replacePendingSignup,
  resetUnprovenNames,
} from "@/lib/auth/signup-trust";
import {
  SIGNUP_LINK_ELSEWHERE,
  UNPROVEN_SIGNUP_MESSAGE,
  UNPROVEN_SIGNUP_UNSECURED,
  classifyPasswordProbe,
  confirmedBeforeVerifying,
  emailStanding,
  firstSignupConfirmation,
  planRegistration,
  resetConfirmedTheEmail,
  resetMayResetNames,
  signupLinkStanding,
  signupProvenHere,
  type PasswordProbe,
} from "@/lib/auth/signup-trust-core";
import { classifyPasswordUpdateError, normaliseReauthCode } from "@/lib/auth/password-reauth";
import { redeemRecoveryCode } from "@/lib/auth/two-factor-recovery";
import type { User } from "@supabase/supabase-js";

export interface AuthResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Set by loginAction when credentials were correct but the account's email isn't confirmed yet. */
  unverifiedEmail?: string;
  /** Set by updatePasswordAction when Supabase wants the emailed reauthentication code. */
  needsCode?: boolean;
  /** Set by finishPasswordResetAction when the account also needs its two-step code. */
  needsTwoFactor?: boolean;
}

/** Supabase's distinct error for "credentials correct, email not confirmed" — matched by
 * code first (current API) with a message fallback (older client versions). */
function isUnconfirmedEmailError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_not_confirmed") return true;
  return /email not confirmed/i.test(error.message ?? "");
}

/**
 * Restricts a post-auth redirect target to a same-origin path. Checking only
 * for a leading "//" is not enough: browsers strip ASCII tab/CR/LF anywhere
 * in a URL and treat a backslash the same as a forward slash before
 * resolving it (WHATWG URL spec), so "/\evil.com" or "/\t/evil.com" both
 * look like safe same-origin paths to a naive check but actually resolve to
 * "https://evil.com" once the browser follows the redirect. Normalizing the
 * same way before checking closes that open-redirect bypass.
 */
function safeNext(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const normalized = value.replace(/[\t\r\n]/g, "").replace(/\\/g, "/");
  return normalized.startsWith("/") && !normalized.startsWith("//") ? normalized : fallback;
}

/**
 * Takes the user verifyOtp just returned rather than asking the auth server
 * again: an unproven confirmation ends the new session before this runs.
 *
 * `linkIgn` is false when nothing shows the registration details are this
 * visitor's (the confirming browser is not the one that registered the
 * account): the IGN in the metadata may be someone else's choice, and a
 * Minecraft link decides where purchases go.
 */
async function linkVerifiedRegistration(user: User | null, linkIgn: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!user) return;

  // The account is verified from here on, so the fixed default templates fire
  // whether or not an IGN link follows. Best-effort — it never blocks signup.
  await dispatchSignInNotifications(user.id);

  if (!admin || !linkIgn) return;

  const username = String(user.user_metadata?.username ?? "").trim();
  if (!username) return;

  const availability = await ignAvailability(admin, username, user.id);
  if (!availability.available) return;

  await linkMinecraftIgn(admin, user.id, username).catch((error) => {
    console.error("Verified registration IGN link failed:", error);
  });
}

/**
 * Marks the browser whose registration produced an account, holding that
 * account's id. It decides two things at confirmation (lib/auth/signup-trust):
 *
 * - whose password the account keeps. Anyone can register a stranger's address
 *   with a password of their own; only a confirmation from the browser that
 *   created that exact account keeps the password on it.
 * - who is signed in. Anyone can mail a victim the link to their OWN pending
 *   account; without this, one "Confirm" click signed the victim into the
 *   sender's account — the same login CSRF the magiclink type was dropped for
 *   (lib/validation/auth).
 *
 * Lasts as long as the link does.
 */
const PENDING_SIGNUP_COOKIE = "mz_pending_signup";

/**
 * One answer for a reset link opened where no matching reset was asked for.
 * Never says whose account it was. It does not point at the emailed code: a
 * code can only be typed after asking for a reset, and asking again replaces it.
 */
const RESET_LINK_ELSEWHERE =
  "This reset link only works in the browser that asked for it. To continue here, request a new reset from this device.";

/** Registration stopped part-way for a reason that is not about the address. Nothing was created. */
const REGISTRATION_UNFINISHED =
  "We couldn't finish creating that account right now. Please try again in a few minutes.";

const USERNAME_TAKEN = "That Minecraft username is already taken. Please choose another.";

/** One answer for an emailed link that cannot be used, whatever the reason. */
const LINK_INVALID = "This link is invalid or has expired. Request a new one from the login page.";

async function markPendingSignup(userId: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_SIGNUP_COOKIE, userId, { ...sessionOnlyMarkerOptions(), maxAge: 24 * 60 * 60 });
}

/**
 * Call right after a sign-up verification succeeds and BEFORE
 * settleSignupConfirmation. True when the verification is not what confirmed
 * the account: it was confirmed long before, or it is a staff invitation.
 *
 * That happens because the auth server's `email` link type also accepts a
 * password-reset token, so a reset link edited to say `type=email` verifies on
 * an old account (lib/validation/auth). Settling that as a new sign-up would
 * remove the owner's password and names, so nothing on the account is touched:
 * this browser's session is ended and the caller answers as for a bad link.
 * It applies even when the marker names this very account, so the branch
 * never yields a session for an account it did not just confirm. The marker is
 * left for the visitor's own registration, if they have one.
 */
async function notAFirstSignupConfirmation(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  user: User | null,
  confirmedBefore: boolean | null,
): Promise<boolean> {
  const first = firstSignupConfirmation({
    confirmedBefore,
    emailConfirmedAt: user?.email_confirmed_at,
    invitedAt: user?.invited_at,
    nowMs: Date.now(),
  });
  if (first) return false;
  console.error("A sign-up verification landed on an account it did not just confirm; nothing was changed");
  await endLocalSession(supabase);
  return true;
}

/**
 * Call right after a sign-up confirmation succeeds, with the user verifyOtp
 * returned, once notAFirstSignupConfirmation has let it through. Null when
 * this browser registered the account: its password and
 * names are this visitor's, and they stay signed in.
 *
 * Otherwise the email is confirmed but nothing shows the password is the
 * owner's, so it is removed, the names typed at registration go back to the
 * placeholders, no Minecraft name is linked and no session is kept. The owner
 * chooses a password through "Forgot password", which needs the inbox.
 *
 * Fails closed: if the password could not be removed the visitor is still
 * signed out, and is told so as an error rather than a success.
 */
async function settleSignupConfirmation(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  user: User | null,
): Promise<AuthResult | null> {
  const store = await cookies();
  const registeredHere = signupProvenHere(store.get(PENDING_SIGNUP_COOKIE)?.value, user?.id);
  store.delete(PENDING_SIGNUP_COOKIE);
  if (registeredHere) {
    await linkVerifiedRegistration(user, true);
    return null;
  }

  // The password first: it is what lets a stranger in.
  const removal = user ? await removeAccountPassword(user.id) : "failed";
  if (user) await resetUnprovenNames(user.id);
  await endLocalSession(supabase);
  if (removal === "failed") {
    console.error("An unproven sign-up was confirmed but its password could not be removed");
    return { ok: false, message: UNPROVEN_SIGNUP_UNSECURED };
  }
  await linkVerifiedRegistration(user, false);
  return { ok: true, message: UNPROVEN_SIGNUP_MESSAGE };
}

/**
 * Call right after a password-reset verification, before the reset grant.
 *
 * A reset code or link also confirms the email of an account that never was
 * confirmed, and that account's password is whatever its first registrant
 * typed. When this verification is what confirmed the email, the password is
 * removed at once rather than left working until the new one is chosen (or for
 * good, if the visitor stops here). The recovery session is kept, so the
 * visitor goes straight on to choose a password.
 *
 * Returns what to show when the reset cannot go on; null when it can.
 */
async function distrustPasswordAfterFirstConfirmation(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  user: User | null,
  confirmedBefore: boolean | null,
): Promise<AuthResult | null> {
  const firstConfirmation = resetConfirmedTheEmail({
    confirmedBefore,
    emailConfirmedAt: user?.email_confirmed_at,
    nowMs: Date.now(),
  });
  if (!firstConfirmation) return null;

  const removal = user ? await removeAccountPassword(user.id) : "failed";
  if (user && removal === "removed") {
    // The names are kept for the browser that registered this account, and
    // whenever only the clock says this was a first confirmation: an account
    // confirmed minutes ago by its owner looks the same, and its names are theirs.
    const store = await cookies();
    if (signupProvenHere(store.get(PENDING_SIGNUP_COOKIE)?.value, user.id)) store.delete(PENDING_SIGNUP_COOKIE);
    else if (resetMayResetNames(confirmedBefore)) await resetUnprovenNames(user.id);
    return null;
  }
  // "replaced" ended the recovery session along with every other one, and
  // "failed" left the old password in place. Either way this reset stops here.
  // The email is confirmed now, so the next request is an ordinary reset and
  // ends with a password the visitor chose.
  if (removal === "failed") console.error("A reset confirmed an email but the old password could not be removed");
  await endLocalSession(supabase);
  return { ok: false, message: "We couldn't start the reset. Request a new code and try again." };
}

/** Record (or clear) the "don't remember me" choice for this browser. */
async function setSessionOnly(sessionOnly: boolean): Promise<void> {
  const store = await cookies();
  if (sessionOnly) store.set(SESSION_ONLY_COOKIE, "1", sessionOnlyMarkerOptions());
  else store.delete(SESSION_ONLY_COOKIE);
}

const usernameFromIdentifier = (identifier: string) =>
  (identifier.includes("@") ? identifier.split("@")[0] : identifier).replace(/[^a-zA-Z0-9_]/g, "");

/**
 * Proves that a caller resuming an unfinished registration knows that pending
 * account's password. Supabase deliberately returns `email_not_confirmed` only
 * after the credentials are valid; an incorrect password returns the same
 * generic invalid-credentials error used for unknown accounts.
 *
 * The isolated client cannot persist the probe session or alter the browser's
 * real cookie-bound session.
 *
 * Three answers, not two: a rate limit, a network failure or a server error
 * says nothing about the password, and must never be read as "wrong" (which
 * deletes the pending account) or as "opens" (which trusts it).
 */
async function pendingRegistrationCredentialsMatch(email: string, password: string): Promise<PasswordProbe> {
  const config = getSupabaseConfig();
  if (!config) return "unknown";
  const probe = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { error } = await probe.auth.signInWithPassword({ email, password });
    const answer = classifyPasswordProbe(error);
    if (answer === "unknown") {
      console.error("Pending-registration password probe was inconclusive:", { status: error?.status, code: error?.code });
    }
    return answer;
  } catch {
    console.error("Pending-registration password probe could not reach the auth server");
    return "unknown";
  }
}

/**
 * The email a username belongs to, or the sentinel when it belongs to nobody.
 *
 * Runs on the app's own connection rather than the anon client on purpose:
 * `profiles` is RLS-protected and an unauthenticated reader sees nothing, which
 * is exactly right for the public API and exactly wrong here, where the server
 * must look the address up on the caller's behalf without ever revealing it.
 *
 * Never returns null. A miss yields UNRESOLVED_IDENTIFIER so the caller still
 * makes the same Supabase round-trip it would for a real account — an unknown
 * username must not fail faster, or more quietly, than a wrong password.
 */
async function resolveLoginEmail(identifier: string): Promise<string> {
  if (looksLikeEmail(identifier)) return identifier.toLowerCase();

  const db = getDb();
  if (!db) return UNRESOLVED_IDENTIFIER;

  try {
    // Matches profiles_username_lower_idx, the unique index on lower(username),
    // so this is an index lookup and casing never matters.
    const result = await db.execute(
      sql`select u.email
          from auth.users u
          join public.profiles p on p.user_id = u.id
          where lower(p.username) = lower(${identifier})
          limit 1`,
    );
    const rows = result as unknown as Array<{ email?: string | null }>;
    const email = rows?.[0]?.email;
    return typeof email === "string" && email ? email.toLowerCase() : UNRESOLVED_IDENTIFIER;
  } catch (error) {
    console.error("Username lookup failed", error);
    return UNRESOLVED_IDENTIFIER;
  }
}

export async function loginAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  // Bucketed per address *and* per submitted email, so spraying one account is
  // capped without a shared NAT locking out everyone behind it.
  const throttled = await throttleAuthAction("login", {
    limit: 8,
    windowMs: 15 * 60_000,
    identity: parsed.data.identifier,
  });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    /*
      "Remember me". Unticked, this sign-in ends when the browser closes: the
      marker cookie tells every later cookie refresh to keep the auth cookies
      session-only (lib/supabase/session-cookie), and this client applies it to
      the cookies the sign-in itself writes.
    */
    const remember = formData.get("remember") === "on";
    await setSessionOnly(!remember);
    const supabase = await createSupabaseServerClient({ sessionOnly: !remember });
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    // A username is translated to its address here; an email passes through.
    const loginEmail = await resolveLoginEmail(parsed.data.identifier);

    const { data: signedIn, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: parsed.data.password,
    });
    if (error) {
      if (isUnconfirmedEmailError(error)) {
        // The auth server only says "not confirmed" once the password has
        // matched, so this browser has just proved it knows the pending
        // account's password: the same thing the marker stands for after a
        // registration. Without it, a confirmation link opened here (after
        // "resend", on a device that did not register) would be refused.
        const pending = await findAccountByEmail(loginEmail);
        if (pending.status === "found" && emailStanding(pending.account) === "pending") {
          await markPendingSignup(pending.account.id);
        }
        return {
          ok: false,
          message: "Verify your email before logging in — check your inbox for the confirmation link.",
          // The RESOLVED address, never what was typed. Returning the username
          // here would hand the resend-confirmation flow something it cannot
          // send to, and would echo the account's login name back to whoever
          // guessed it.
          unverifiedEmail: loginEmail,
        };
      }
      return { ok: false, message: SIGN_IN_FAILED };
    }

    // Read once: both checks below must be about the same answer.
    const status = signedIn.user ? await accountStatusFor(signedIn.user.id) : null;

    // The status could not be read at all, so nothing says this account is not
    // suspended. Refuse the sign-in rather than guess; it is not about this
    // account, so saying so reveals nothing.
    if (status === STATUS_UNREADABLE) {
      await endLocalSession(supabase);
      return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
    }

    // Suspended from the Users board. Shown only once the password has matched,
    // so it tells someone guessing at accounts nothing; the new session is
    // ended straight away, then /account-suspended explains how to appeal.
    // With two-step verification on it waits for the code too (the /two-factor
    // actions check it), so a leaked password alone learns nothing either.
    const hasAuthenticator = signedIn.user?.factors?.some((factor) => factor.status === "verified") ?? false;
    if (status === "suspended" && !hasAuthenticator) {
      await endLocalSession(supabase);
      redirect(SUSPENDED_PATH);
    }

    // Fire the fixed default templates before any redirect — redirect() throws
    // to unwind the request, so anything after it never runs. The welcome
    // notice is a no-op once an account already has one, which is also what
    // backfills accounts created before this dispatch existed.
    await dispatchSignInNotifications(await getSessionUserId());

    // Honour an explicit destination; otherwise land on home (every role).
    const session = await getSession();
    const destination =
      parsed.data.next && parsed.data.next !== "/" ? safeNext(parsed.data.next) : session ? landingPathFor(session.role) : "/";
    // An account with two-step verification on is not signed in until its code
    // is entered (see getSession), so the code comes next.
    if (!session && (await isTwoFactorPending())) redirect(twoFactorPath(destination));
    redirect(destination);
  }

  if (!isDemoAuthEnabled()) return { ok: false, message: "Authentication has not been configured yet." };
  const username = usernameFromIdentifier(parsed.data.identifier) || "player";
  const session = await createSession(username);
  if (parsed.data.next && parsed.data.next !== "/") redirect(safeNext(parsed.data.next));
  redirect(landingPathFor(session.role));
}

export async function registerAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const siteSettings = await getSiteGeneralSettings();
  if (!siteSettings.registrationEnabled) {
    return { ok: false, message: "New user registrations are currently paused by the server administration." };
  }

  const parsed = registerSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  const throttled = await throttleAuthAction("register", {
    limit: 5,
    windowMs: 60 * 60_000,
    identity: parsed.data.email,
  });
  if (throttled) return { ok: false, message: throttled };

  /*
    Breach check after the throttle, never before: it makes an outbound request,
    and running it on unthrottled input would let anyone use this endpoint to
    hammer a third-party API on our behalf.

    Supabase does this natively as "leaked password protection", but only from
    the Pro plan up. It fails open — see lib/auth/pwned-password.
  */
  if (await isPasswordBreached(parsed.data.password)) {
    return { ok: false, errors: { password: PWNED_PASSWORD_MESSAGE } };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    const admin = getSupabaseAdmin();

    /*
      What already exists for this address is asked first, before anything is
      sent. The auth server leaves an existing unconfirmed account untouched on
      a second sign-up, so its password stays the FIRST registrant's: someone
      could register a stranger's address, wait for the owner to register and
      confirm it, then log in with the password they chose. A pending account
      whose password is not the one just typed is therefore deleted and the
      address registered afresh (lib/auth/signup-trust), which gives this
      visitor's password, a new account id and a confirmation email that works.

      Fail closed: with no answer, nothing is created.
    */
    const lookup = await findAccountByEmail(parsed.data.email);
    if (lookup.status === "unreadable") return { ok: false, message: REGISTRATION_UNFINISHED };

    // Reject a taken username up front so the person consciously picks a unique
    // handle, rather than the signup trigger silently suffixing it after the
    // fact (`unique_username` in the migrations). The IGN is checked against
    // both namespaces it will occupy — the site handle and the Minecraft link.
    const availability = admin ? await ignAvailability(admin, parsed.data.username) : ({ available: true } as const);

    const plan = await planRegistration({
      existing: lookup.status === "found" ? lookup.account : null,
      username: availability,
      passwordOpens: () => pendingRegistrationCredentialsMatch(parsed.data.email, parsed.data.password),
    });

    if (plan.step === "refuse-username") return { ok: false, errors: { username: USERNAME_TAKEN } };

    // The typed password could not be tried against the pending account (the
    // auth server was rate limiting, unreachable or failing). Nothing is
    // deleted, created or emailed on a guess; trying again later settles it.
    if (plan.step === "unfinished") return { ok: false, message: REGISTRATION_UNFINISHED };

    // A staff invite holds this address. It is accepted through its own link,
    // and a sign-up here would overwrite that link's token, so nothing is sent
    // or changed. The answer is the one a confirmed address gets.
    if (plan.step === "neutral") {
      await markPendingSignup(randomUUID());
      return { ok: true };
    }

    // The same person again, same password and name. Do not send mail from a
    // registration collision: the OTP screen's explicit Resend action owns
    // that side effect and has its own stricter rate limit.
    if (plan.step === "resume") {
      await markPendingSignup(plan.userId);
      return { ok: true, message: "Your pending registration was found. Enter the code to continue." };
    }

    if (plan.step === "replace") {
      if (!admin || !(await replacePendingSignup(admin, plan.userId, parsed.data.email))) {
        return { ok: false, message: REGISTRATION_UNFINISHED };
      }
      // The deleted account's own claim on the name is gone. Anyone else's is
      // still a conflict.
      if (!(await ignAvailability(admin, parsed.data.username)).available) {
        return { ok: false, errors: { username: USERNAME_TAKEN } };
      }
    }

    // emailRedirectTo intentionally omitted: the Confirm signup template links
    // to /confirm-email?token_hash=...&type=email (built from {{ .SiteURL }}
    // and {{ .TokenHash }}) rather than {{ .ConfirmationURL }}, so this option
    // no longer affects anything.
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      // Name and username are now distinct: the trigger stores display_name as
      // the chosen name and username as the IGN (which becomes the @handle).
      options: {
        data: { username: parsed.data.username, display_name: parsed.data.displayName },
      },
    });
    if (error) {
      // The real reason is logged server-side so a failed signup is actually
      // diagnosable, while the user-facing message stays generic for the
      // account-related cases (it must not reveal whether an email already
      // exists — that would be an enumeration oracle).
      console.error("Registration signUp failed:", { status: error.status, code: error.code, message: error.message });
      // A confirmation-email delivery failure is an infrastructure problem, not
      // an account one: it says nothing about whether the email exists, so it is
      // safe — and far less confusing — to name it instead of telling the user
      // to "try another email" when their email was fine. (Common on projects
      // using Supabase's rate-limited built-in email with no custom SMTP.)
      const emailSendFailed = /sending.*email|email.*(?:send|deliver)/i.test(error.message ?? "");
      return {
        ok: false,
        message: emailSendFailed
          ? "We couldn't send your confirmation email right now. Please wait a few minutes and try again."
          : "That account could not be created. Try another email or sign in instead.",
      };
    }

    // Supabase returns an obfuscated user with no identities for duplicate
    // signups. Never create public/profile data for that placeholder. The OTP
    // screen remains intentionally neutral so this cannot enumerate emails;
    // the marker is set to an id that belongs to nobody for the same reason,
    // so its presence does not tell a new address from a confirmed one.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      await markPendingSignup(randomUUID());
      return { ok: true };
    }

    // Keep account creation complete even on projects where the database
    // signup trigger has not been applied yet.
    if (data.user && admin && !(await ensureUserProfile(data.user))) {
      // Not a bare delete: the auth server can answer a sign-up with an
      // account that already existed (someone's pending registration, or an
      // invite created a moment ago), and only a never-confirmed, never-used
      // self sign-up for this address may go.
      await replacePendingSignup(admin, data.user.id, parsed.data.email);
      return { ok: false, message: "That account could not be created. Try another username or email." };
    }

    /*
      Last check before this browser is marked as the registrant, because the
      marker is what lets a confirmation keep the password: does the password
      just typed open the account the auth server answered with? For a new
      account it always does. It does not when someone registered the address
      between the lookup above and the sign-up, so the sign-up landed on THEIR
      pending account. No clocks are compared. A probe with no clear answer
      (rate limited, unreachable) is not proof either way and also stops here;
      trying again resumes or replaces the account.
    */
    if (
      data.user &&
      !data.session &&
      (await pendingRegistrationCredentialsMatch(parsed.data.email, parsed.data.password)) !== "opens"
    ) {
      // Fail closed: no marker, so a confirmation from this browser cannot
      // keep a password that may be someone else's. Nothing is deleted here.
      return { ok: false, message: REGISTRATION_UNFINISHED };
    }

    if (data.user) await markPendingSignup(data.user.id);
    if (data.session) redirect("/");
    // No redirect here: the modal is already mounted client-side, and routing
    // through /?auth=verify-email forces Next.js to re-render the whole home
    // page (including its live player/Discord counts) before the popup can
    // even mount, flashing the root loading splash. RegisterForm instead
    // swaps to the "check your inbox" state locally once it sees ok: true —
    // an instant client-side transition, same as the forgot-password steps.
    return { ok: true };
  }

  if (!isDemoAuthEnabled()) return { ok: false, message: "Authentication has not been configured yet." };
  await createSession(parsed.data.username, parsed.data.displayName);
  redirect("/");
}

export async function oauthAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const provider = formData.get("provider");
  if (provider !== "google" && provider !== "discord") {
    return { ok: false, message: "That sign-in provider is not supported." };
  }

  const throttled = await throttleAuthAction(`oauth-start:${provider}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (throttled) return { ok: false, message: throttled };

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Connect Supabase and enable this provider before using social login." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
  const nextValue = formData.get("next");
  const next = safeNext(typeof nextValue === "string" ? nextValue : undefined);
  const oauthOptions = {
    redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}`,
    skipBrowserRedirect: true,
    // Discord silently re-approves the account already authorised in this
    // browser, so someone trying to use a second account is handed the first
    // one back without ever being asked. `prompt=consent` forces the authorise
    // screen, which carries Discord's own "not you?" account switcher.
    ...(provider === "discord" ? { queryParams: { prompt: "consent" } } : {}),
  };

  // A signed-in visitor is LINKING the provider to their current account, not
  // switching accounts. signInWithOAuth would silently log them into a
  // different account whenever the provider email differs. Requires the
  // "Manual Linking" toggle in Supabase Authentication settings.
  const { data: existingUser } = await supabase.auth.getUser();
  // Linking changes the account, so a sign-in still owing its two-step code
  // (or a suspended account) does not count as signed in here either.
  if (existingUser?.user && (await hasActiveSession())) {
    const linkThrottled = await throttleAuthAction("oauth-link", {
      limit: 10,
      windowMs: 15 * 60_000,
      identity: existingUser.user.id,
    });
    if (linkThrottled) return { ok: false, message: linkThrottled };

    // Refuse to attach a second identity for a provider the account already
    // has. Supabase happily allows it, and the result is an account holding two
    // Discord logins where nothing can say which one owns an order — the state
    // that made the store show a buyer their previous username.
    if (existingUser.user.identities?.some((identity) => identity.provider === provider)) {
      return {
        ok: false,
        message:
          provider === "discord"
            ? "This account already has a Discord connected. Use Switch to sign out and log in with the other account."
            : "This account already has Google connected.",
      };
    }

    const { data, error } = await supabase.auth.linkIdentity({ provider, options: oauthOptions });
    if (error || !data.url) {
      const reason = error?.message?.toLowerCase() ?? "";
      if (reason.includes("already") && reason.includes("link")) {
        return { ok: false, message: "That account is already linked to a different Mazora account." };
      }
      if (reason.includes("manual linking")) {
        return { ok: false, message: "Account linking is not enabled yet. Please contact Mazora staff." };
      }
      return { ok: false, message: "The account could not be connected. Please try again." };
    }
    redirect(data.url);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: oauthOptions });

  if (error || !data.url) return { ok: false, message: "Social login could not be started. Please try again." };
  redirect(data.url);
}

/**
 * Verifies a signup/recovery token from a manual "Confirm" button click rather
 * than the raw {{ .ConfirmationURL }} link. Email security scanners (Gmail's
 * link-scanning included) pre-fetch every link in an inbound email to check
 * for phishing, which silently burns Supabase's single-use verification token
 * before the real user ever clicks it. Gating the actual verifyOtp call behind
 * a real button press means an automated GET can't consume the token early.
 */
export async function confirmEmailAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim();
  const type = otpTypes.find((t) => t === typeValue) as OtpType | undefined;
  if (!tokenHash || !type) return { ok: false, message: "This confirmation link is invalid." };

  // Token hashes are secret and high entropy, but verification still performs
  // an authentication write. The identity is hashed again by the limiter, so
  // the raw token is never stored in Redis or process memory as a key.
  const throttled = await throttleAuthAction("confirm-link", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: tokenHash,
  });
  if (throttled) return { ok: false, message: throttled };

  if (!isSupabaseConfigured()) return { ok: false, message: "Authentication has not been configured yet." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  // A reset link only works in the browser that asked for the reset (see
  // lib/auth/reset-request). Checked before the token is spent, so a click
  // anywhere else leaves the real owner's link usable.
  if (type === "recovery" && !(await hasResetRequestMarker())) {
    return { ok: false, message: RESET_LINK_ELSEWHERE };
  }

  // A sign-up link is only any use in a browser that registered: anywhere
  // else the confirmation could keep neither the password nor a session.
  // Refused before the token is spent, so the link still works where it
  // belongs, and someone who never registered confirms nothing by clicking.
  const signupLink = type === "signup" || type === "email";
  if (signupLink && !(await cookies()).get(PENDING_SIGNUP_COOKIE)?.value) {
    return { ok: false, message: SIGNUP_LINK_ELSEWHERE };
  }

  // Who holds the token is asked before it is spent. For a sign-up link it
  // must be exactly one account that was never confirmed and is not a staff
  // invitation; the `email` type would otherwise also verify a reset token on
  // a long-standing account (lib/validation/auth). With no database there is
  // no answer, and the check after verifying decides alone.
  const signupBefore = signupLink ? await findAccountByConfirmationToken(tokenHash) : null;
  if (signupBefore && signupLinkStanding(signupBefore) === "refuse") {
    return { ok: false, message: LINK_INVALID };
  }
  // For a reset link the same question tells an account this link is about to
  // confirm from one its owner confirmed minutes ago.
  const recoveryBefore = type === "recovery" ? await findAccountByRecoveryToken(tokenHash) : null;

  const { data: verified, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return { ok: false, message: LINK_INVALID };

  if (signupLink) {
    // First, this must be the verification that confirmed the account. Not
    // taken on trust from the lookup above, which may have had no answer.
    const confirmedBefore = signupBefore ? confirmedBeforeVerifying(signupBefore, verified.user?.id) : null;
    if (await notAFirstSignupConfirmation(supabase, verified.user, confirmedBefore)) {
      return { ok: false, message: LINK_INVALID };
    }
    // The marker was there; now that the account is known, it must be for this
    // account. One for another account (an earlier registration of the same
    // address, since replaced, or a link someone else sent) proves nothing.
    const unproven = await settleSignupConfirmation(supabase, verified.user);
    if (unproven) return unproven;
  }

  if (type === "recovery") {
    // The marker was there; now that the account is known, it must have been
    // signed for this account. A link to someone else's account, opened by a
    // visitor who had asked for their own reset, stops here: no session kept,
    // no reset grant. The message is the same as for a missing marker and says
    // nothing about the account. The marker stays, for the visitor's own link.
    if (!(await resetRequestedHereFor(verified.user?.email))) {
      await endLocalSession(supabase);
      return { ok: false, message: RESET_LINK_ELSEWHERE };
    }
    await clearResetRequestMarker();
    // Whether this link is what confirmed the email comes from the lookup made
    // before it was spent. Only when that had no answer for this account does
    // the confirmation time decide, and then the names are left alone.
    const confirmedBefore = recoveryBefore ? confirmedBeforeVerifying(recoveryBefore, verified.user?.id) : null;
    const stopped = await distrustPasswordAfterFirstConfirmation(supabase, verified.user, confirmedBefore);
    if (stopped) return stopped;
    // The reset link's session is the only kind finishPasswordResetAction accepts.
    if (!(await issueResetGrant(supabase, verified.session?.access_token))) {
      console.error("Password reset grant could not be issued (reset link)");
      await endLocalSession(supabase);
      return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
    }
  }

  redirect(type === "recovery" ? "/reset-password" : "/");
}

/**
 * Confirms a new account from the 6-digit code emailed at signup (the
 * {{ .Token }} in the "Confirm signup" template), typed on the "check your
 * inbox" screen. On success the email is verified AND a session is created, so
 * the new member lands signed in. The emailed link (/confirm-email above)
 * stays as a fallback for anyone who would rather click.
 *
 * A code the user types cannot be pre-consumed by an email link-scanner the way
 * a URL can, so this is also sturdier than the link against that failure.
 */
export async function confirmEmailCodeAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = resetCodeSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  // A 6-digit code is only 10^6 possibilities, so it is throttled exactly like
  // the password-reset code — bucketed per email so guesses for one account
  // cannot be spread across many addresses.
  const throttled = await throttleAuthAction("confirm-verify", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: parsed.data.email,
  });
  if (throttled) return { ok: false, message: throttled };

  if (!isSupabaseConfigured()) {
    if (isDemoAuthEnabled()) redirect("/");
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  // Read before the code is spent, as the reset code does: afterwards an
  // account this code confirmed and one confirmed earlier look alike. A code
  // is only ever for a pending self sign-up, so anything else is answered like
  // a wrong code and its token (a staff invite's, say) is left unspent.
  const before = await findAccountByEmail(parsed.data.email);
  if (before.status === "found" && emailStanding(before.account) !== "pending") {
    return { ok: false, errors: { token: "That code is incorrect or has expired." } };
  }

  const { data: verified, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });
  if (error) return { ok: false, errors: { token: "That code is incorrect or has expired." } };

  // A failed read above leaves it to the confirmation time and the invite date.
  if (await notAFirstSignupConfirmation(supabase, verified.user, confirmedBeforeVerifying(before, verified.user?.id))) {
    return { ok: false, errors: { token: "That code is incorrect or has expired." } };
  }

  // Same rule as the emailed link: only the browser that registered this
  // account keeps its password and a session. There is no check before the
  // code is spent, since typing it already takes the address and the code,
  // but a browser with no marker is unproven all the same.
  const unproven = await settleSignupConfirmation(supabase, verified.user);
  if (unproven) return unproven;

  // Verified — a session now exists, so the new member lands signed in.
  redirect("/");
}

/** Re-sends the signup confirmation email, for the "email not verified" prompt on the login form. */
export async function resendConfirmationAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter your email address first." };

  // Email-sending endpoints are throttled hard — abuse here costs deliverability
  // reputation, not just CPU.
  const throttled = await throttleAuthAction("resend-confirmation", {
    limit: 3,
    windowMs: 15 * 60_000,
    identity: email,
  });
  if (throttled) return { ok: false, message: throttled };

  if (!isSupabaseConfigured()) {
    if (isDemoAuthEnabled()) return { ok: true, message: "A new confirmation email has been sent." };
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    // Keep the public response identical for unknown, confirmed and pending
    // accounts. The detailed failure is useful operationally but must not turn
    // this endpoint into an account-existence oracle.
    console.error("Confirmation resend failed:", { status: error.status, code: error.code, message: error.message });
  }

  return { ok: true, message: "If an unverified account exists, a new confirmation email has been sent." };
}

export async function requestPasswordResetAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = resetRequestSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  const throttled = await throttleAuthAction("reset-request", {
    limit: 3,
    windowMs: 15 * 60_000,
    identity: parsed.data.email,
  });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    // Marks this browser as the one that asked, for the emailed link (see
    // lib/auth/reset-request). Before the request and whatever its outcome, so
    // the cookie is the same for an address with no account.
    await markResetRequested(parsed.data.email);
    // The email carries a 6-digit {{ .Token }} as the primary reset path
    // (verified via verifyResetCodeAction below), plus a fallback link built
    // from {{ .TokenHash }} pointing at /confirm-email — not .ConfirmationURL,
    // so redirectTo here no longer affects anything and is intentionally omitted.
    await supabase.auth.resetPasswordForEmail(parsed.data.email);
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true };
}

/**
 * Step 2 of the forgot-password flow: verifies the 6-digit code emailed by
 * requestPasswordResetAction. Success establishes a recovery session (via
 * cookies on the response), which finishPasswordResetAction then uses to
 * actually change the password.
 */
export async function verifyResetCodeAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = resetCodeSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  // A 6-digit code is only 10^6 possibilities, so this is the most valuable
  // endpoint to brute force. Bucketed per email so an attacker cannot spread
  // guesses for one account across many addresses.
  const throttled = await throttleAuthAction("reset-verify", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: parsed.data.email,
  });
  if (throttled) return { ok: false, message: throttled };

  if (!isSupabaseConfigured()) {
    if (isDemoAuthEnabled()) return { ok: true };
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  // Whether the email is confirmed is read BEFORE the code is spent, because
  // verifying a reset code also confirms an unconfirmed account and afterwards
  // the two look alike. A failed read leaves it to the confirmation time.
  const before = await findAccountByEmail(parsed.data.email);

  const { data: verified, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  });
  if (error) return { ok: false, errors: { token: "That code is incorrect or has expired." } };

  const confirmedBefore =
    before.status === "found" && before.account.id === verified.user?.id
      ? emailStanding(before.account) === "confirmed"
      : null;
  const stopped = await distrustPasswordAfterFirstConfirmation(supabase, verified.user, confirmedBefore);
  if (stopped) return stopped;

  // Marks this session as a recovery session; step 3 requires it.
  if (!(await issueResetGrant(supabase, verified.session?.access_token))) {
    console.error("Password reset grant could not be issued (reset code)");
    return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
  }
  return { ok: true };
}

/** Step 3: sets the new password using the recovery session from step 2, then
 * signs out so the user logs back in fresh with their new password rather
 * than silently staying signed in from the recovery session. */
export async function finishPasswordResetAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  const throttled = await throttleAuthAction("reset-finish", {
    limit: 10,
    windowMs: 15 * 60_000,
    identity: (await getSessionUserId()) ?? undefined,
  });
  if (throttled) return { ok: false, message: throttled };

  // Same breach check as registration; fails open. See lib/auth/pwned-password.
  if (await isPasswordBreached(parsed.data.password)) {
    return { ok: false, errors: { password: PWNED_PASSWORD_MESSAGE } };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    // Only a session created by the emailed code or link may skip the current
    // password. Without this, any signed-in session (an unattended device, a
    // copied cookie) could call this action directly and take the account over
    // — the exact case updatePasswordAction's current-password check prevents.
    if (!email || !userData.user || !(await hasResetGrant(supabase))) {
      await clearResetGrant();
      return { ok: false, message: "Your reset session expired. Request a new code and try again." };
    }

    // With two-step verification on, the emailed code alone must not be enough
    // to replace the password — someone in the member's inbox could otherwise
    // reset their way past it. It also takes the authenticator code (or a
    // recovery code), exactly as signing in does; Supabase itself refuses the
    // change from a session that has not passed it (insufficient_aal).
    let viaRecoveryCode = false;
    if (await isTwoFactorPending()) {
      const step = await passResetTwoFactor(supabase, userData.user, formData);
      if (typeof step === "object") return step;
      viaRecoveryCode = step === "recovery";
    }

    // Suspended from the Users board: no new password. Checked only after every
    // other proof (the emailed code and any two-step code) has passed, then the
    // reset session is ended and /account-suspended explains how to appeal.
    const status = await accountStatusFor(userData.user.id);
    if (status === "suspended") {
      await clearResetGrant();
      await endLocalSession(supabase);
      redirect(SUSPENDED_PATH);
    }
    // Unreadable is not "not suspended". The reset session is kept, so the
    // member can simply try again once the status can be read.
    if (status === STATUS_UNREADABLE) {
      return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
    }

    // Only now, after every proof above. Run earlier, this told whoever held
    // just the emailed code whether a guessed password was the current one —
    // on a two-step account, the one thing the inbox alone must not reveal.
    // An account with no password (one removed as untrusted when this reset
    // confirmed the email) has nothing for the new one to differ from.
    if (accountHasPassword(userData.user) && (await passwordMatchesCurrent(email, parsed.data.password))) {
      return { ok: false, errors: { password: "New password must be different from your current password." } };
    }

    /*
      After a recovery code the session is still aal1, and Supabase refuses a
      password change from it while the account has a verified factor — so the
      service role sets it. Two-step verification stays on either way.
    */
    const admin = viaRecoveryCode ? getSupabaseAdmin() : null;
    if (viaRecoveryCode && !admin) return { ok: false, message: "Authentication is temporarily unavailable. Please try again." };
    const { error } = admin
      ? await admin.auth.admin.updateUserById(userData.user.id, { password: parsed.data.password })
      : await supabase.auth.updateUser({ password: parsed.data.password, data: { has_password: true } });
    if (error) return { ok: false, message: "The password could not be updated. Request a new code and try again." };
    await markHasPassword(userData?.user?.id);

    await clearResetGrant();
    await supabase.auth.signOut();
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true, message: "Your password has been updated." };
}

/**
 * The two-step part of a password reset. Returns how it was passed once the
 * reset may go ahead — "code" (the session is now aal2) or "recovery" (one
 * recovery code spent; two-step verification stays on). Otherwise returns what
 * to show, with `needsTwoFactor` set so the form asks for the code; the typed
 * passwords stay in place.
 */
async function passResetTwoFactor(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  user: User,
  formData: FormData,
): Promise<AuthResult | "code" | "recovery"> {
  const mfaCode = String(formData.get("mfaCode") ?? "").replace(/\s/g, "");
  const recoveryCode = String(formData.get("recoveryCode") ?? "").trim();
  const ask = (extra: Partial<AuthResult>): AuthResult => ({ ok: false, needsTwoFactor: true, ...extra });

  if (!mfaCode && !recoveryCode) {
    return ask({ message: "This account has two-step verification on. Enter the code from your authenticator app to finish." });
  }

  const throttled = await throttleAuthAction("mfa-verify", { limit: 5, windowMs: 15 * 60_000, identity: user.id });
  if (throttled) return ask({ message: throttled });

  if (recoveryCode) {
    const outcome = await redeemRecoveryCode(user, recoveryCode, "password-reset");
    if (!outcome.ok) return ask({ errors: { recoveryCode: "That recovery code is incorrect or has already been used." } });
    return "recovery";
  }

  if (!/^\d{6}$/.test(mfaCode)) return ask({ errors: { mfaCode: "Enter the six-digit code from your authenticator app." } });
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) return ask({ message: "Two-step verification is unavailable right now. Please try again." });
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode });
  if (error) return ask({ errors: { mfaCode: "That code is incorrect or has expired." } });
  return "code";
}

/** Record "this account has a password" where only the service role can write it. */
async function markHasPassword(userId: string | undefined) {
  if (!userId) return;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin.auth.admin.getUserById(userId);
    // Spread the existing app_metadata: role lives here too, and replacing the
    // object wholesale would strip it.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(data?.user?.app_metadata ?? {}), has_password: true },
    });
    if (!error) return;
    console.error("Could not record the new password through the admin API:", error.message);
  }
  // The flag may be an explicit `false`, left when an untrusted password was
  // removed (lib/auth/signup-trust). Left that way it would skip the
  // current-password check on an account that has a password again, so there
  // is a second way to write it.
  const recorded = await recordPasswordSet(userId);
  if (!recorded) console.error("The new password could not be recorded on the account by either route");
}

export async function updatePasswordAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  // This one re-checks the current password, so it is a credential oracle too.
  // The account bucket matters most: whoever holds a copied session cookie can
  // rotate addresses, but cannot rotate which account they are guessing for.
  const throttled = await throttleAuthAction("password-update", {
    limit: 10,
    windowMs: 15 * 60_000,
    identity: (await getSessionUserId()) ?? undefined,
  });
  if (throttled) return { ok: false, message: throttled };

  // Same breach check as registration; fails open. See lib/auth/pwned-password.
  if (await isPasswordBreached(parsed.data.password)) {
    return { ok: false, errors: { password: PWNED_PASSWORD_MESSAGE } };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    // A sign-in still owing its two-step code, or a suspended account, is not signed in (see getSession).
    if (!email || !(await hasActiveSession())) return { ok: false, message: "Your session has expired. Sign in again." };

    /*
      Prove the caller knows the existing secret before replacing it.

      Without this, a live session was sufficient to change the password —
      an unattended device or a copied cookie could lock the real owner out
      permanently, and because this path never signed anything out, the
      attacker's own session survived the takeover. finishPasswordResetAction
      already signs out after a change; this one did not.

      Only applies once a password exists: someone who signed up through Google
      or Discord has nothing to prove yet, and demanding it would leave them
      unable to ever set one.
    */
    const hasPassword = accountHasPassword(userData?.user);
    if (hasPassword) {
      const currentPassword = String(formData.get("currentPassword") ?? "");
      if (!currentPassword) {
        return { ok: false, errors: { currentPassword: "Enter your current password." } };
      }
      if (!(await passwordMatchesCurrent(email, currentPassword))) {
        return { ok: false, errors: { currentPassword: "That is not your current password." } };
      }
    }

    if (await passwordMatchesCurrent(email, parsed.data.password)) {
      return { ok: false, errors: { password: "New password must be different from your current password." } };
    }

    /*
      "Secure password change" is on in Supabase: a session older than 24 hours
      must prove it still controls the email address. The first attempt without
      a code gets reauthentication_needed, so we email one and the form asks for
      it; the resubmission carries it as the nonce. "Send a new code" submits
      with resendCode set, which drops any typed code and emails a fresh one.
    */
    const resend = formData.get("resendCode") === "1";
    const typedCode = resend ? "" : String(formData.get("nonce") ?? "").trim();
    const nonce = typedCode ? normaliseReauthCode(typedCode) : null;
    if (typedCode && !nonce) {
      return { ok: false, needsCode: true, errors: { nonce: "Enter the code from the email." } };
    }

    let { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { has_password: true },
      ...(nonce ? { nonce } : {}),
    });

    /*
      A sign-in that used a recovery code, or a passkey that verified the
      member, passed two-step verification, but Supabase still sees an aal1
      session and refuses a password change on an account with a verified
      factor. The current password was checked above, so the service role makes
      the change.
    */
    const passedSecondStep = await getSession();
    if (error?.code === "insufficient_aal" && (passedSecondStep?.recoveredSignIn || passedSecondStep?.passkeySignIn)) {
      const admin = getSupabaseAdmin();
      if (admin && userData?.user?.id) {
        ({ error } = await admin.auth.admin.updateUserById(userData.user.id, { password: parsed.data.password }));
      }
    }
    if (error) {
      const kind = classifyPasswordUpdateError(error.code);
      if (kind === "send-code") {
        const { error: sendError } = await supabase.auth.reauthenticate();
        if (sendError) {
          console.error("Could not send the password-change confirmation code:", sendError.message);
          return { ok: false, needsCode: true, message: "We couldn't send a confirmation code. Try again in a minute." };
        }
        return {
          ok: false,
          needsCode: true,
          message: "For your security, we've emailed you a confirmation code. Enter it below to finish.",
        };
      }
      if (kind === "bad-code") {
        return { ok: false, needsCode: true, errors: { nonce: "That code is incorrect or has expired. Send a new one." } };
      }
      return { ok: false, message: "The password could not be updated. Please try again." };
    }
    await markHasPassword(userData?.user?.id);

    /*
      Drop every other session, keeping this one. If the change was made to
      recover from a compromise, leaving the other party signed in would defeat
      the point. Failure here must not report the change as failed — it has
      already succeeded.
    */
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch (signOutError) {
      console.error("Could not revoke other sessions after password change:", signOutError);
    }
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true, message: "Your password has been updated." };
}

export async function switchDiscordAction(_previous: AuthResult): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user || !(await hasActiveSession())) return { ok: false, message: "You must be signed in to switch accounts." };

  const throttled = await throttleAuthAction("discord-switch", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: data.user.id,
  });
  if (throttled) return { ok: false, message: throttled };

  const discordIdentity = pickDiscordIdentity(data.user.identities);
  if (!discordIdentity) return { ok: false, message: "No Discord account is linked." };

  const remaining = (data.user.identities?.length ?? 0) - 1;
  if (remaining < 1) {
    return { ok: false, message: "Add Google or a password before switching your only sign-in method." };
  }

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(discordIdentity);
  if (unlinkError) return { ok: false, message: "Discord could not be prepared for switching. Please try again." };

  // Return to whichever settings page this user actually uses: staff are
  // redirected out of /dashboard, so they must come back to /admin/account.
  await ensureRoleCatalog();
  // normalizeRoleKey: legacy key read as web_dev until migration 055 (removable after).
  const roleRaw = normalizeRoleKey(data.user.app_metadata?.role);
  const role: Role = typeof roleRaw === "string" && isRoleKey(roleRaw) ? roleRaw : "member";
  const settingsPath = isStaff(role) ? "/admin/account" : "/dashboard/settings";

  const { data: linkData, error: linkError } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(settingsPath)}`,
      skipBrowserRedirect: true,
    },
  });

  if (linkError || !linkData.url) {
    return { ok: false, message: "Discord was disconnected, but the account switch could not start. Use Connect Discord to try again." };
  }

  redirect(linkData.url);
}
/**
 * Checkout's "Switch": signs the visitor out, then starts a fresh Discord login.
 *
 * Deliberately not the unlink-and-relink dance switchDiscordAction performs.
 * Store buyers have almost always signed in *with* Discord, so it is their only
 * identity, and Supabase refuses to unlink the last identity on an account —
 * relinking can never succeed for them. Clearing the session first is also what
 * makes oauthAction take the signInWithOAuth path instead of linkIdentity,
 * which is the only branch that accepts a different Discord account.
 */
export async function switchDiscordAccountAction(
  _previous: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  // This action is an alternate OAuth entry point used by checkout. Requiring
  // the existing session and throttling before sign-out prevents it from being
  // used as a public bypass around oauthAction's initiation limit.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || !(await hasActiveSession())) return { ok: false, message: "You must be signed in to switch accounts." };
  const throttled = await throttleAuthAction("discord-account-switch", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: userData.user.id,
  });
  if (throttled) return { ok: false, message: throttled };

  const nextValue = formData.get("next");
  const next = safeNext(typeof nextValue === "string" ? nextValue : undefined);

  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "consent" },
    },
  });

  // Already signed out at this point, so say so — otherwise the visitor is left
  // looking at a checkout that silently stopped knowing who they are.
  if (error || !data.url) {
    return {
      ok: false,
      message: "You have been signed out, but Discord login could not start. Use Connect Discord to continue.",
    };
  }
  redirect(data.url);
}

export async function unlinkDiscordAction(_previous: AuthResult): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user || !(await hasActiveSession())) return { ok: false, message: "You must be signed in to unlink an account." };

  const throttled = await throttleAuthAction("discord-unlink", {
    limit: 5,
    windowMs: 15 * 60_000,
    identity: data.user.id,
  });
  if (throttled) return { ok: false, message: throttled };

  // Every Discord identity goes, not just the first one found: an account that
  // picked up a duplicate before duplicates were blocked would otherwise keep a
  // stray login that still counts as "Discord connected".
  const discordIdentities = (data.user.identities ?? []).filter((i) => i.provider === "discord");
  if (discordIdentities.length === 0) return { ok: false, message: "No Discord account is linked." };

  // Supabase requires at least one identity to remain on the account.
  const remaining = (data.user.identities?.length ?? 0) - discordIdentities.length;
  if (remaining < 1) {
    return { ok: false, message: "You cannot unlink Discord because it is your only sign-in method. Link Google or set a password first." };
  }

  for (const identity of discordIdentities) {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) return { ok: false, message: "Discord could not be unlinked. Please try again." };
  }

  return { ok: true, message: "Discord has been disconnected from your account." };
}
