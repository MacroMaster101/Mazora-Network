import { rawSkinUrlForHead, resolvePlayerSkin } from "@/lib/minecraft/skin";
import { isMinecraftAvatarUrl, resolveAvatarUrl } from "@/lib/avatar-source";
import { publicUsername, siteUsername } from "@/lib/auth/placeholder";
import { isRoleKey, normalizeRoleKey, publicRole } from "@/lib/auth/roles";
import type { DirectoryPlayer, OnlinePlayer, Player, Role } from "@/lib/types";
import type { LinkedAccount } from "@/lib/data/minecraft-accounts";

/**
 * The public player directory, merged from the four sources that carry data:
 *
 *   ping sample         → who is online right now (live)
 *   minecraft_players   → statistics (empty until a sync source is wired up)
 *   minecraft_accounts  → linked Mazora members and their uploaded skins
 *   accounts            → authoritative roles (app_metadata) and registered site members
 *
 * Merging happens on the lowercased username because that is the only key all
 * sources share: the ping sample's UUIDs are name-derived v3 UUIDs on an
 * offline-mode server, so they identify a name, not a person.
 *
 * This module is deliberately pure (no `server-only`, no database imports) so
 * `buildDirectory` can be unit tested with plain Node `--test`, without
 * dragging the postgres driver into the test process. `src/lib/data/directory.ts`
 * wraps this with the actual data sources for server use.
 */

/** Only the fields the merge reads, so tests need not build a whole Player. */
type PlayerRow = Pick<
  Player,
  "username" | "playtimeSeconds" | "playtimeTracked" | "balance" | "balanceTracked" | "status" | "firstJoined" | "lastSeen"
>;

/** Account shape the merge reads — matches the relevant fields of AccountSummary. */
export interface AccountInfo {
  username: string;
  minecraftUsername: string | null;
  minecraftSkinUrl?: string | null;
  role: Role;
  avatarUrl: string | null;
}

/** What publicDirectoryAccounts reads: AccountSummary's fields, plus the ones it filters on. */
export interface DirectoryAccountSource extends AccountInfo {
  userId: string;
  email: string;
  pendingInvite: boolean;
  accountStatus: string | null;
}

/**
 * The accounts the public player list may show, and only what it may show of
 * them. Anyone can create an account for any address, so an account appears
 * only once it is active: its email confirmed (035 activates the profile then),
 * not suspended or deleted, and not an unused invitation. Web Dev is an
 * internal systems role, never a public rank (as on the public team page), so
 * it reads as "member". A username that is only the email handle is replaced
 * with the account's placeholder.
 */
export function publicDirectoryAccounts(accounts: DirectoryAccountSource[]): AccountInfo[] {
  return accounts
    .filter((account) => account.accountStatus === "active" && !account.pendingInvite)
    .map((account) => ({
      username: publicUsername(account),
      minecraftUsername: account.minecraftUsername,
      minecraftSkinUrl: account.minecraftSkinUrl ?? null,
      role: publicRole(account.role),
      avatarUrl: account.avatarUrl,
    }));
}

/**
 * One row of the public roster query (lib/data/accounts readPublicRoster):
 * profiles joined to auth.users, already limited to active accounts that are
 * not unused invitations. Column names as postgres returns them.
 */
export interface PublicRosterSource {
  user_id: unknown;
  username: unknown;
  avatar_url: unknown;
  email: unknown;
  role: unknown;
  staff_hidden: unknown;
  user_metadata: unknown;
  minecraft_username: unknown;
  skin_head_url: unknown;
}

/**
 * A roster entry as the public pages may hold it. The auth id stays on the
 * server (the team page needs it to look up presence) and is never rendered;
 * the email is used once, to replace an email-handle username, and dropped.
 * `role` is the stored rank: callers that show it pass it through publicRole.
 */
