import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Premium names are 3–16 of [A-Za-z0-9_]; cracked/TLauncher clients use the same rule. */
export const IGN_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;

export type IgnAvailability = { available: true } | { available: false; conflict: "ign" | "handle" };

/**
 * Escape LIKE/ILIKE wildcards so a name is matched LITERALLY.
 *
 * Usernames allow underscores (`[A-Za-z0-9_]`), and `_` is a single-character
 * wildcard in ILIKE — so an unescaped `ilike("username", "cool_guy")` also
 * matches "coolXguy". That over-match wrongly reports a free name as taken.
 * `%` and `\` cannot appear in a valid username but are escaped too, so the
 * function is safe for any input.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Whether `username` is free to claim as BOTH a Minecraft link and a site
 * handle, checked case-insensitively (both unique indexes are effectively
 * case-insensitive). `exceptUserId` excludes the caller's own rows, so
 * re-linking your own name is not treated as a conflict.
 *
 * Returns which namespace collided so the caller can word the message for its
 * own context (registration vs. the dashboard editor).
 */
export async function ignAvailability(
  admin: SupabaseClient,
  username: string,
  exceptUserId?: string,
): Promise<IgnAvailability> {
  const pattern = escapeLike(username);

  const { data: claims } = await admin
    .from("minecraft_accounts")
    .select("user_id")
    .ilike("minecraft_username", pattern);
  if ((claims ?? []).some((row) => String(row.user_id) !== exceptUserId)) {
    return { available: false, conflict: "ign" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("username", pattern)
    .maybeSingle();
  if (profile && String(profile.user_id) !== exceptUserId) {
    return { available: false, conflict: "handle" };
  }

  return { available: true };
}

export interface LinkedIgn {
  ok: boolean;
  avatarUrl: string;
  uuid: string;
  /** Existing minecraft_accounts row id, or null when a new row was inserted. */
  linkId: string | null;
}

/**
 * Point a user's Minecraft link and site handle at `username`: upsert the
 * minecraft_accounts row (offline UUID) and set profiles.username + the skin
 * head avatar. Availability must be vetted separately (see ignAvailability) —
 * this performs the writes and reports whether they landed.
 *
 * Deliberately does NOT touch auth metadata: that requires the user's own
 * session, which the registration path (a not-yet-signed-in user) does not
 * have. Callers with a session update metadata themselves afterwards.
 */
export async function linkMinecraftIgn(
  admin: SupabaseClient,
  userId: string,
  username: string,
): Promise<LinkedIgn> {
  const now = new Date().toISOString();
  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/256`;
  // Offline-mode UUIDs are what a cracked/TLauncher player actually joins with,
  // so the row is keyed the same way rather than inventing a premium UUID.
  const uuid = `offline:${username.toLowerCase()}`;

  const { data: currentLink } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const linkId = currentLink?.id ? String(currentLink.id) : null;

  if (currentLink) {
    const { error } = await admin
      .from("minecraft_accounts")
      .update({ minecraft_username: username, minecraft_uuid: uuid, updated_at: now })
      .eq("user_id", userId);
    if (error) return { ok: false, avatarUrl, uuid, linkId };
  } else {
    const { error } = await admin.from("minecraft_accounts").insert({
      user_id: userId,
      minecraft_uuid: uuid,
      minecraft_username: username,
      linked_at: now,
      updated_at: now,
    });
    if (error) return { ok: false, avatarUrl, uuid, linkId };
  }

  // profiles_username_idx is case-SENSITIVE while the availability check uses
  // ilike, so a failed write here is surfaced rather than silently reporting
  // success with the old handle still in place.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ username, avatar_url: avatarUrl, updated_at: now })
    .eq("user_id", userId);
  if (profileError) return { ok: false, avatarUrl, uuid, linkId };

  return { ok: true, avatarUrl, uuid, linkId };
}
