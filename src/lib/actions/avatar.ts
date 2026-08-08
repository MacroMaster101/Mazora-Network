"use server";

import { revalidatePath } from "next/cache";
import { getDiscordIdentity } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AccountActionResult } from "@/lib/actions/account";

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarMime = keyof typeof MIME_EXTENSIONS;

async function authenticatedUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

function detectedMime(bytes: Uint8Array): AvatarMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

async function ensureAvatarBucket() {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.storage.getBucket(AVATAR_BUCKET);
  if (data) return true;
  const { error } = await admin.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_AVATAR_BYTES,
    allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
  });
  return !error || /already exists/i.test(error.message);
}

async function saveAvatarUrl(url: string | null): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to change your photo." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Profile photos are temporarily unavailable." };

  const { data, error } = await admin
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Your profile photo could not be updated. Please try again." };

  await auth.supabase.auth.updateUser({ data: { avatar_url: url } });
  // Both shells must be refreshed, not just the member one: staff manage their
  // own profile at /admin/account, and the header + sidebar they see there are
  // rendered by the /admin layout. Revalidating only /dashboard left them
  // looking at their previous avatar until a hard reload.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
  return { ok: true };
}

async function removeStoredAvatars(userId: string, except?: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { data } = await admin.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
  const paths = (data ?? [])
    .filter((item) => item.name !== except)
    .map((item) => `${userId}/${item.name}`);
  if (paths.length) await admin.storage.from(AVATAR_BUCKET).remove(paths);
}

export async function uploadProfileAvatarAction(
  _previous: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to upload a photo." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { avatar: "Choose a photo to upload." } };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, errors: { avatar: "Photo must be 2 MB or smaller." } };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectedMime(bytes);
  if (!mime || file.type !== mime) {
    return { ok: false, errors: { avatar: "Use a valid PNG, JPEG, or WebP image." } };
  }

  const admin = getSupabaseAdmin();
  if (!admin || !(await ensureAvatarBucket())) {
    return { ok: false, message: "Profile photo storage is temporarily unavailable." };
  }

  const filename = `avatar-${Date.now()}.${MIME_EXTENSIONS[mime]}`;
  const objectPath = `${auth.user.id}/${filename}`;
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(objectPath, bytes, {
    contentType: mime,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return { ok: false, message: "The photo could not be uploaded. Please try again." };

  const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const saved = await saveAvatarUrl(publicUrl.publicUrl);
  if (!saved.ok) {
    await admin.storage.from(AVATAR_BUCKET).remove([objectPath]);
    return saved;
  }

  await removeStoredAvatars(auth.user.id, filename);
  return { ok: true, message: "Profile photo updated." };
}

export async function useMinecraftAvatarAction(
  _previous: AccountActionResult,
  formData?: FormData,
): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to use your Minecraft skin." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Minecraft profile lookup is temporarily unavailable." };

  let targetUsername = "";
  if (formData) {
    targetUsername = String(formData.get("username") ?? "").trim();
  }

  if (!targetUsername) {
    const { data: mcAcc } = await admin
      .from("minecraft_accounts")
      .select("minecraft_username")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (mcAcc?.minecraft_username) {
      targetUsername = String(mcAcc.minecraft_username);
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("username")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      targetUsername = String(profile?.username ?? auth.user.user_metadata?.username ?? "");
    }
  }

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(targetUsername)) {
    return { ok: false, message: "Enter a valid Minecraft username (3–16 letters, numbers, or underscores)." };
  }

  // Anti-theft / unique claim check: verify if another user has already claimed this IGN.
  const { data: existingClaims } = await admin
    .from("minecraft_accounts")
    .select("user_id, minecraft_username")
    .ilike("minecraft_username", targetUsername);

  const stolen = (existingClaims ?? []).find((row) => String(row.user_id) !== auth.user.id);
  if (stolen) {
    return { ok: false, message: `The Minecraft name "${targetUsername}" is already claimed by another user.` };
  }

  const now = new Date().toISOString();

  // Upsert the minecraft_accounts link for this user
  const { data: currentLink } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (currentLink) {
    await admin
      .from("minecraft_accounts")
      .update({ minecraft_username: targetUsername, updated_at: now })
      .eq("user_id", auth.user.id);
  } else {
    await admin.from("minecraft_accounts").insert({
      user_id: auth.user.id,
      minecraft_uuid: `offline:${targetUsername.toLowerCase()}`,
      minecraft_username: targetUsername,
      linked_at: now,
      updated_at: now,
    });
  }

  const skinAvatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(targetUsername)}/256`;
  await admin.from("profiles").update({
    username: targetUsername,
    avatar_url: skinAvatarUrl,
    updated_at: now,
  }).eq("user_id", auth.user.id);

  await auth.supabase.auth.updateUser({ data: { username: targetUsername, avatar_url: skinAvatarUrl } });
  // Both shells must be refreshed, not just the member one: staff manage their
  // own profile at /admin/account, and the header + sidebar they see there are
  // rendered by the /admin layout. Revalidating only /dashboard left them
  // looking at their previous avatar until a hard reload.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");

  await removeStoredAvatars(auth.user.id);
  return { ok: true, message: `Minecraft skin (${targetUsername}) set as profile photo.` };
}

/**
 * Adopt the photo from the account's linked Discord identity.
 *
 * The URL is read from the session's Discord identity, never from the form, and
 * `getDiscordIdentity` already refuses anything not served by
 * cdn.discordapp.com — so a crafted request cannot point a profile photo at an
 * arbitrary host.
 */
export async function useDiscordAvatarAction(
  _previous: AccountActionResult,
): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to use your Discord photo." };

  const discord = await getDiscordIdentity();
  if (!discord?.avatarUrl) {
    return { ok: false, message: "No Discord photo found. Connect Discord first, then try again." };
  }

  const saved = await saveAvatarUrl(discord.avatarUrl);
  if (!saved.ok) return saved;

  // The stored upload is no longer the visible photo, so it should not linger.
  await removeStoredAvatars(auth.user.id);
  return { ok: true, message: `Discord photo (@${discord.username}) set as your profile photo.` };
}

export async function removeProfileAvatarAction(
  _previous: AccountActionResult,
): Promise<AccountActionResult> {
  const auth = await authenticatedUser();
  if (!auth) return { ok: false, message: "You must be signed in to remove your photo." };
  const saved = await saveAvatarUrl(null);
  if (!saved.ok) return saved;
  await removeStoredAvatars(auth.user.id);
  return { ok: true, message: "Profile photo removed." };
}