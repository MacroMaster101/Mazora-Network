import "server-only";

import { cache } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { siteGuideSeenFromRow } from "@/lib/site-guide";

/**
 * Whether the signed-in member has closed the site guide before.
 *
 * Deliberately separate from ensureUserProfile: that select gates every
 * session, so a missing column there would sign everyone out. Here any failure
 * answers "seen" — the worst case is one member not getting a tour.
 *
 * Demo auth has no profile row, so it answers "not seen" and the client's
 * per-user localStorage flag decides.
 */
export const getSiteGuideSeen = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const admin = getSupabaseAdmin();
  const userId = await getSessionUserId();
  if (!admin || !userId) return true;

  const { data, error } = await admin
    .from("profiles")
    .select("site_guide_seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  return siteGuideSeenFromRow(data, error);
});
