import { z } from "zod";

/** Supabase's verifyOtp() token types, shared between the confirm-email action and its UI. */
export const otpTypes = ["signup", "email", "recovery", "invite", "magiclink", "email_change"] as const;
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
  .min(2, "Display name must be at least 2 characters.")
  .max(64, "Display name must be 64 characters or fewer.")
  .regex(
    /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+$/u,
    "Remove control or invisible characters from your display name.",
  );

export const loginSchema = z.object({
  identifier: email,
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
      .max(16, "Minecraft usernames can be at most 16 characters.")
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
