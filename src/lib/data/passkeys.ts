import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** One of the signed-in member's passkeys, for Settings > Passkeys. */
export interface PasskeySummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * The signed-in member's passkeys, newest first, or null when Supabase could
 * not be asked (passkeys off in the Supabase project, or an outage), so the
 * card can say so instead of claiming there are none.
 */
export async function getMyPasskeys(): Promise<PasskeySummary[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.passkey.list();
    if (error || !data) return null;
    return data
      .map((item) => ({
        id: item.id,
        name: item.friendly_name?.trim() || "Passkey",
        createdAt: item.created_at,
        lastUsedAt: item.last_used_at ?? null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error("Failed to list passkeys", error);
    return null;
  }
}
