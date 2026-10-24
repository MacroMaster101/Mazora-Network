import "server-only";
import { getServerStatus } from "@/lib/data/status";
import { getPlayerRows, getPlayers } from "@/lib/data/players";
import { getLinkedAccount, listLinkedAccounts } from "@/lib/data/minecraft-accounts";
import { listAccounts, listPublicRoster } from "@/lib/data/accounts";
import { buildDirectory, rosterDirectoryAccounts, type AccountInfo } from "@/lib/data/directory-merge";
import type { DirectoryPlayer } from "@/lib/types";

export type { DirectoryPlayer } from "@/lib/types";
export type { BuildDirectoryInput } from "@/lib/data/directory-merge";

/**
 * The player directory. Public by default: the cached public roster (only
 * active accounts, no internal ranks, no email handles), the same for every
 * visitor. Staff boards pass `{ staffView: true }` to read every account as it
 * is, suspended ones included, uncached.
 */
export async function getDirectory({ staffView = false }: { staffView?: boolean } = {}): Promise<DirectoryPlayer[]> {
  const [status, players, members, accounts] = await Promise.all([
    getServerStatus(),
    getPlayers(),
    listLinkedAccounts(),
    staffView ? listAccounts() : publicAccounts(),
  ]);

  return buildDirectory({
    online: status.playerList,
    players,
    members,
    accounts: accounts ?? [],
  });
}

/**
 * One public directory entry by name, exactly as getDirectory() lists it, for
 * the player-detail API. Only that name's synced rows and Minecraft link are
 * read (the roster and server status are cached anyway), instead of rebuilding
 * the whole directory each time a panel opens. buildDirectory merges on the
 * lowercased name, so feeding it every source row that carries this name gives
 * the same entry the full build would.
 */
export async function getDirectoryPlayer(username: string): Promise<DirectoryPlayer | null> {
  const key = username.toLowerCase();
  const same = (name: string | null | undefined) => typeof name === "string" && name.toLowerCase() === key;
  const [status, players, member, accounts] = await Promise.all([
    getServerStatus(),
    getPlayerRows(username),
    getLinkedAccount(username),
    publicAccounts(),
  ]);

  const entries = buildDirectory({
    online: status.playerList.filter((entry) => same(entry.name)),
    players: players.filter((row) => same(row.username)),
    members: member ? [member] : [],
    accounts: accounts.filter((account) => same(account.minecraftUsername) || same(account.username)),
  });
  return entries.find((entry) => same(entry.username)) ?? null;
}

async function publicAccounts(): Promise<AccountInfo[]> {
  const roster = await listPublicRoster();
  return roster ? rosterDirectoryAccounts(roster) : [];
}
