import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface MinecraftConnection {
  id: string;
  uuid: string;
  username: string;
  linkedAt: string;
}

export interface MinecraftStatistics {
  playtimeSeconds: number;
  kills: number;
  deaths: number;
  balance: number;
  level: number;
  wins: number;
  blocksMined: number;
  blocksPlaced: number;
  lastSeen: string | null;
  isOnline: boolean;
  currentGameMode: string | null;
}

export interface MinecraftAccountSnapshot {
  connection: MinecraftConnection;
  statistics: MinecraftStatistics | null;
}

/** Private Minecraft identity and stats for the currently authenticated user. */
export async function getCurrentMinecraftAccount(): Promise<MinecraftAccountSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const store = getSupabaseAdmin() ?? supabase;
  const { data: account } = await store
    .from("minecraft_accounts")
    .select("id,minecraft_uuid,minecraft_username,linked_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!account) return null;

  const { data: stats } = await store
    .from("player_statistics")
    .select("playtime_seconds,kills,deaths,balance,level,wins,blocks_mined,blocks_placed,last_seen,is_online,current_game_mode")
    .eq("minecraft_account_id", account.id)
    .maybeSingle();

  return {
    connection: {
      id: String(account.id),
      uuid: String(account.minecraft_uuid),
      username: String(account.minecraft_username),
      linkedAt: String(account.linked_at),
    },
    statistics: stats
      ? {
          playtimeSeconds: Number(stats.playtime_seconds ?? 0),
          kills: Number(stats.kills ?? 0),
          deaths: Number(stats.deaths ?? 0),
          balance: Number(stats.balance ?? 0),
          level: Number(stats.level ?? 1),
          wins: Number(stats.wins ?? 0),
          blocksMined: Number(stats.blocks_mined ?? 0),
          blocksPlaced: Number(stats.blocks_placed ?? 0),
          lastSeen: typeof stats.last_seen === "string" ? stats.last_seen : null,
          isOnline: Boolean(stats.is_online),
          currentGameMode: typeof stats.current_game_mode === "string" ? stats.current_game_mode : null,
        }
      : null,
  };
}