"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AVATAR_BUCKET, ensureAvatarBucket } from "@/lib/storage/avatar-bucket";
import { removeStoredSkinFiles } from "@/lib/storage/skin-files";
import { SKIN_MAX_BYTES, cropAndCompositeHead, validateSkinBytes } from "@/lib/skins/process";

/**
 * Setting the Minecraft in-game name on an account.
 *
 * This is deliberately a *self-declared* name, not a verified Mojang account:
 * Mazora supports TLauncher and cracked players, who have no premium account
 * to verify against in the first place. The name drives the skin head avatar
 * (mc-heads.net renders by username) and the player/leaderboard rows.
 *
 * What still protects it: the caller must be signed in, and a name already
 * claimed by another account is refused, so two users cannot hold the same IGN.
 *
 * The old verification-code flow (`minecraft_link_codes` + the plugin endpoint
 * that consumed them) was removed — it was never enabled, and its table is
 * dropped in migration 016.
 */

/** Shape returned to the client for a set Minecraft name. */
export interface MinecraftConnection {
  id: string;
  uuid: string;
  username: string;
  linkedAt: string;
}

export interface MinecraftLinkActionState {
  ok: boolean;
  message?: string;
  enabled: boolean;
  linked?: MinecraftConnection;
}

/** Premium names are 3–16 of [A-Za-z0-9_]; cracked clients use the same rule. */
const IGN_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;

