import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, desc, isNotNull, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Player } from "@/lib/types";
import { formatPlaytime } from "@/lib/utils";

/**
 * A player is considered live only while the Minecraft plugin continues to
 * refresh their row. This turns a server crash or lost quit event into an
 * automatic offline state instead of leaving a green badge stuck forever.
 */
const ONLINE_FRESHNESS_MS = 2 * 60_000;

/*
  The whole synced table, for the directory, the sitemap and the admin boards.
  Shared across requests for half a minute: the plugin re-syncs about that often
  anyway, and it is the same for every visitor, so each /players view no longer
  reads every player the server has ever seen. Online is judged when the cache
  fills, so it can lag by that half minute. A failure throws inside, so it is
  never cached.
*/
const readCachedPlayers = unstable_cache(() => readPlayers(), ["minecraft-players"], { revalidate: 30 });

export const getPlayers = cache(async (): Promise<Player[]> => {
  try {
    return await readCachedPlayers();
  } catch (error) {
    console.error("Failed to fetch synced Minecraft players:", error);
    return [];
  }
});

/**
 * The synced rows for one IGN (normally one), matched case-insensitively, for
 * the player-detail lookup that previously read the whole table to find it.
 */
export async function getPlayerRows(username: string): Promise<Player[]> {
  try {
    return await readPlayers(sql`lower(${schema.minecraftPlayers.username}) = lower(${username})`);
  } catch (error) {
    console.error("Failed to fetch a synced Minecraft player:", error);
    return [];
  }
}

async function readPlayers(where?: SQL, ranking?: { by: LeaderboardKey; limit: number }): Promise<Player[]> {
  const db = getDb();
  if (!db) return [];

  const rankColumn = ranking?.by === "balance" ? schema.minecraftPlayers.balance : schema.minecraftPlayers.playtimeSeconds;
  const query = db
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
      //
      // Only links of active accounts: a suspended or deleted member's
      // uploaded head is not shown for their name (as in listLinkedAccounts).
      // In the join condition, not a WHERE, so the player row itself stays.
      and(
        sql`lower(${schema.minecraftPlayers.username}) = lower(${schema.minecraftAccounts.minecraftUsername})`,
        sql`exists (select 1 from ${schema.profiles} where ${schema.profiles.userId} = ${schema.minecraftAccounts.userId} and ${schema.profiles.accountStatus} = 'active')`,
      ),
    )
    .where(ranking ? and(where, isNotNull(rankColumn)) : where);
  // A leaderboard is sorted and cut in SQL (the playtime and balance indexes
  // serve it), not by reading every player the server has ever seen.
  const rows = ranking
    ? await query.orderBy(desc(rankColumn), asc(schema.minecraftPlayers.username)).limit(ranking.limit)
    : await query;

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
}

/** One player by IGN: only that name's rows, never the whole table. Cached per request (metadata and page share it). */
export const getPlayer = cache(async (username: string): Promise<Player | null> => {
  const rows = await getPlayerRows(username);
  return rows.find((player) => player.username.toLowerCase() === username.toLowerCase()) ?? null;
});

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

const LEADERBOARD_SIZE = 100;

/** One leaderboard, its top LEADERBOARD_SIZE read straight from SQL. */
export async function getLeaderboard(key: LeaderboardKey): Promise<LeaderboardEntry[]> {
  try {
    return buildLeaderboard(await readPlayers(undefined, { by: key, limit: LEADERBOARD_SIZE }), key);
  } catch (error) {
    console.error("Failed to fetch a leaderboard:", error);
    return [];
  }
}

export function buildLeaderboard(players: Player[], key: LeaderboardKey): LeaderboardEntry[] {
  const value = (player: Player) => key === "playtime" ? player.playtimeSeconds : player.balance;
  const tracked = players.filter((player) => key === "playtime" ? player.playtimeTracked : player.balanceTracked);
  return tracked
    .sort((a, b) => value(b) - value(a) || a.username.localeCompare(b.username))
    .slice(0, LEADERBOARD_SIZE)
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
