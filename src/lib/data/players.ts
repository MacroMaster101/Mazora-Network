/**
 * Player repositories. Public data only — no emails or private account fields.
 */
import { demoPlayers } from "@/lib/db/demo";
import type { Player } from "@/lib/types";
import { kd } from "@/lib/utils";

export async function getPlayers(): Promise<Player[]> {
  return demoPlayers;
}

export async function getPlayer(username: string): Promise<Player | null> {
  const u = username.toLowerCase();
  return demoPlayers.find((p) => p.username.toLowerCase() === u) ?? null;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  const q = query.trim().toLowerCase();
  if (!q) return demoPlayers;
  return demoPlayers.filter((p) => p.username.toLowerCase().includes(q));
}

export async function getOnlinePlayers(): Promise<Player[]> {
  return demoPlayers.filter((p) => p.status === "online");
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

const metrics: Record<LeaderboardKey, { label: string; get: (p: Player) => number; fmt: (p: Player) => string }> = {
  overall: { label: "Overall", get: (p) => p.level * 1000 + p.kills, fmt: (p) => `Lv ${p.level} · ${p.kills} kills` },
  playtime: { label: "Playtime", get: (p) => p.playtimeHours, fmt: (p) => `${p.playtimeHours.toLocaleString()}h` },
  kills: { label: "Kills", get: (p) => p.kills, fmt: (p) => p.kills.toLocaleString() },
  kd: { label: "K/D ratio", get: (p) => p.kills / Math.max(p.deaths, 1), fmt: (p) => kd(p.kills, p.deaths) },
  balance: { label: "Balance", get: (p) => p.balance, fmt: (p) => `$${p.balance.toLocaleString()}` },
  level: { label: "Level", get: (p) => p.level, fmt: (p) => `Level ${p.level}` },
  wins: { label: "Wins", get: (p) => p.wins, fmt: (p) => `${p.wins} wins` },
  blocksMined: { label: "Blocks mined", get: (p) => p.blocksMined, fmt: (p) => p.blocksMined.toLocaleString() },
  blocksPlaced: { label: "Blocks placed", get: (p) => p.blocksPlaced, fmt: (p) => p.blocksPlaced.toLocaleString() },
  killStreak: { label: "Kill streak", get: (p) => p.killStreak, fmt: (p) => `${p.killStreak} streak` },
};

export const leaderboardTabs: { key: LeaderboardKey; label: string }[] = (
  Object.keys(metrics) as LeaderboardKey[]
).map((key) => ({ key, label: metrics[key].label }));

export async function getLeaderboard(key: LeaderboardKey): Promise<LeaderboardEntry[]> {
  const m = metrics[key];
  return [...demoPlayers]
    .sort((a, b) => m.get(b) - m.get(a))
    .map((player, i) => ({ rank: i + 1, player, value: m.get(player), display: m.fmt(player) }));
}
