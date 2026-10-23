import "server-only";
import { getServerStatus } from "@/lib/data/status";
import { getPlayers } from "@/lib/data/players";
import { listLinkedAccounts } from "@/lib/data/minecraft-accounts";
import { listAccounts } from "@/lib/data/accounts";
import { buildDirectory, publicDirectoryAccounts } from "@/lib/data/directory-merge";
import type { DirectoryPlayer } from "@/lib/types";

export type { DirectoryPlayer } from "@/lib/types";
export type { BuildDirectoryInput } from "@/lib/data/directory-merge";

/**
 * The player directory. Public by default: only active accounts, no internal
 * ranks, no email handles (publicDirectoryAccounts). Staff boards pass
 * `{ staffView: true }` to see every account as it is, suspended ones included.
 */
export async function getDirectory({ staffView = false }: { staffView?: boolean } = {}): Promise<DirectoryPlayer[]> {
  const [status, players, members, accounts] = await Promise.all([
    getServerStatus(),
    getPlayers(),
    listLinkedAccounts(),
    listAccounts(),
  ]);

  return buildDirectory({
    online: status.playerList,
    players,
    members,
    accounts: staffView ? (accounts ?? []) : publicDirectoryAccounts(accounts ?? []),
  });
}
