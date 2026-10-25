"use server";

import { getDiscordIdentity, getSession, getSessionUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { emailTwoFactorAvailable } from "@/lib/auth/email-two-factor";
import { getMyPasskeys } from "@/lib/data/passkeys";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SiteGuideStatus } from "@/lib/site-guide";

/** Only an active session (confirmed email, active profile) counts; the bare session id skips those checks. */
async function activeUserId(): Promise<string | null> {
  const session = await getSession();
  return session ? getSessionUserId() : null;
}

/**
 * Records that the member closed the site guide. Only stamps a null column, so
 * repeat calls (every close, including reopened guides) keep the first time.
 */
export async function markSiteGuideSeen(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = getSupabaseAdmin();
  const userId = await activeUserId();
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
  const none: SiteGuideStatus = { ign: null, discord: null, twoFactor: false, emailCodes: false, passkeys: null };
  if (!isSupabaseConfigured()) return none;
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !userId) return none;

  const admin = getSupabaseAdmin();
  const [minecraft, discord, passkeys] = await Promise.all([
    admin
      ? admin.from("minecraft_accounts").select("minecraft_username").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    getDiscordIdentity(),
    // null while passkeys are switched off site-wide, so the guide leaves them out.
    getSiteGeneralSettings().then(async (settings) => settings.passkeysEnabled ? Boolean((await getMyPasskeys())?.length) : null),
  ]);

  return {
    ign: minecraft.data?.minecraft_username ? String(minecraft.data.minecraft_username) : null,
    discord: discord?.username ?? null,
    twoFactor: Boolean(session.twoFactorEnabled),
    emailCodes: emailTwoFactorAvailable(),
    passkeys,
  };
}
