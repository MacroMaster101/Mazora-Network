/**
 * Return true only for an object URL served by the configured Supabase project.
 * Parsed-origin comparison rejects lookalike hosts such as
 * `project.supabase.co.evil.example`.
 */
export function isSupabaseStorageObjectUrl(value: string, supabaseUrl: string | null | undefined): boolean {
  if (!supabaseUrl?.trim()) return false;

  try {
    const candidate = new URL(value);
    const project = new URL(supabaseUrl);
    return candidate.origin === project.origin && candidate.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
}

/**
 * True only for an object in one bucket's PUBLIC path on the configured
 * project.
 *
 * Being on the project's storage origin is not enough. That origin also serves
 * other buckets and the signed and authenticated object routes, and nothing
 * says what they hold went through the upload checks.
 *
 * The path is read from the parsed URL, which has already resolved any `..`
 * segments, so a link cannot start in the bucket and climb out of it.
 */
export function isPublicBucketObjectUrl(value: string, supabaseUrl: string | null | undefined, bucket: string): boolean {
  if (!bucket || !isSupabaseStorageObjectUrl(value, supabaseUrl)) return false;
  try {
    return new URL(value).pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
  } catch {
    return false;
  }
}
