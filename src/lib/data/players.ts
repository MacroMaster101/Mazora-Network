import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Player } from "@/lib/types";

export async function getPlayers(): Promise<Player[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  try {
    const { data: accounts } = await admin
      .from("minecraft_accounts")
      .select("id, minecraft_uuid, minecraft_username, linked_at");

    if (!accounts || accounts.length === 0) return [];

    const accountIds = accounts.map((a) => String(a.id));
    const { data: statsList } = await admin
      .from("player_statistics")
      .select("*")
      .in("minecraft_account_id", accountIds);

    const statsMap = new Map();
    (statsList ?? []).forEach((s) => statsMap.set(String(s.minecraft_account_id), s));

    return accounts.map((acc) => {
      const stats = statsMap.get(String(acc.id));
      const playtimeHours = Math.round(Number(stats?.playtime_seconds ?? 0) / 3600);

      return {
        username: String(acc.minecraft_username),
        uuid: String(acc.minecraft_uuid),
        rank: "Member",
        accent: "violet",
        level: Number(stats?.level ?? 1),
        playtimeHours,
        kills: Number(stats?.kills ?? 0),
        deaths: Number(stats?.deaths ?? 0),
        wins: Number(stats?.wins ?? 0),
        losses: Number(stats?.losses ?? 0),
        balance: Number(stats?.balance ?? 0),
        blocksMined: Number(stats?.blocks_mined ?? 0),
        blocksPlaced: Number(stats?.blocks_placed ?? 0),
        killStreak: Number(stats?.kill_streak ?? 0),
        status: stats?.is_online ? "online" : "offline",
        firstJoined: String(acc.linked_at ?? new Date().toISOString()),
        lastSeen: stats?.last_seen ? String(stats.last_seen) : String(acc.linked_at),
        currentMode: String(stats?.current_game_mode ?? "survival-smp"),
        badges: ["Community Member"],
        achievements: [],
      };
    });
  } catch (error) {
    console.error("Failed to fetch players:", error);
    return [];
  }
}

export async function getPlayer(username: string): Promise<Player | null> {
  const players = await getPlayers();
  return players.find((p) => p.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export type LeaderboardKey =
  | "overall"
  | "playtime"
  | "kills"
  | "kd"
  | "balance"
  | "level"
  | "wins"
  | "blocksMined"
  | "blocksPlaced"
  | "killStreak";

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  value: number;
  display: string;
}

const LABELS: Record<LeaderboardKey, string> = {
  overall: "Overall",
  playtime: "Playtime",
  kills: "Kills",
  kd: "K/D ratio",
  balance: "Balance",
  level: "Level",
  wins: "Wins",
  blocksMined: "Blocks mined",
  blocksPlaced: "Blocks placed",
  killStreak: "Kill streak",
};

export const leaderboardTabs: { key: LeaderboardKey; label: string }[] = (
  Object.keys(LABELS) as LeaderboardKey[]
).map((key) => ({ key, label: LABELS[key] }));

export async function getLeaderboard(key: LeaderboardKey): Promise<LeaderboardEntry[]> {
  const players = await getPlayers();
  if (!players.length) return [];

  const getValue = (p: Player): number => {
    switch (key) {
      case "level":
        return p.level;
      case "playtime":
        return p.playtimeHours;
      case "kills":
        return p.kills;
      case "kd":
        return p.deaths > 0 ? Number((p.kills / p.deaths).toFixed(2)) : p.kills;
      case "balance":
        return p.balance;
      case "wins":
        return p.wins;
      case "blocksMined":
        return p.blocksMined;
      case "blocksPlaced":
        return p.blocksPlaced;
      case "killStreak":
        return p.killStreak;
      case "overall":
      default:
        return p.level * 100 + p.kills * 10 + p.playtimeHours;
    }
  };

  const formatDisplay = (val: number): string => {
    if (key === "balance") return `$${val.toLocaleString()}`;
    if (key === "playtime") return `${val} hrs`;
    if (key === "kd") return `${val} K/D`;
    return val.toLocaleString();
  };

  const sorted = [...players].sort((a, b) => getValue(b) - getValue(a));

  return sorted.slice(0, 50).map((player, idx) => {
    const val = getValue(player);
    return {
      rank: idx + 1,
      player,
      value: val,
      display: formatDisplay(val),
    };
  });
}
