import "server-only";
import { getDirectory } from "@/lib/data/directory";
import { lookupMojangName } from "@/lib/minecraft/mojang";
import { resolvePlayerSkin, type MojangResult } from "@/lib/minecraft/skin";
import type { DirectoryPlayer } from "@/lib/types";

export interface PlayerDetail {
  player: DirectoryPlayer;
  mojang: MojangResult;
}

/**
 * Detail for one player, including the Mojang label the grid deliberately does
 * not carry. Looking the name up here — once, when a panel opens — is what
 * keeps the page inside Mojang's rate limit; doing it per grid card would mean
 * a dozen lookups on every page load for a label most visitors never read.
 *
 * A player whose skin is already uploaded is not looked up at all: we hold
 * their pixels, so what Mojang thinks of the name changes nothing.
 */
export async function getPlayerDetail(username: string): Promise<PlayerDetail | null> {
  const directory = await getDirectory();
  const player = directory.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (!player) return null;

  if (player.skin.source === "uploaded") {
    return { player, mojang: "unknown" };
  }

  const mojang = await lookupMojangName(player.username);
  return {
    player: { ...player, skin: resolvePlayerSkin({ username: player.username, mojang }) },
    mojang,
  };
}
