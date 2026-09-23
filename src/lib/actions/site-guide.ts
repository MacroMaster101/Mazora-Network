"use server";

import { getDiscordIdentity, getSessionUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SiteGuideStatus } from "@/lib/site-guide";

/**
 * Records that the member closed the site guide. Only stamps a null column, so
 * repeat calls (every close, including reopened guides) keep the first time.
 */
export async function markSiteGuideSeen(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = getSupabaseAdmin();
  const userId = await getSessionUserId();
  if (!admin || !userId) return;

  await admin
    .from("profiles")
    .update({ site_guide_seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("site_guide_seen_at", null);
}

/**
 * What the guide can show as already done. Read when the dialog opens, so page
 * renders pay nothing for it while the guide is closed.
 */
export async function getSiteGuideStatus(): Promise<SiteGuideStatus> {
  const none: SiteGuideStatus = { ign: null, discord: null };
  if (!isSupabaseConfigured()) return none;
  const userId = await getSessionUserId();
  if (!userId) return none;

  const admin = getSupabaseAdmin();
  const [minecraft, discord] = await Promise.all([
    admin
      ? admin.from("minecraft_accounts").select("minecraft_username").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    getDiscordIdentity(),
  ]);

  return {
    ign: minecraft.data?.minecraft_username ? String(minecraft.data.minecraft_username) : null,
    discord: discord?.username ?? null,
  };
}
