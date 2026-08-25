"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { getDiscordIdentity } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { throttleAuthAction } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AVATAR_BUCKET, ensureAvatarBucket } from "@/lib/storage/avatar-bucket";
import type { AccountActionResult } from "@/lib/actions/account";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Avatars render at ~256px; 512 keeps them crisp on retina without storing more. */
const MAX_AVATAR_DIMENSION = 512;
/** Formats accepted for upload. Everything is re-encoded to WebP before storage. */
type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Re-encode an accepted upload through sharp before it is ever stored.
 *
 * Magic-byte + MIME validation only proves the file STARTS with an image
 * header; it says nothing about what follows. Storing the original bytes
 * verbatim would serve them back to every visitor untouched — carrying any
 * EXIF/GPS metadata the member's camera wrote, and any payload appended after
 * the image data (a valid-header "polyglot"). Decoding to raw pixels and
 * re-encoding discards both: only the pixels survive, and sharp drops metadata
 * unless explicitly asked to keep it. `.rotate()` bakes in the EXIF orientation
 * first, so stripping that metadata cannot leave a sideways photo. The result
 * is a bounded, static WebP regardless of what was uploaded.
 *
 * Returns null when the bytes cannot be decoded, so a file that slipped past
 * the header check is refused rather than stored.
 */
async function sanitizeAvatar(bytes: Uint8Array): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize(MAX_AVATAR_DIMENSION, MAX_AVATAR_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

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

  /*
    Every call buffers up to 2 MB, runs a sharp pipeline and does a
    list+upload+remove against storage. Being signed in bounded who could do
    that, not how often — one account could loop it indefinitely.
  */
  const uploadThrottled = await throttleAuthAction("media-upload", {
    limit: 10,
    windowMs: 10 * 60_000,
    identity: auth.user.id,
  });
  if (uploadThrottled) return { ok: false, message: uploadThrottled };

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

  // Re-encode before storing: strips EXIF/GPS metadata and any bytes appended
  // after the image (see sanitizeAvatar). The magic-byte check above only
  // vouches for the header, so the raw upload is never the thing we serve back.
  const sanitized = await sanitizeAvatar(bytes);
  if (!sanitized) {
    return { ok: false, errors: { avatar: "That image could not be processed. Try a different file." } };
  }

  const admin = getSupabaseAdmin();
  if (!admin || !(await ensureAvatarBucket())) {
    return { ok: false, message: "Profile photo storage is temporarily unavailable." };
  }

  // Always stored as WebP: sanitizeAvatar re-encodes every accepted format to it.
  const filename = `avatar-${Date.now()}.webp`;
  const objectPath = `${auth.user.id}/${filename}`;
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(objectPath, sanitized, {
    contentType: "image/webp",
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

  /*
    Takes an arbitrary username from the form and, on success, writes both
    minecraft_accounts and the site handle. Ownership is checked, so this is not
    takeover — but unthrottled it let one account walk the namespace and claim
    every unclaimed IGN, at 3-5 admin-key round trips each.
  */
  const claimThrottled = await throttleAuthAction("ign-claim", {
    limit: 5,
    windowMs: 60 * 60_000,
    identity: auth.user.id,
  });
  if (claimThrottled) return { ok: false, message: claimThrottled };
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

  // profiles.username is UNIQUE and is a separate namespace from
  // minecraft_accounts: a name can be free as an IGN yet taken as a website
  // handle. Without this pre-check the profiles update below failed on the
  // constraint while the action still reported success (same guard as
  // linkMinecraftUsernameAction in minecraft.ts).
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("username", targetUsername)
    .maybeSingle();
  if (existingProfile && String(existingProfile.user_id) !== auth.user.id) {
    return { ok: false, message: `The website handle "${targetUsername}" is already used by another user account.` };
  }

  const now = new Date().toISOString();

  // Upsert the minecraft_accounts link for this user
  const { data: currentLink } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  /*
    Both writes are checked, and the update rewrites minecraft_uuid as well —
    linkMinecraftUsernameAction in minecraft.ts already does both and this path
    did neither.

    Dropping the error let a failed insert (it violates mc_accounts_uuid_idx
    whenever another account already holds `offline:<name>`) fall straight
    through to the profile update and return "…set as profile photo." The caller
    then had a website handle and avatar for an IGN with no minecraft_accounts
    row — and uploadMinecraftSkinAction would refuse them with "Link your
    Minecraft IGN first" for a name the UI said was theirs.

    Leaving minecraft_uuid stale on the update path was the other half: the row
    kept the uuid of a previously claimed name, so the unique index no longer
    guarded the name actually stored in minecraft_username.
  */
  const offlineUuid = `offline:${targetUsername.toLowerCase()}`;

  if (currentLink) {
    const { error: updateError } = await admin
      .from("minecraft_accounts")
      .update({ minecraft_username: targetUsername, minecraft_uuid: offlineUuid, updated_at: now })
      .eq("user_id", auth.user.id);
    if (updateError) {
      return { ok: false, message: "That Minecraft name could not be linked. It may already be claimed." };
    }
  } else {
    const { error: insertError } = await admin.from("minecraft_accounts").insert({
      user_id: auth.user.id,
      minecraft_uuid: offlineUuid,
      minecraft_username: targetUsername,
      linked_at: now,
      updated_at: now,
    });
    if (insertError) {
      return { ok: false, message: "That Minecraft name could not be linked. It may already be claimed." };
    }
  }

  const skinAvatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(targetUsername)}/256`;
  const { error: profileError } = await admin.from("profiles").update({
    username: targetUsername,
    avatar_url: skinAvatarUrl,
    updated_at: now,
  }).eq("user_id", auth.user.id);
  if (profileError) {
    // Do NOT update auth metadata here: it would record a username the
    // profile row does not actually hold.
    return { ok: false, message: "Your profile could not be updated. Please try again." };
  }

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