async function authenticatedUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function linkMinecraftUsernameAction(
  _previous: MinecraftLinkActionState,
  formData: FormData,
): Promise<MinecraftLinkActionState> {
  const enabled = isSupabaseConfigured();
  if (!enabled) return { ok: false, enabled: false, message: "Account service unavailable." };

  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to set your Minecraft name." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft names are temporarily unavailable." };

  const username = String(formData.get("username") ?? "").trim();
  if (!IGN_PATTERN.test(username)) {
    return { ok: false, enabled, message: "Minecraft name must be 3–16 letters, numbers, or underscores." };
  }

  // Someone else already holds this IGN — refuse rather than let two accounts
  // show the same player identity.
  const { data: existingClaims } = await admin
    .from("minecraft_accounts")
    .select("user_id, minecraft_username")
    .ilike("minecraft_username", username);

  const taken = (existingClaims ?? []).find((row) => String(row.user_id) !== user.id);
  if (taken) {
    return { ok: false, enabled, message: `The Minecraft name "${username}" is already used by another Mazora account.` };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile && String(existingProfile.user_id) !== user.id) {
    return { ok: false, enabled, message: `The website handle "${username}" is already used by another user account.` };
  }

  const { data: currentLink } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/256`;
  // Offline-mode UUIDs are what a cracked/TLauncher player actually joins with,
  // so the row is keyed the same way rather than inventing a premium UUID.
  const offlineUuid = `offline:${username.toLowerCase()}`;

  if (currentLink) {
    const { error: updateError } = await admin
      .from("minecraft_accounts")
      .update({ minecraft_username: username, minecraft_uuid: offlineUuid, updated_at: now })
      .eq("user_id", user.id);
    if (updateError) return { ok: false, enabled, message: "Could not update your Minecraft name. Please try again." };
  } else {
    const { error: insertError } = await admin.from("minecraft_accounts").insert({
      user_id: user.id,
      minecraft_uuid: offlineUuid,
      minecraft_username: username,
      linked_at: now,
      updated_at: now,
    });
    if (insertError) return { ok: false, enabled, message: "Could not save your Minecraft name. Please try again." };
  }

  // Keep the website handle and skin avatar in step with the IGN.
  await admin
    .from("profiles")
    .update({ username, avatar_url: avatarUrl, updated_at: now })
    .eq("user_id", user.id);

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.updateUser({ data: { username, avatar_url: avatarUrl } });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  // The "layout" scope matters: /admin/account alone leaves the admin shell's
  // header and sidebar — which render the avatar — serving their cached copy.
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");

  return {
    ok: true,
    enabled,
    linked: {
      id: String(currentLink?.id ?? user.id),
      uuid: offlineUuid,
      username,
      linkedAt: now,
    },
    message: `Minecraft name set to ${username}.`,
  };
}

/** Shape returned to the client for a skin-upload attempt. */
export interface SkinUploadActionState {
  ok: boolean;
  message?: string;
}

/**
 * Uploads a real Minecraft skin file and sets its processed head as both the
 * account's profile photo and its public player-facing head icon.
 *
 * Requires an existing linked Minecraft account: there is no player identity
 * to attach a skin to otherwise, and the UI does not offer this option
 * before an IGN is linked (see ProfileAvatarEditor).
 */
export async function uploadMinecraftSkinAction(
  _previous: SkinUploadActionState,
  formData: FormData,
): Promise<SkinUploadActionState> {
  const user = await authenticatedUser();
  if (!user) return { ok: false, message: "Sign in to upload a skin." };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Skin uploads are temporarily unavailable." };

  const { data: mcAccount } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mcAccount) {
    return { ok: false, message: "Link your Minecraft IGN before uploading a skin." };
  }

  const file = formData.get("skin");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a skin file to upload." };
  }
  if (file.size > SKIN_MAX_BYTES) {
    return { ok: false, message: "Skin file must be 512 KB or smaller." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateSkinBytes(bytes);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  if (!(await ensureAvatarBucket())) {
    return { ok: false, message: "Skin storage is temporarily unavailable." };
  }

  const headBuffer = await cropAndCompositeHead(Buffer.from(bytes), validated.format);

  const timestamp = Date.now();
  const rawPath = `${user.id}/skin-raw-${timestamp}.png`;
  const headPath = `${user.id}/skin-head-${timestamp}.png`;

  const { error: rawUploadError } = await admin.storage.from(AVATAR_BUCKET).upload(rawPath, bytes, {
    contentType: "image/png",
    cacheControl: "3600",
    upsert: false,
  });
  if (rawUploadError) return { ok: false, message: "The skin could not be uploaded. Please try again." };

  const { error: headUploadError } = await admin.storage.from(AVATAR_BUCKET).upload(headPath, headBuffer, {
    contentType: "image/png",
    cacheControl: "3600",
    upsert: false,
  });
  if (headUploadError) {
    await admin.storage.from(AVATAR_BUCKET).remove([rawPath]);
    return { ok: false, message: "The skin could not be processed. Please try again." };
  }

  const { data: rawPublicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(rawPath);
  const { data: headPublicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(headPath);
  const now = new Date().toISOString();

  await admin
    .from("minecraft_accounts")
    .update({
      skin_head_url: headPublicUrl.publicUrl,
      raw_skin_url: rawPublicUrl.publicUrl,
      updated_at: now,
    })
    .eq("user_id", user.id);

  await admin
    .from("profiles")
    .update({ avatar_url: headPublicUrl.publicUrl, updated_at: now })
    .eq("user_id", user.id);

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.updateUser({ data: { avatar_url: headPublicUrl.publicUrl } });
  }

  await removeStoredSkinFiles(user.id, [rawPath, headPath]);

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
  revalidatePath("/players", "layout");
  revalidatePath("/leaderboards");

  return { ok: true, message: "Skin uploaded and set as your profile photo." };
}

/**
 * Removes a self-uploaded skin: clears the stored files, the `minecraft_accounts`
 * columns, and — only if the profile's current avatar is actually the uploaded
 * skin, not something the user has since switched to (an upload, Discord photo,
 * or a fresh mc-heads.net lookup) — the profile avatar too.
 *
 * Does not touch the linked Minecraft account itself; that stays connected,
 * this only removes the custom skin layered on top of it.
 */
export async function removeMinecraftSkinAction(
  _previous: SkinUploadActionState,
): Promise<SkinUploadActionState> {
  const user = await authenticatedUser();
  if (!user) return { ok: false, message: "Sign in to remove your skin." };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Skin management is temporarily unavailable." };

  const { data: mcAccount } = await admin
    .from("minecraft_accounts")
    .select("id, skin_head_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mcAccount?.skin_head_url) {
    return { ok: false, message: "No uploaded skin to remove." };
  }

  await removeStoredSkinFiles(user.id);

  const now = new Date().toISOString();
  await admin
    .from("minecraft_accounts")
    .update({ skin_head_url: null, raw_skin_url: null, updated_at: now })
    .eq("user_id", user.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (String(profile?.avatar_url ?? "").includes("/skin-head-")) {
    await admin.from("profiles").update({ avatar_url: null, updated_at: now }).eq("user_id", user.id);
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.updateUser({ data: { avatar_url: null } });
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
  revalidatePath("/players", "layout");
  revalidatePath("/leaderboards");

  return { ok: true, message: "Skin removed." };
}
