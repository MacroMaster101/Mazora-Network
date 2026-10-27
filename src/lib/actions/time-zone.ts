"use server";

import { getSession, getSessionUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { accountKey, rateLimitShared } from "@/lib/rate-limit";
import { savedTimeZone, validTimeZone } from "@/lib/time-zone";

/**
 * Saves the signed-in member's browser time zone on their account, so emails
 * sent later (including from scheduled jobs) show times in it. Writes only
 * when it changed; there is no way to set anyone else's.
 */
export async function saveTimeZoneAction(value: string): Promise<{ ok: boolean }> {
  const timeZone = validTimeZone(value);
  if (!timeZone) return { ok: false };
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !userId) return { ok: false };

  const limit = await rateLimitShared(accountKey("time-zone", userId), { limit: 10, windowMs: 60 * 60_000 });
  if (!limit.ok) return { ok: false };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false };
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return { ok: false };
    if (savedTimeZone(data.user.user_metadata) === timeZone) return { ok: true };
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      // Merged by the auth server, so only this key is sent.
      user_metadata: { time_zone: timeZone },
    });
    return { ok: !updateError };
  } catch (error) {
    console.error("Saving the member's time zone failed", error);
    return { ok: false };
  }
}
