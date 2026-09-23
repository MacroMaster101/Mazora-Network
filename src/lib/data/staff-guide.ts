import "server-only";

import { cache } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { staffGuideSeenFromRow, type StaffGuideSeen } from "@/lib/staff-guide";

/**
 * Boards the signed-in staff member was last shown in the staff guide.
 *
 * Kept out of ensureUserProfile for the same reason as the site guide: that
 * select gates every session. Any failure answers "unknown", which never
 * auto-opens. Demo auth has no profile row and answers null (never shown);
 * the client's per-user localStorage copy decides.
 */
export const getStaffGuideSeenBoards = cache(async (): Promise<StaffGuideSeen> => {
  if (!isSupabaseConfigured()) return null;
  const admin = getSupabaseAdmin();
  const userId = await getSessionUserId();
  if (!admin || !userId) return "unknown";

  const { data, error } = await admin
    .from("profiles")
    .select("staff_guide_boards")
    .eq("user_id", userId)
    .maybeSingle();
  return staffGuideSeenFromRow(data, error);
});
