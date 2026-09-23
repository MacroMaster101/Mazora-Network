"use server";

import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { getAdminNavAccess } from "@/lib/auth/permissions";
import { visibleAdminNav } from "@/lib/admin-nav";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Records the boards the staff member has now been shown. Takes nothing from
 * the client: the list is recomputed from their current rank and grants, so it
 * can only ever hold boards they can really open.
 */
export async function markStaffGuideSeen(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const session = await getSession();
  if (!session || !isStaff(session.role)) return;
  const admin = getSupabaseAdmin();
  const userId = await getSessionUserId();
  if (!admin || !userId) return;

  const access = await getAdminNavAccess(session, userId);
  const boards = visibleAdminNav(session.role, access).flatMap((group) => group.items.map((item) => item.href));
  await admin.from("profiles").update({ staff_guide_boards: boards }).eq("user_id", userId);
}
