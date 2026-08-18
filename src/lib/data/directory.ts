import "server-only";
import { getServerStatus } from "@/lib/data/status";
import { getPlayers } from "@/lib/data/players";
import { listLinkedAccounts } from "@/lib/data/minecraft-accounts";
import { listAccounts } from "@/lib/data/accounts";
import { buildDirectory } from "@/lib/data/directory-merge";
import type { DirectoryPlayer } from "@/lib/types";

export type { DirectoryPlayer } from "@/lib/types";
export type { BuildDirectoryInput } from "@/lib/data/directory-merge";

export async function getDirectory(): Promise<DirectoryPlayer[]> {
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
    accounts: accounts ?? [],
  });
}
