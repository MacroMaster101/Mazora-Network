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
