"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/types";
import { createSession, getSession, isStaff, landingPathFor, pickDiscordIdentity, ROLES } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/auth/profile";
import { site } from "@/lib/site";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { getSupabaseConfig, isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ignAvailability, linkMinecraftIgn } from "@/lib/minecraft/link";
import { throttleAuthAction } from "@/lib/rate-limit";
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

export interface AuthResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Set by loginAction when credentials were correct but the account's email isn't confirmed yet. */
  unverifiedEmail?: string;
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

const usernameFromIdentifier = (identifier: string) =>
  (identifier.includes("@") ? identifier.split("@")[0] : identifier).replace(/[^a-zA-Z0-9_]/g, "");

/**
 * True if `password` is already the account's current password. Uses an
 * isolated, non-persisting client so the probe sign-in never touches the
 * real session cookies that `supabase` (cookie-bound) writes to.
 */
async function passwordMatchesCurrent(email: string, password: string): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;
  const probe = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
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
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.identifier,
      password: parsed.data.password,
    });
    if (error) {
      if (isUnconfirmedEmailError(error)) {
        return {
          ok: false,
          message: "Verify your email before logging in — check your inbox for the confirmation link.",
          unverifiedEmail: parsed.data.identifier,
        };
      }
      return { ok: false, message: "The email or password is incorrect." };
    }
    // Honour an explicit destination; otherwise route by role (staff → their
    // dashboard, everyone else → home).
    if (parsed.data.next && parsed.data.next !== "/") redirect(safeNext(parsed.data.next));
    const session = await getSession();
    redirect(session ? landingPathFor(session.role) : "/");
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

  const throttled = await throttleAuthAction("register", { limit: 5, windowMs: 60 * 60_000 });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    const admin = getSupabaseAdmin();

    // Reject a taken username up front so the person consciously picks a unique
    // handle, rather than the signup trigger silently suffixing it after the
    // fact (`unique_username` in the migrations). The IGN is checked against
    // both namespaces it will occupy — the site handle and the Minecraft link.
    if (admin) {
      const availability = await ignAvailability(admin, parsed.data.username);
      if (!availability.available) {
        return {
          ok: false,
          errors: { username: "That Minecraft username is already taken. Please choose another." },
        };
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

    // Keep account creation complete even on projects where the database
    // signup trigger has not been applied yet.
    if (data.user && admin && !(await ensureUserProfile(data.user))) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, message: "That account could not be created. Try another username or email." };
    }

    // Point the new account's Minecraft link + skin avatar at the IGN. The site
    // handle is already the IGN (the signup trigger set it from metadata); this
    // adds the minecraft_accounts row and the skin head. Best-effort on purpose:
    // the account already exists and the player can (re)link from the dashboard,
    // so a hiccup here must not fail an otherwise-successful signup.
    if (data.user && admin) {
      const linked = await linkMinecraftIgn(admin, data.user.id, parsed.data.username).catch((linkError) => {
        console.error("Registration IGN link failed:", linkError);
        return null;
      });
      if (linked && !linked.ok) {
        console.error("Registration IGN link did not fully apply for user", data.user.id);
      }
    }

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
  if (existingUser?.user) {
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

  if (!isSupabaseConfigured()) return { ok: false, message: "Authentication has not been configured yet." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return {
      ok: false,
      message: "This link is invalid or has expired. Request a new one from the login page.",
    };
  }

  redirect(type === "recovery" ? "/reset-password" : "/");
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
  if (error) return { ok: false, message: "That email could not be resent. Try again shortly." };

  return { ok: true, message: "A new confirmation email has been sent." };
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

  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  });
  if (error) return { ok: false, errors: { token: "That code is incorrect or has expired." } };

  return { ok: true };
}

/** Step 3: sets the new password using the recovery session from step 2, then
 * signs out so the user logs back in fresh with their new password rather
 * than silently staying signed in from the recovery session. */
export async function finishPasswordResetAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  const throttled = await throttleAuthAction("reset-finish", { limit: 10, windowMs: 15 * 60_000 });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return { ok: false, message: "Your reset session expired. Request a new code and try again." };

    if (await passwordMatchesCurrent(email, parsed.data.password)) {
      return { ok: false, errors: { password: "New password must be different from your current password." } };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password, data: { has_password: true } });
    if (error) return { ok: false, message: "The password could not be updated. Request a new code and try again." };
    await markHasPassword(userData?.user?.id);

    await supabase.auth.signOut();
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true, message: "Your password has been updated." };
}

/**
 * Whether this account already has a password, decided from sources the account
 * holder cannot rewrite.
 *
 * The old check read `user_metadata.has_password`, which fails twice. It is
 * never set at registration — signUp only records username/display_name — so
 * every email+password account reported "no password yet" and skipped the
 * current-password prompt entirely. And `user_metadata` is writable by the user
 * themselves through GoTrue, so even a correctly flagged account could clear it
 * and skip the prompt on the next call.
 *
 * `identities` is managed by GoTrue and answers the common case. It cannot
 * answer the OAuth-user-who-later-set-a-password case, because updateUser({
 * password }) adds no "email" identity — that is what the flag is for, so it now
 * lives in `app_metadata`, which only the service role can write.
 *
 * user_metadata is still consulted, but only as an additional way to say *yes*.
 * It can never be used to say no, so forging it buys nothing.
 */
function accountHasPassword(user: {
  identities?: { provider?: string }[] | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  if (!user) return false;
  if ((user.identities ?? []).some((identity) => identity?.provider === "email")) return true;
  if (user.app_metadata?.has_password === true) return true;
  return user.user_metadata?.has_password === true;
}

/** Record "this account has a password" where only the service role can write it. */
async function markHasPassword(userId: string | undefined) {
  if (!userId) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { data } = await admin.auth.admin.getUserById(userId);
  // Spread the existing app_metadata: role lives here too, and replacing the
  // object wholesale would strip it.
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...(data?.user?.app_metadata ?? {}), has_password: true },
  });
}

export async function updatePasswordAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  // This one re-checks the current password, so it is a credential oracle too.
  const throttled = await throttleAuthAction("password-update", { limit: 10, windowMs: 15 * 60_000 });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return { ok: false, message: "Your session has expired. Sign in again." };

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

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { has_password: true },
    });
    if (error) return { ok: false, message: "The password could not be updated. Request a new recovery link." };
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
  if (userError || !data.user) return { ok: false, message: "You must be signed in to switch accounts." };

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
  const roleRaw = data.user.app_metadata?.role;
  const role: Role = typeof roleRaw === "string" && ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : "member";
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
  if (userError || !data.user) return { ok: false, message: "You must be signed in to unlink an account." };

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
