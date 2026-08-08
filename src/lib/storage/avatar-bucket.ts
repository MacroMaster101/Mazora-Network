import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Storage bucket shared by profile photo uploads and self-uploaded Minecraft
 * skins. Lives outside `@/lib/actions/avatar.ts` because that file carries
 * `"use server"`, and Next.js requires every export from a `"use server"`
 * file to be an async function — a plain string constant can't be exported
 * from there.
 */
export const AVATAR_BUCKET = "profile-avatars";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_BUCKET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function ensureAvatarBucket(): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.storage.getBucket(AVATAR_BUCKET);
  if (data) return true;
  const { error } = await admin.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_AVATAR_BYTES,
    allowedMimeTypes: AVATAR_BUCKET_MIME_TYPES,
  });
  return !error || /already exists/i.test(error.message);
}
