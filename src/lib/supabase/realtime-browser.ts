import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

let cached: Promise<SupabaseClient | null> | undefined;

/**
 * A browser Supabase client used only to LISTEN on realtime channels.
 *
 * It holds the public key and never a session: sign-in cookies in this app are
 * httpOnly on purpose, and nothing here reads, stores or refreshes them. What
 * it may receive is governed by the realtime policies (migration 053), not by
 * anything in this file.
 *
 * Loaded on demand: supabase-js is the largest dependency of the /forums
 * bundle, and the panels render from server data long before a socket is
 * needed, so it is fetched after the page is interactive rather than with it.
 */
export function getRealtimeBrowserClient(): Promise<SupabaseClient | null> {
  if (cached !== undefined) return cached;
  const config = getSupabaseConfig();
  cached = config
    ? import("@supabase/supabase-js").then(({ createClient }) =>
        createClient(config.url, config.key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
      )
    : Promise.resolve(null);
  return cached;
}
