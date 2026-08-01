import "server-only";
import { eq } from "drizzle-orm";
import { ROLES, hasAtLeast } from "@/lib/auth/roles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";
import type { Role } from "@/lib/types";

/**
 * Account directory, read from Supabase Auth and joined to profiles.
 *
 * Roles live in `app_metadata`, which only the service key can write, so auth
 * is the source of truth for rank. Names come from `profiles`: an account
 * created through OAuth has no username in `user_metadata`, so reading auth
 * alone showed everyone by the local part of their email — "lakshankavishatt"
 * for someone the whole site knows as "kaviyaz".
 *
 * `profiles.role` is a mirror and can drift, so it is deliberately ignored here.
 */

export interface AccountSummary {
  userId: string;
  /** Site username, from profiles where one exists. */
  username: string;
  /** Chosen display name, when it differs from the username. */
  displayName: string | null;
  email: string;
  role: Role;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** Set when the account was created by an invitation. */
  invitedAt: string | null;
  /** Invited, but the link has not been used yet — no sign-in, no confirmation. */
  pendingInvite: boolean;
}

function toRole(value: unknown): Role {
  return typeof value === "string" && ROLES.includes(value as Role) ? (value as Role) : "member";
}

interface ProfileName {
  username: string;
  displayName: string | null;
}

/**
 * The one place the site's username precedence is defined.
 *
 * Profile first, then whatever auth carries, then the email local part as a
 * last resort. Anything that shows a username to a person, or compares one that
 * a person typed, must go through this — the delete dialog once rendered the
 * profile name while the server compared against the email-derived one, so a
 * correctly typed confirmation was rejected every time.
 */
export function resolveUsername(input: {
  profileUsername?: string | null;
  metadataUsername?: unknown;
  email?: string | null;
}): string {
  const profile = typeof input.profileUsername === "string" ? input.profileUsername.trim() : "";
  if (profile) return profile;
  const metadata = typeof input.metadataUsername === "string" ? input.metadataUsername.trim() : "";
  if (metadata) return metadata;
  return input.email?.split("@")[0] ?? "player";
}

/** Site username for one account, resolved the same way the lists resolve it. */
export async function usernameForUser(
  userId: string,
  authUser: { user_metadata?: Record<string, unknown> | null; email?: string | null },
): Promise<string> {
  const db = getDb();
  let profileUsername: string | null = null;
  if (db) {
    try {
      const [row] = await db
        .select({ username: schema.profiles.username })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId))
        .limit(1);
      profileUsername = row?.username ?? null;
    } catch (error) {
      console.error("Failed to resolve username:", error);
    }
  }
  return resolveUsername({
    profileUsername,
    metadataUsername: authUser.user_metadata?.username,
    email: authUser.email ?? null,
  });
}

/** Site names keyed by auth user id. Empty when the database is unavailable. */
async function profileNames(): Promise<Map<string, ProfileName>> {
  const db = getDb();
  const map = new Map<string, ProfileName>();
  if (!db) return map;
  try {
    const rows = await db
      .select({
        userId: schema.profiles.userId,
        username: schema.profiles.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.profiles);
    for (const row of rows) {
      map.set(row.userId, { username: row.username, displayName: row.displayName });
    }
  } catch (error) {
    console.error("Failed to load profile names:", error);
  }
  return map;
}

/** Every account, newest rank-holders included. Returns null when unconfigured. */
export async function listAccounts(): Promise<AccountSummary[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      console.error("Failed to list accounts:", error.message);
      return null;
    }

    const names = await profileNames();

    return (data?.users ?? []).map((user) => {
      const profile = names.get(user.id);
      const username = resolveUsername({
        profileUsername: profile?.username,
        metadataUsername: user.user_metadata?.username,
        email: user.email,
      });
      const displayName = profile?.displayName ?? null;

      return {
      userId: user.id,
      username: String(username),
      displayName: displayName && displayName !== username ? displayName : null,
      email: user.email ?? "",
      role: toRole(user.app_metadata?.role),
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      invitedAt: user.invited_at ?? null,
      // An accepted invite leaves a sign-in or a confirmation behind, so the
      // absence of both is what makes an invitation still outstanding.
      pendingInvite: Boolean(user.invited_at) && !user.last_sign_in_at && !user.email_confirmed_at,
      };
    });
  } catch (error) {
    console.error("Failed to list accounts:", error);
    return null;
  }
}

/** Accounts at helper rank or above, i.e. the actual team. */
export async function listStaffAccounts(): Promise<AccountSummary[] | null> {
  const accounts = await listAccounts();
  if (!accounts) return null;
  return accounts.filter((account) => hasAtLeast(account.role, "helper"));
}
