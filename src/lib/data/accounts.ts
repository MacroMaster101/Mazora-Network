import "server-only";
import { eq } from "drizzle-orm";
import { ROLES, hasAtLeast } from "@/lib/auth/roles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** The subset of the GoTrue user record these readers touch. */
type AuthUserRecord = Awaited<ReturnType<NonNullable<ReturnType<typeof getSupabaseAdmin>>["auth"]["admin"]["listUsers"]>>["data"]["users"][number];
import { getDb, schema } from "@/lib/db/client";
import { isMinecraftAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-source";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import type { Role } from "@/lib/types";

/**
 * Account directory, read from Supabase Auth and joined to profiles.
 *
 * Roles live in `app_metadata`, which only the service key can write, so auth
 * is the source of truth for rank. Names come from `profiles`: an account
 * created through OAuth has no username in `user_metadata`, so reading auth
 * alone showed everyone by the local part of their email — a full real name,
 * for someone the whole site knows by a short handle.
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
  minecraftUsername: string | null;
  /** Processed head from an uploaded Minecraft skin, when one exists. */
  minecraftSkinUrl: string | null;
  /**
   * The avatar this member actually chose: an uploaded photo, or the mc-heads
   * skin URL written when they pick "Minecraft skin". Falls back to the photo
   * that came with their sign-in provider, then null (callers show a monogram).
   */
  avatarUrl: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** Set when the account was created by an invitation. */
  invitedAt: string | null;
  /** Invited, but the link has not been used yet — no sign-in, no confirmation. */
  pendingInvite: boolean;
  /** Whether this staff account appears in the public team hierarchy. */
  publicStaffVisible: boolean;
  /**
   * Discord account id, when one is linked and well-formed. Needed to DM a
   * staff member. Read from identities already fetched for resolveAvatarUrl,
   * so this adds no round trip.
   */
  discordUserId: string | null;
}

export type PublicStaffMember = Pick<
  AccountSummary,
  "userId" | "username" | "role" | "minecraftUsername" | "minecraftSkinUrl"
> & { minecraftAvatarUrl: string | null };

function toRole(value: unknown): Role {
  return typeof value === "string" && ROLES.includes(value as Role) ? (value as Role) : "member";
}

interface ProfileName {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** The one place the site's username precedence is defined. */
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
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.profiles);
    for (const row of rows) {
      map.set(row.userId, {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      });
    }
  } catch (error) {
    console.error("Failed to load profile names:", error);
  }
  return map;
}

async function minecraftProfiles(): Promise<Map<string, { username: string; skinUrl: string | null }>> {
  const db = getDb();
  const map = new Map<string, { username: string; skinUrl: string | null }>();
  if (!db) return map;
  try {
    const rows = await db
      .select({
        userId: schema.minecraftAccounts.userId,
        minecraftUsername: schema.minecraftAccounts.minecraftUsername,
        skinHeadUrl: schema.minecraftAccounts.skinHeadUrl,
      })
      .from(schema.minecraftAccounts);
    for (const row of rows) {
      map.set(row.userId, { username: row.minecraftUsername, skinUrl: row.skinHeadUrl });
    }
  } catch (error) {
    console.error("Failed to load minecraft usernames:", error);
  }
  return map;
}

/*
  GoTrue caps listUsers at one page. Both callers asked for perPage: 200 and
  used the result as if it were everything, so past 200 accounts the admin
  control room reported "200 accounts" permanently, and any staff member created
  after the cut-off disappeared from the Users board, the public team page and
  the player directory's role lookup.

  Pages until short or empty, with a hard ceiling so a runaway loop can never
  hang an admin render.
*/
const USER_PAGE_SIZE = 200;
const USER_PAGE_LIMIT = 50;

export async function listAllAuthUsers(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<{ users: AuthUserRecord[]; error: string | null }> {
  const users: AuthUserRecord[] = [];
  for (let page = 1; page <= USER_PAGE_LIMIT; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE });
    if (error) return { users, error: error.message };
    const batch = data?.users ?? [];
    users.push(...(batch as AuthUserRecord[]));
    if (batch.length < USER_PAGE_SIZE) break;
  }
  return { users, error: null };
}

/** Every account, newest rank-holders included. Returns null when unconfigured. */
export async function listAccounts(): Promise<AccountSummary[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  try {
    const { users, error } = await listAllAuthUsers(admin);
    if (error) {
      console.error("Failed to list accounts:", error);
      return null;
    }
    const data = { users };

    // Independent queries; awaiting them in sequence doubled the latency of
    // every admin user-list render for no reason.
    const [names, minecraft] = await Promise.all([profileNames(), minecraftProfiles()]);

    return (data?.users ?? []).map((user) => {
      const profile = names.get(user.id);
      const username = resolveUsername({
        profileUsername: profile?.username,
        metadataUsername: user.user_metadata?.username,
        email: user.email,
      });
      const displayName = profile?.displayName ?? null;
      const minecraftProfile = minecraft.get(user.id);
      const minecraftUsername = minecraftProfile?.username ?? null;

      return {
        userId: user.id,
        username: String(username),
        displayName: displayName && displayName !== username ? displayName : null,
        email: user.email ?? "",
        role: toRole(user.app_metadata?.role),
        minecraftUsername,
        minecraftSkinUrl: minecraftProfile?.skinUrl ?? null,
        avatarUrl: resolveAvatarUrl(
          profile?.avatarUrl,
          user.identities?.find((identity) => identity.provider === "google")?.identity_data,
          user.user_metadata,
          ...(user.identities ?? [])
            .filter((identity) => identity.provider !== "google")
            .map((identity) => identity.identity_data),
        ),
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        invitedAt: user.invited_at ?? null,
        pendingInvite: Boolean(user.invited_at) && !user.last_sign_in_at && !user.email_confirmed_at,
        // Existing staff and newly promoted accounts are public by default.
        // Only an explicit protected metadata flag hides someone.
        publicStaffVisible: user.app_metadata?.staff_public !== false,
        discordUserId: (() => {
          const identity = pickDiscordIdentity(user.identities);
          const raw = String(
            (identity?.identity_data as Record<string, unknown> | undefined)?.provider_id ??
              (identity?.identity_data as Record<string, unknown> | undefined)?.sub ??
              "",
          ).trim();
          // Same shape test getDiscordIdentity applies, so a malformed id is
          // treated as "not linked" rather than being handed to the Discord API.
          return /^\d{17,20}$/.test(raw) ? raw : null;
        })(),
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

/** Public-safe team data: no email, sign-in timestamps, or invitation details. */
export async function listPublicStaffAccounts(): Promise<PublicStaffMember[] | null> {
  const staff = await listStaffAccounts();
  if (!staff) return null;
  return staff
    // IT is an internal systems role, never a public team rank. Keep this
    // guard in the repository so no public caller can accidentally expose it.
    .filter((account) => account.role !== "it" && !account.pendingInvite && account.publicStaffVisible)
    .map(({ userId, username, role, minecraftUsername, minecraftSkinUrl, avatarUrl }) => {
      const safeSkinUrl = isMinecraftAvatarUrl(minecraftSkinUrl) ? minecraftSkinUrl : null;
      return {
        userId,
        username,
        role,
        minecraftUsername,
        minecraftSkinUrl: safeSkinUrl,
        minecraftAvatarUrl: safeSkinUrl ?? (isMinecraftAvatarUrl(avatarUrl) ? avatarUrl : null),
      };
    });
}
