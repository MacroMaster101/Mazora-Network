import { z } from "zod";

/**
 * The verifyOtp() token types /confirm-email accepts, shared between the
 * action and its UI: only the links this site actually emails (the signup
 * template's type=email, and the password-reset fallback). Invites go through
 * /auth/callback, and magic links and email changes are never sent. Accepting
 * a magiclink here let anyone mail a victim a link to their OWN account's
 * token, and one "Confirm" click signed the victim into it.
 *
 * "email" stays because the Confirm signup template may link with it, but the
 * auth server treats that type as a magic link whenever the account is already
 * confirmed, and then it also accepts a password-reset token. So a reset link
 * edited to say type=email verifies on a long-standing account. The action
 * must therefore never handle an "email" verification as a new sign-up unless
 * it is the one that confirmed the account: it checks who holds the token
 * before spending it, and the confirmation time and invite date afterwards
 * (firstSignupConfirmation in lib/auth/signup-trust-core).
 */
export const otpTypes = ["signup", "email", "recovery"] as const;
export type OtpType = (typeof otpTypes)[number];

const email = z
  .string({ required_error: "Enter your email address." })
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "Email address is too long.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const password = z
  .string({ required_error: "Enter your password." })
  .min(1, "Enter your password.")
  .max(128, "Password must be 128 characters or fewer.");

const newPassword = z
  .string({ required_error: "Create a password." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Add at least one lowercase letter.")
  .regex(/[A-Z]/, "Add at least one uppercase letter.")
  .regex(/[0-9]/, "Add at least one number.")
  .regex(/[^a-zA-Z0-9]/, "Add at least one symbol.");

const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 64;
/** The character classes a display name may not contain, as the inside of a bracket expression. */
const DISPLAY_NAME_REFUSED = String.raw`\p{Cc}\p{Cf}\p{Zl}\p{Zp}`;

/** Longest username the sign-up form accepts (a Minecraft name). */
export const USERNAME_MAX_LENGTH = 16;

/**
 * Display name: freeform and NON-unique — two members may share one, since the
 * unique identity is the @username, not this. Trimmed, 2–64 characters, and
 * rejecting control, format (zero-width joiners, RTL/LTR overrides), and
 * line/paragraph-separator characters — the ones that let a name break page
 * layout or read as something it is not, rather than simply describe someone.
 * Mixed case and spaces are fine and preserved exactly as typed. Shared by
 * registration and the profile editor so their limits cannot drift apart.
 */
export const displayName = z
  .string({ required_error: "Enter a display name." })
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, "Display name must be at least 2 characters.")
  .max(DISPLAY_NAME_MAX_LENGTH, "Display name must be 64 characters or fewer.")
  .regex(
    new RegExp(`^[^${DISPLAY_NAME_REFUSED}]+$`, "u"),
    "Remove control or invisible characters from your display name.",
  );

/**
 * A display name for a profile the form never saw: one built from sign-up
 * metadata, which a direct caller of the auth API controls. Nobody is there to
 * read an error, so the characters the form refuses are removed instead, the
 * result is trimmed, and a candidate left shorter than the form's minimum is
 * skipped for the next one. Same order and limits as derive_display_name in
 * the database (migration 076), which this mirrors.
 */
export function cleanDisplayName(candidates: readonly unknown[], fallback: string): string {
  const refused = new RegExp(`[${DISPLAY_NAME_REFUSED}]`, "gu");
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const cleaned = [...candidate.replace(refused, "").trim()];
    if (cleaned.length >= DISPLAY_NAME_MIN_LENGTH) return cleaned.slice(0, DISPLAY_NAME_MAX_LENGTH).join("");
  }
  return fallback;
}

/**
 * What may be typed into the sign-in field: an email address or a username.
 *
 * Deliberately loose. This is the ONE field where a strict shape works against
 * you: rejecting "that is not a valid email" before the password is even
 * checked tells an attacker which of the two they typed, and tells a member
 * off for using the login name they were told to use. Anything non-empty is
 * accepted here and resolved server-side, where a miss is indistinguishable
 * from a wrong password.
 *
 * The `@` is what splits the two branches, and a username cannot contain one —
 * registerSchema restricts usernames to letters, numbers and underscores — so
 * there is no ambiguity to resolve.
 */
const loginIdentifier = z
  .string({ required_error: "Enter your username or email." })
  .trim()
  .min(1, "Enter your username or email.")
  .max(254, "That is too long.");

export const loginSchema = z.object({
  identifier: loginIdentifier,
  password,
  next: z.string().max(2048).optional(),
});

export const registerSchema = z
  .object({
    displayName,
    username: z
      .string({ required_error: "Enter your Minecraft username." })
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(USERNAME_MAX_LENGTH, "Minecraft usernames can be at most 16 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores."),
    email,
    password: newPassword,
    confirm: z
      .string({ required_error: "Confirm your password." })
      .min(1, "Confirm your password.")
      .max(128, "Password must be 128 characters or fewer."),
    terms: z.literal("on", {
      errorMap: () => ({ message: "Accept the community rules and terms to continue." }),
    }),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export const resetRequestSchema = z.object({ email });

export const resetCodeSchema = z.object({
  email,
  token: z
    .string({ required_error: "Enter the 6-digit code." })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

export const newPasswordSchema = z
  .object({
    password: newPassword,
    confirm: z
      .string({ required_error: "Confirm your new password." })
      .min(1, "Confirm your new password.")
      .max(128, "Password must be 128 characters or fewer."),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export function authValidationErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !output[key]) output[key] = issue.message;
  }
  return output;
}

export function authFormValues(formData: FormData): Record<string, string> {
  const output: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") output[key] = value;
  });
  return output;
}
