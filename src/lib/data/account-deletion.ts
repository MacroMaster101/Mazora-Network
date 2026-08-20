import "server-only";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { anonymiseOrdersForUser } from "@/lib/data/orders";
import { NEWS_IMAGE_BUCKET } from "@/lib/news/image-store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AVATAR_BUCKET } from "@/lib/storage/avatar-bucket";

export type AccountCleanupResult = { ok: true } | { ok: false; message: string };

function galleryObjectKey(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!projectUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.origin !== new URL(projectUrl).origin) return null;

    const markers = [
      `/storage/v1/object/public/${NEWS_IMAGE_BUCKET}/`,
      `/storage/v1/object/sign/${NEWS_IMAGE_BUCKET}/`,
    ];
    const marker = markers.find((candidate) => url.pathname.startsWith(candidate));
    if (!marker) return null;

    const key = decodeURIComponent(url.pathname.slice(marker.length));
    const segments = key.split("/");
    if (!key.startsWith("gallery/") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

async function listAvatarObjects(userId: string): Promise<{ ok: true; paths: string[] } | { ok: false }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false };

  const paths: string[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < 1_000; offset += pageSize) {
    const { data, error } = await admin.storage.from(AVATAR_BUCKET).list(userId, { limit: pageSize, offset });
    if (error) return { ok: false };
    const entries = data ?? [];
    paths.push(...entries.filter((item) => item.name).map((item) => `${userId}/${item.name}`));
    if (entries.length < pageSize) return { ok: true, paths };
  }

  // Refuse deletion instead of silently leaving files behind if an account
  // somehow exceeds the safety ceiling.
  return { ok: false };
}

/**
 * Remove personal files and user-owned content before deleting auth.users.
 * Order rows are retained only after their identifying fields are scrubbed.
 * Any cleanup failure stops account deletion, preventing orphaned personal data.
 */
export async function cleanupAccountOwnedData(userId: string): Promise<AccountCleanupResult> {
  const admin = getSupabaseAdmin();
  const db = getDb();
  if (!admin || !db) {
    return { ok: false, message: "Account data cleanup is temporarily unavailable." };
  }

  try {
    const avatars = await listAvatarObjects(userId);
    if (!avatars.ok) {
      return { ok: false, message: "Stored profile files could not be inspected, so deletion was cancelled." };
    }

    const galleryRows = await db
      .select({ imageUrl: schema.galleryImages.imageUrl, thumbnailUrl: schema.galleryImages.thumbnailUrl })
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.authorId, userId));

    if (!(await anonymiseOrdersForUser(userId))) {
      return { ok: false, message: "Order history could not be anonymised, so deletion was cancelled." };
    }

    if (avatars.paths.length > 0) {
      const { error } = await admin.storage.from(AVATAR_BUCKET).remove(avatars.paths);
      if (error) {
        return { ok: false, message: "Stored profile files could not be removed, so deletion was cancelled." };
      }
    }

    const galleryPaths = Array.from(
      new Set(
        galleryRows
          .flatMap((row) => [galleryObjectKey(row.imageUrl), galleryObjectKey(row.thumbnailUrl)])
          .filter((key): key is string => Boolean(key)),
      ),
    );
    for (let index = 0; index < galleryPaths.length; index += 100) {
      const { error } = await admin.storage.from(NEWS_IMAGE_BUCKET).remove(galleryPaths.slice(index, index + 100));
      if (error) {
        return { ok: false, message: "Stored gallery files could not be removed, so deletion was cancelled." };
      }
    }

    await db.delete(schema.galleryImages).where(eq(schema.galleryImages.authorId, userId));
    return { ok: true };
  } catch (error) {
    console.error("Failed to clean account-owned data before deletion:", error);
    return { ok: false, message: "Account data cleanup failed, so deletion was cancelled." };
  }
}
