"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSignInSessionId, hasActiveSession } from "@/lib/auth";
import { consumeAccountDeletionCode, sendAccountDeletionCode } from "@/lib/auth/account-deletion-proof";
import { accountHasPassword, confirmSecondStep, passwordMatchesCurrent } from "@/lib/auth/reauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { throttleAuthAction } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AVATAR_BUCKET } from "@/lib/storage/avatar-bucket";
import { removeStoredSkinFiles } from "@/lib/storage/skin-files";
import { cleanupAccountOwnedData } from "@/lib/data/account-deletion";
import { displayName } from "@/lib/validation/auth";

export interface AccountActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const profileSchema = z.object({
  // Shared with registration so the two never drift (was 64 here, 32 there).
  displayName,
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer."),
});

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") values[key] = value;
  });
  return values;
}

function validationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

async function authenticatedUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  // Owing the two-step code, or suspended: not signed in (see getSession).
  if (!(await hasActiveSession())) return null;
  return { supabase, user: data.user };
}

/** Updates the signed-in user's editable profile fields. */
export async function updateProfileAction(
  _previous: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) };

  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to update your profile." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Profile management is temporarily unavailable." };

  const { data: updatedProfile, error } = await admin
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.user.id)
    .select("user_id")
    .maybeSingle();

  if (error || !updatedProfile) {
    return { ok: false, message: "Your profile could not be updated. Please try again." };
  }

  // Keep provider-independent auth metadata aligned for any surface that has
  // to render before the profile row is available.
  await auth.supabase.auth.updateUser({ data: { display_name: parsed.data.displayName } });
  // Both shells must be refreshed, not just the member one: staff manage their
  // own profile at /admin/account, and the header + sidebar they see there are
  // rendered by the /admin layout. Revalidating only /dashboard left them
  // looking at their previous avatar until a hard reload.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
  return { ok: true, message: "Profile updated." };
}

/** Removes Minecraft mappings, pending codes, cascaded player statistics, and any uploaded skin. */
export async function disconnectMinecraftAction(
  _previous: AccountActionResult,
): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to disconnect Minecraft." };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Account management is temporarily unavailable." };

  const { error: accountError } = await admin
    .from("minecraft_accounts")
    .delete()
    .eq("user_id", auth.user.id);
  if (accountError) return { ok: false, message: "Minecraft could not be disconnected. Please try again." };

  await removeStoredSkinFiles(auth.user.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const avatarUrl = String(profile?.avatar_url ?? "");
  const isMcHeadsAvatar = avatarUrl.startsWith("https://mc-heads.net/");
  const isUploadedSkinAvatar = avatarUrl.includes(`/${AVATAR_BUCKET}/${auth.user.id}/skin-head-`);
  if (isMcHeadsAvatar || isUploadedSkinAvatar) {
    await admin.from("profiles").update({ avatar_url: null }).eq("user_id", auth.user.id);
    await auth.supabase.auth.updateUser({ data: { avatar_url: null } });
  }

  // Both shells must be refreshed, not just the member one: staff manage their
  // own profile at /admin/account, and the header + sidebar they see there are
  // rendered by the /admin layout. Revalidating only /dashboard left them
  // looking at their previous avatar until a hard reload.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
  revalidatePath("/dashboard/minecraft");
  revalidatePath("/players", "layout");
  revalidatePath("/leaderboards");
  return { ok: true, message: "Minecraft has been disconnected." };
}

/** Sends a session-bound deletion code to a passwordless user's confirmed email. */
export async function requestAccountDeletionCodeAction(_previous: AccountActionResult): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "Your session has expired. Sign in again." };
  if (accountHasPassword(auth.user) || auth.user.factors?.some((factor) => factor.status === "verified")) {
    return { ok: false, message: "Confirm with your password or authenticator code instead." };
  }
  if (!auth.user.email || !auth.user.email_confirmed_at) return { ok: false, message: "A confirmed email address is required to delete your account." };
  const throttled = await throttleAuthAction("account-delete-send", { limit: 3, windowMs: 15 * 60_000, identity: auth.user.id });
  if (throttled) return { ok: false, message: throttled };
  const sent = await sendAccountDeletionCode(
    { userId: auth.user.id, sessionId: (await getSignInSessionId()) ?? "" },
    auth.user.email,
  );
  return sent
    ? { ok: true, message: "A confirmation code has been sent to your account email address." }
    : { ok: false, message: "The confirmation code could not be sent. Try again later." };
}

/** Deletes the authenticated user after fresh proof, anonymizing retained order history first. */
export async function deleteAccountAction(
  _previous: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to delete your account." };

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("username")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const username = String(
    profile?.username ?? auth.user.user_metadata?.username ?? auth.user.email?.split("@")[0] ?? "",
  ).trim();

  if (!username || confirmation.toLowerCase() !== username.toLowerCase()) {
    return { ok: false, errors: { confirmation: `Type ${username || "your username"} to confirm.` } };
  }

  /*
    Deleting cannot be undone, so a signed-in browser alone is not enough: an
    unlocked computer or a copied cookie could otherwise erase the account. The
    same proof as changing the password — the current password when there is
    one — plus, with two-step verification on, a code from the app or a
    recovery code. An account with neither proves control of its confirmed
    email with a single-use code bound to this exact session.
  */
  // Checked before any proof is taken, so a recovery code is never spent on a
  // deletion that could not go ahead anyway.
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Account deletion is temporarily unavailable." };

  if (accountHasPassword(auth.user)) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    if (!currentPassword) return { ok: false, errors: { currentPassword: "Enter your current password." } };
    // Per account, so a signed-in browser cannot be used to guess the password.
    const throttled = await throttleAuthAction("account-delete", { limit: 5, windowMs: 15 * 60_000, identity: auth.user.id });
    if (throttled) return { ok: false, message: throttled };
    if (!auth.user.email || !(await passwordMatchesCurrent(auth.user.email, currentPassword))) {
      return { ok: false, errors: { currentPassword: "That is not your current password." } };
    }
  }
  if (auth.user.factors?.some((factor) => factor.status === "verified")) {
    const stepError = await confirmSecondStep(auth.supabase, auth.user, formData, "account-deletion");
    if (stepError) return { ok: false, errors: { code: stepError } };
  }
  if (!accountHasPassword(auth.user) && !auth.user.factors?.some((factor) => factor.status === "verified")) {
    const throttled = await throttleAuthAction("account-delete", { limit: 5, windowMs: 15 * 60_000, identity: auth.user.id });
    if (throttled) return { ok: false, message: throttled };
    const verified = auth.user.email_confirmed_at && (await consumeAccountDeletionCode(
      { userId: auth.user.id, sessionId: (await getSignInSessionId()) ?? "" },
      String(formData.get("emailCode") ?? ""),
    ));
    if (!verified) return { ok: false, errors: { emailCode: "Send a confirmation code, then enter it here. Codes expire after 10 minutes and can be used once." } };
  }

  /*
    Before the auth user goes: once it is deleted the FK has already nulled
    orders.user_id and these rows can no longer be located, so the Discord and
    Minecraft identifiers on them would be stranded permanently.
  */
  const cleanup = await cleanupAccountOwnedData(auth.user.id);
  if (!cleanup.ok) {
    return {
      ok: false,
      message: `${cleanup.message} Your account was not deleted. Please try again or contact support.`,
    };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);

  if (deleteError) return { ok: false, message: "Your account could not be deleted. Please try again or contact support." };

  // The auth user no longer exists, but clearing the local session cookie
  // prevents the browser retaining a stale JWT until its normal expiry.
  await auth.supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
