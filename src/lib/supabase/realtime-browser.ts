import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

let cached: SupabaseClient | null | undefined;

/**
 * A browser Supabase client used only to LISTEN on realtime channels.
 *
 * It holds the public key and never a session: sign-in cookies in this app are
 * httpOnly on purpose, and nothing here reads, stores or refreshes them. What
 * it may receive is governed by the realtime policies (migration 053), not by
 * anything in this file.
 */
export function getRealtimeBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const config = getSupabaseConfig();
  cached = config
    ? createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;
  return cached;
}
