/**
 * The Supabase server-side key.
 *
 * Supabase's new API keys (`sb_secret_…`) replace the legacy JWT
 * `service_role` key and can be rotated or revoked on their own. Either works:
 * `SUPABASE_SECRET_KEY` is preferred, and `SUPABASE_SERVICE_ROLE_KEY` is read
 * as a fallback so an existing deployment keeps working while it migrates.
 *
 * Never import this into a Client Component. It reads only server env vars
 * (no NEXT_PUBLIC_ prefix), so the value is never bundled for the browser.
 */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}