export interface PublicRosterAccount {
  userId: string;
  username: string;
  role: Role;
  minecraftUsername: string | null;
  minecraftSkinUrl: string | null;
  avatarUrl: string | null;
  publicStaffVisible: boolean;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

export function toPublicRosterAccount(row: PublicRosterSource): PublicRosterAccount | null {
  const userId = text(row.user_id);
  if (!userId) return null;
  const email = text(row.email);
  const metadata =
    row.user_metadata && typeof row.user_metadata === "object" ? (row.user_metadata as Record<string, unknown>) : null;
  const username = siteUsername({ profileUsername: text(row.username), metadataUsername: metadata?.username, email, userId });
  const role = normalizeRoleKey(row.role);
  return {
    userId,
    username: publicUsername({ username, email, userId }),
    role: isRoleKey(role) ? role : "member",
    minecraftUsername: text(row.minecraft_username),
    minecraftSkinUrl: text(row.skin_head_url),
    avatarUrl: resolveAvatarUrl(text(row.avatar_url), metadata),
    publicStaffVisible: row.staff_hidden !== true,
  };
}

/** The public roster as the player directory reads it: public ranks only. */
export function rosterDirectoryAccounts(roster: PublicRosterAccount[]): AccountInfo[] {
  return roster.map((account) => ({
    username: account.username,
    minecraftUsername: account.minecraftUsername,
    minecraftSkinUrl: account.minecraftSkinUrl,
    role: publicRole(account.role),
    avatarUrl: account.avatarUrl,
  }));
}

export interface BuildDirectoryInput {
  online: OnlinePlayer[];
  players: PlayerRow[];
  members: LinkedAccount[];
  /** Accounts from the auth system; empty array when unavailable. */
  accounts?: AccountInfo[];
}

export function buildDirectory({ online, players, members, accounts = [] }: BuildDirectoryInput): DirectoryPlayer[] {
  type Entry = {
    username: string;
    online: boolean;
    member?: LinkedAccount;
    account?: AccountInfo;
    row?: PlayerRow;
  };
  const byKey = new Map<string, Entry>();

  const slot = (username: string): Entry => {
    const key = username.toLowerCase();
    const existing = byKey.get(key);
    if (existing) return existing;
    const created: Entry = { username, online: false };
    byKey.set(key, created);
    return created;
  };

  for (const entry of online) {
    slot(entry.name).online = true;
  }

  for (const row of players) {
    const target = slot(row.username);
    target.row = row;
    if (row.status === "online") target.online = true;
  }

  for (const account of members) {
    const target = slot(account.username);
    target.member = account;
    target.username = account.username;
  }

  // Include registered site accounts in the directory
  for (const account of accounts) {
    const name = account.minecraftUsername || account.username;
    if (name) {
      const target = slot(name);
      target.account = account;
    }
  }

  // Build lookup maps by MC username and site username
  const accountByMc = new Map<string, AccountInfo>();
  const accountBySite = new Map<string, AccountInfo>();
  for (const account of accounts) {
    if (account.minecraftUsername) {
      accountByMc.set(account.minecraftUsername.toLowerCase(), account);
    }
    if (account.username) {
      accountBySite.set(account.username.toLowerCase(), account);
    }
  }

  const list = [...byKey.values()].map<DirectoryPlayer>((entry) => {
    const account =
      accountByMc.get(entry.username.toLowerCase()) ??
      accountBySite.get(entry.username.toLowerCase()) ??
      entry.account;

    const isMember = Boolean(entry.member || account);
    const skinUrl =
      entry.member?.headUrl ||
      account?.minecraftSkinUrl ||
      (isMinecraftAvatarUrl(account?.avatarUrl) ? account?.avatarUrl : null);

    return {
      username: entry.username,
      online: entry.online,
      membership: isMember ? "member" : "server",
      skin: resolvePlayerSkin({
        username: entry.username,
        uploadedHeadUrl: skinUrl,
        // A skin kept only as a profile picture still has its raw file beside the head.
        uploadedRawSkinUrl: entry.member?.rawSkinUrl ?? rawSkinUrlForHead(skinUrl),
      }),
      // Role from auth's app_metadata (authoritative), falling back to "member" for linked accounts.
      role: account?.role ?? (isMember ? "member" : undefined),
      siteAvatarUrl: account?.avatarUrl ?? null,
      firstJoined: entry.row?.firstJoined,
      lastSeen: entry.row?.lastSeen,
      stats: entry.row
        ? {
            playtimeSeconds: entry.row.playtimeTracked ? entry.row.playtimeSeconds : null,
            balance: entry.row.balanceTracked ? entry.row.balance : null,
          }
        : undefined,
    };
  });

  const rank = (player: DirectoryPlayer) => (player.online ? 0 : player.membership === "member" ? 1 : 2);
  return list.sort(
    (a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
  );
}
