/**
 * Player repositories. Public data only — no emails or private account fields.
 *
 * Player statistics come from the Minecraft server integration, which is not
 * connected yet, so these return nothing rather than sample players. Pages show
 * an explicit empty state; nothing here fabricates a roster or a leaderboard.
 */
import type { Player } from "@/lib/types";

export async function getPlayers(): Promise<Player[]> {
  return [];
}

export async function getPlayer(_username: string): Promise<Player | null> {
  return null;
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

export async function getLeaderboard(_key: LeaderboardKey): Promise<LeaderboardEntry[]> {
  return [];
}
