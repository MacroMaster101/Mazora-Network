import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface UserProfile {
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  account_status: "pending" | "active" | "suspended" | "deleted";
}

function cleanUsername(value: unknown): string {
  const cleaned = String(value ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);
  return cleaned.length >= 3 ? cleaned : "player";
}

/**
 * Returns the auth user's profile, creating a missing row when an older or
 * partially migrated Supabase project does not yet have the signup trigger.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const existing = await admin
    .from("profiles")
    .select("username,display_name,bio,avatar_url,account_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.data) return existing.data as UserProfile;

  const metadata = user.user_metadata ?? {};
  const requested = cleanUsername(
    metadata.username ?? metadata.preferred_username ?? metadata.user_name ?? user.email?.split("@")[0],
  );
  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? requested,
  ).trim().slice(0, 64) || requested;
  const fallback = `${requested.slice(0, 15)}_${user.id.replaceAll("-", "").slice(0, 8)}`;

  for (const username of [requested, fallback]) {
    const created = await admin
      .from("profiles")
      .insert({
        user_id: user.id,
        username,
        display_name: displayName,
        account_status: user.email_confirmed_at ? "active" : "pending",
      })
      .select("username,display_name,bio,avatar_url,account_status")
      .maybeSingle();
    if (created.data) return created.data as UserProfile;
    if (created.error?.code !== "23505") return null;

    // A concurrent request may have created this user's row first.
    const concurrent = await admin
      .from("profiles")
      .select("username,display_name,bio,avatar_url,account_status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (concurrent.data) return concurrent.data as UserProfile;
  }

  return null;
}
