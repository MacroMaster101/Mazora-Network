const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

const configured = isHttpUrl(url) && Boolean(key);

export function isSupabaseConfigured(): boolean {
  return configured;
}

export function getSupabaseConfig(): { url: string; key: string } | null {
  return configured && url && key ? { url, key } : null;
}

/**
 * Whether unsigned demo-session cookies are accepted. Demo auth is a
 * development-only convenience and is rejected unconditionally in production —
 * AUTH_DEMO_MODE cannot re-enable it there, so a stray env var can never open
 * up unsigned sessions on a live deployment.
 */
export function isDemoAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.AUTH_DEMO_MODE === "true") return true;
  return !isSupabaseConfigured();
}