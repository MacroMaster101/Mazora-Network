import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/storage/avatar-bucket";

/**
 * Deletes stored skin files for a user, optionally keeping specific paths.
 * Scoped to filenames starting with "skin-" specifically — the
 * profile-avatars bucket also holds this user's general photo uploads under
 * "avatar-*", which must survive a skin upload/removal untouched.
 *
 * Called two ways: with no `keepPaths` to remove everything (Minecraft
 * disconnect — no skin should remain), or with the two paths just uploaded
 * to remove only the now-stale previous files (re-upload).
 *
 * This deliberately lives OUTSIDE any "use server" module: every export of a
 * "use server" file becomes a publicly callable POST endpoint, and this
 * function deletes storage objects for an arbitrary `userId` with the
 * service-role client. As a plain server-only helper it is only reachable
 * from actions that have already authenticated the caller and pass their own
 * `user.id`.
 */
export async function removeStoredSkinFiles(userId: string, keepPaths: string[] = []): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { data } = await admin.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
  const keepNames = new Set(keepPaths.map((path) => path.split("/").pop()));
  const skinFiles = (data ?? []).filter(
    (item) => /^skin-(raw|head)-/.test(item.name) && !keepNames.has(item.name),
  );
  if (skinFiles.length) {
    await admin.storage.from(AVATAR_BUCKET).remove(skinFiles.map((item) => `${userId}/${item.name}`));
  }
}
