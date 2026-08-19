import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Player } from "@/lib/types";
import { formatPlaytime } from "@/lib/utils";

/**
 * A player is considered live only while the Minecraft plugin continues to
 * refresh their row. This turns a server crash or lost quit event into an
 * automatic offline state instead of leaving a green badge stuck forever.
 */
const ONLINE_FRESHNESS_MS = 2 * 60_000;

export const getPlayers = cache(async (): Promise<Player[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        uuid: schema.minecraftPlayers.minecraftUuid,
        username: schema.minecraftPlayers.username,
        playtimeSeconds: schema.minecraftPlayers.playtimeSeconds,
        balance: schema.minecraftPlayers.balance,
        isOnline: schema.minecraftPlayers.isOnline,
        firstJoined: schema.minecraftPlayers.firstJoined,
        lastSeen: schema.minecraftPlayers.lastSeen,
        syncedAt: schema.minecraftPlayers.syncedAt,
        serverName: schema.minecraftPlayers.serverName,
        customSkinUrl: schema.minecraftAccounts.skinHeadUrl,
      })
      .from(schema.minecraftPlayers)
      .leftJoin(
        schema.minecraftAccounts,
        // Website linking currently stores an `offline:<name>` identity because
        // it happens before server verification. Match the latest IGN here so
        // linked custom heads still appear; the sync registry itself remains
        // correctly keyed by the real UUID supplied by Paper.
        sql`lower(${schema.minecraftPlayers.username}) = lower(${schema.minecraftAccounts.minecraftUsername})`,
      );

    const freshAfter = Date.now() - ONLINE_FRESHNESS_MS;
    return rows.map((row) => {
      const playtimeSeconds = Math.max(0, Number(row.playtimeSeconds ?? 0));
      const parseSafeDate = (val: unknown): Date => {
        if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
        if (typeof val === "string" || typeof val === "number") {
          const parsed = new Date(val);
          if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
      };

      const syncedAt = parseSafeDate(row.syncedAt);
      const firstJoinedDate = row.firstJoined ? parseSafeDate(row.firstJoined) : syncedAt;
      const lastSeenDate = row.lastSeen ? parseSafeDate(row.lastSeen) : syncedAt;
      const online = Boolean(row.isOnline) && syncedAt.getTime() >= freshAfter;

      return {
        username: row.username,
        uuid: row.uuid,
        customSkinUrl: row.customSkinUrl,
        rank: "Member",
        accent: "violet",
        level: 0,
        playtimeSeconds,
        playtimeTracked: row.playtimeSeconds !== null,
        playtimeHours: playtimeSeconds / 3600,
        kills: 0,
        deaths: 0,
        wins: 0,
        losses: 0,
        balance: Number(row.balance ?? 0),
        balanceTracked: row.balance !== null,
        blocksMined: 0,
        blocksPlaced: 0,
        killStreak: 0,
        status: online ? "online" : "offline",
        firstJoined: firstJoinedDate.toISOString(),
        lastSeen: online ? "now" : lastSeenDate.toISOString(),
        currentMode: row.serverName ?? "survival-smp",
        badges: [],
        achievements: [],
      } satisfies Player;
    });
  } catch (error) {
    console.error("Failed to fetch synced Minecraft players:", error);
    return [];
  }
});

export async function getPlayer(username: string): Promise<Player | null> {
  const players = await getPlayers();
  return players.find((player) => player.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export type LeaderboardKey = "playtime" | "balance";

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  value: number;
  display: string;
}

export const leaderboardTabs: { key: LeaderboardKey; label: string }[] = [
  { key: "playtime", label: "Playtime" },
  { key: "balance", label: "Balance" },
];

export function buildLeaderboard(players: Player[], key: LeaderboardKey): LeaderboardEntry[] {
  const value = (player: Player) => key === "playtime" ? player.playtimeSeconds : player.balance;
  const tracked = players.filter((player) => key === "playtime" ? player.playtimeTracked : player.balanceTracked);
  return tracked
    .sort((a, b) => value(b) - value(a) || a.username.localeCompare(b.username))
    .slice(0, 100)
    .map((player, index) => {
      const metric = value(player);
      return {
        rank: index + 1,
        player,
        value: metric,
        display: key === "balance"
          ? `$${metric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : formatPlaytime(metric),
      };
    });
}
