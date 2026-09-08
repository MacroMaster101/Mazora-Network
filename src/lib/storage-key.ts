/**
 * Normalises an object key before it is used against Supabase Storage.
 *
 * Free of `server-only` so the rule is unit tested directly; the single caller
 * is `storeImageBytes` in lib/news/image-store.ts, which is where every upload
 * path — direct file, re-hosted URL, Discord import — converges.
 *
 * Callers compose keys from request data. `uploadArticleImageAction` builds
 * `custom/${id}-${Date.now()}` where `id` is `clean(formData.get("id"), 64)` —
 * trimmed and truncated, but never checked for shape, even though the column
 * it addresses is a uuid. `adminSaveGalleryAction` does the same. The upload
 * then runs with `upsert: true`.
 *
 * Nothing here is reachable without staff rights, and Supabase scopes every
 * operation to one bucket, so a crafted key cannot leave `news-images` or read
 * anything back. What it could do is write to an unexpected key inside that
 * bucket and overwrite an image already there. That is a small hole, and this
 * is a small guard — but it sits on the one line every upload passes through,
 * so it costs nothing to close and does not have to be remembered at seven
 * call sites.
 */

/** Keys are `<prefix>/<name>` and the caller appends `.<ext>` afterwards. */
const ALLOWED_IN_SEGMENT = /[^A-Za-z0-9._-]/g;

/**
 * Comfortably above anything the codebase builds — the longest real key is a
 * prefix plus a uuid plus a timestamp, around 60 characters — and well inside
 * the limits of every storage backend.
 */
export const MAX_STORAGE_KEY_LENGTH = 200;

/**
 * A key safe to hand to storage, or null when nothing usable survives.
 *
 * Null rather than a fallback string on purpose: a caller that cannot produce a
 * real key should refuse the upload, not invent one. Returning `""` here would
 * put the object at the bucket root under a bare extension and, with upsert on,
 * overwrite whatever previous caller did the same.
 *
 * `.` and `..` segments are dropped rather than rejected outright. The point is
 * to make the key harmless, and a request carrying one is far more likely to be
 * a mangled id than an attack — refusing would turn a cosmetic bug into a
 * failed upload for staff.
 */
export function safeStorageKey(keyBase: string): string | null {
  if (typeof keyBase !== "string") return null;

  const segments: string[] = [];
  for (const raw of keyBase.split("/")) {
    const segment = raw.replace(ALLOWED_IN_SEGMENT, "");
    // Empty covers stray slashes; "." and ".." cover traversal.
    if (!segment || segment === "." || segment === "..") continue;
    segments.push(segment);
  }
  if (segments.length === 0) return null;

  let key = segments.join("/");
  if (key.length > MAX_STORAGE_KEY_LENGTH) {
    key = key.slice(0, MAX_STORAGE_KEY_LENGTH);
    // The caller appends `.${ext}`, so a truncated key must not end in a
    // separator or a dot — that produces `custom/x/.webp` or `custom/x..webp`.
    key = key.replace(/[./]+$/, "");
  }

  return key.length > 0 ? key : null;
}
