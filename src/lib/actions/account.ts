"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AccountActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const profileSchema = z.object({
  displayName: z
    .string({ required_error: "Enter a display name." })
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(64, "Display name must be 64 characters or fewer."),
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
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Profile updated." };
}

/** Removes Minecraft mappings, pending codes, and cascaded player statistics. */
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

  const { error: codeError } = await admin
    .from("minecraft_link_codes")
    .delete()
    .eq("user_id", auth.user.id);
  if (codeError) return { ok: false, message: "The account was disconnected, but an old link code could not be cleared." };

  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (String(profile?.avatar_url ?? "").startsWith("https://mc-heads.net/")) {
    await admin.from("profiles").update({ avatar_url: null }).eq("user_id", auth.user.id);
    await auth.supabase.auth.updateUser({ data: { avatar_url: null } });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/minecraft");
  return { ok: true, message: "Minecraft has been disconnected." };
}

/** Permanently deletes the authenticated user and all user-owned records. */
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

  // Storage objects are not database rows and do not cascade when auth.users is deleted.
  const { data: avatarObjects } = await admin.storage.from("profile-avatars").list(auth.user.id, { limit: 100 });
  if (avatarObjects?.length) {
    await admin.storage
      .from("profile-avatars")
      .remove(avatarObjects.map((item) => `${auth.user.id}/${item.name}`));
  }

  let { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);
  if (deleteError && !/database error deleting user/i.test(deleteError.message)) {
    return { ok: false, message: "Your account could not be deleted. Please try again or contact support." };
  }

  // Older installations used ON DELETE RESTRICT for orders. A failed first
  // attempt is atomic, so only then remove that blocking user-owned data and
  // retry. Migration 002 makes this compatibility branch unnecessary on
  // current installations.
  if (deleteError) {
    const { error: orderError } = await admin.from("orders").delete().eq("user_id", auth.user.id);
    if (orderError) return { ok: false, message: "Your account data could not be removed. Please contact support." };
    ({ error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id));
  }

  if (deleteError) return { ok: false, message: "Your account could not be deleted. Please try again or contact support." };

  // The auth user no longer exists, but clearing the local session cookie
  // prevents the browser retaining a stale JWT until its normal expiry.
  await auth.supabase.auth.signOut({ scope: "local" });
  redirect("/");
}