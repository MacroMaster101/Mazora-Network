"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { site } from "@/lib/site";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  authFormValues,
  authValidationErrors,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetRequestSchema,
} from "@/lib/validation/auth";

export interface AuthResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function safeNext(value: string | undefined, fallback = "/dashboard"): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

const usernameFromIdentifier = (identifier: string) =>
  (identifier.includes("@") ? identifier.split("@")[0] : identifier).replace(/[^a-zA-Z0-9_]/g, "");

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
    if (error) return { ok: false, message: "The email or password is incorrect." };
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
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${site.url}/auth/callback?next=${encodeURIComponent("/dashboard")}`,
        data: { username: parsed.data.username, display_name: parsed.data.username },
      },
    });
    if (error) return { ok: false, message: "That account could not be created. Try another email or sign in instead." };
    redirect(data.session ? "/dashboard" : "/verify-email");
  }

  if (!isDemoAuthEnabled()) return { ok: false, message: "Authentication has not been configured yet." };
  await createSession(parsed.data.username, parsed.data.username);
  redirect("/dashboard");
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
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) return { ok: false, message: "Social login could not be started. Please try again." };
  redirect(data.url);
}

export async function requestPasswordResetAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = resetRequestSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true };
}

export async function updatePasswordAction(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(authFormValues(formData));
  if (!parsed.success) return { ok: false, errors: authValidationErrors(parsed.error) };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, message: "Authentication is temporarily unavailable." };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, message: "The password could not be updated. Request a new recovery link." };
  } else if (!isDemoAuthEnabled()) {
    return { ok: false, message: "Authentication has not been configured yet." };
  }

  return { ok: true };
}
