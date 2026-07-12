"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession } from "@/lib/auth";

export interface AuthResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function firstErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path[0];
    if (typeof k === "string" && !out[k]) out[k] = i.message;
  }
  return out;
}

const usernameFromIdentifier = (id: string) => (id.includes("@") ? id.split("@")[0] : id).replace(/[^a-zA-Z0-9_]/g, "");

const loginSchema = z.object({
  identifier: z.string().min(2, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

const registerSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters.").regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only."),
    displayName: z.string().min(1, "Enter a display name."),
    email: z.string().email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
    terms: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match." })
  .refine((d) => d.terms === "on", { path: ["terms"], message: "You must accept the terms." });

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : ""));
  return out;
}

/**
 * Phase-1 demo auth. Creates a local session cookie so the authenticated flows
 * are navigable. Tip: log in as "admin" or "owner" to preview those dashboards.
 * Phase 2 replaces the body with Supabase Auth (verify credentials, email, etc).
 */
export async function loginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  const username = usernameFromIdentifier(parsed.data.identifier) || "player";
  await createSession(username);
  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard");
}

export async function registerAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  await createSession(parsed.data.username, parsed.data.displayName);
  redirect("/dashboard");
}
