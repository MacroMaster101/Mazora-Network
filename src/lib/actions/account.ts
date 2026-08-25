"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

/**
 * Deletes the authenticated user.
 *
 * Not quite "and all user-owned records", which is what this used to claim:
 * migration 020 deliberately retains order history so sales stay reconcilable.
 * What that retention must not do is keep naming the person, so the identifying
 * columns are scrubbed here before the auth user goes.
 */
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

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Account deletion is temporarily unavailable." };

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
