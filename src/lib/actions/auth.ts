"use server";

import { redirect } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSession } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/auth/profile";
import { site } from "@/lib/site";
import { getSupabaseConfig, isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
async function passwordMatchesCurrent(supabase: SupabaseClient, email: string, password: string): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;
  const probe = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

export async function loginAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

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
    redirect(safeNext(parsed.data.next));
  }

  if (!isDemoAuthEnabled()) return { ok: false, message: "Authentication has not been configured yet." };
  const username = usernameFromIdentifier(parsed.data.identifier) || "player";
  await createSession(username);
  redirect(safeNext(parsed.data.next));
}

export async function registerAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    // emailRedirectTo intentionally omitted: the Confirm signup template links
    // to /confirm-email?token_hash=...&type=email (built from {{ .SiteURL }}
    // and {{ .TokenHash }}) rather than {{ .ConfirmationURL }}, so this option
    // no longer affects anything.
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { username: parsed.data.username, display_name: parsed.data.username },
      },
    });
    if (error) return { ok: false, message: "That account could not be created. Try another email or sign in instead." };

    // Keep account creation complete even on projects where the database
    // signup trigger has not been applied yet.
    const admin = getSupabaseAdmin();
    if (data.user && admin && !(await ensureUserProfile(data.user))) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, message: "That account could not be created. Try another username or email." };
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
  await createSession(parsed.data.username, parsed.data.username);
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
  };

  // A signed-in visitor is LINKING the provider to their current account, not
  // switching accounts. signInWithOAuth would silently log them into a
  // different account whenever the provider email differs. Requires the
  // "Manual Linking" toggle in Supabase Authentication settings.
  const { data: existingUser } = await supabase.auth.getUser();
  if (existingUser?.user) {
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

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return { ok: false, message: "Your reset session expired. Request a new code and try again." };

    if (await passwordMatchesCurrent(supabase, email, parsed.data.password)) {
      return { ok: false, errors: { password: "New password must be different from your current password." } };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password, data: { has_password: true } });
    if (error) return { ok: false, message: "The password could not be updated. Request a new code and try again." };

    await supabase.auth.signOut();
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true, message: "Your password has been updated." };
}

export async function updatePasswordAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (email && (await passwordMatchesCurrent(supabase, email, parsed.data.password))) {
      return { ok: false, errors: { password: "New password must be different from your current password." } };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { has_password: true },
    });
    if (error) return { ok: false, message: "The password could not be updated. Request a new recovery link." };
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true, message: "Your password has been updated." };
}

export async function unlinkDiscordAction(_previous: AuthResult): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return { ok: false, message: "You must be signed in to unlink an account." };

  const discordIdentity = data.user.identities?.find((i) => i.provider === "discord");
  if (!discordIdentity) return { ok: false, message: "No Discord account is linked." };

  // Supabase requires at least one identity to remain on the account.
  const remaining = (data.user.identities?.length ?? 0) - 1;
  if (remaining < 1) {
    return { ok: false, message: "You cannot unlink Discord because it is your only sign-in method. Link Google or set a password first." };
  }

  const { error } = await supabase.auth.unlinkIdentity(discordIdentity);
  if (error) return { ok: false, message: "Discord could not be unlinked. Please try again." };

  return { ok: true, message: "Discord has been disconnected from your account." };
}
