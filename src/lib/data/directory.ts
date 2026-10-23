import "server-only";
import { getServerStatus } from "@/lib/data/status";
import { getPlayers } from "@/lib/data/players";
import { listLinkedAccounts } from "@/lib/data/minecraft-accounts";
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

async function publicAccounts(): Promise<AccountInfo[]> {
  const roster = await listPublicRoster();
  return roster ? rosterDirectoryAccounts(roster) : [];
}
