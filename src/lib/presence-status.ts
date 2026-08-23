export interface PresenceSnapshot {
  websiteOnline: boolean;
  minecraftOnline: boolean;
  minecraftPlayers: number | null;
  minecraftMax: number | null;
  discordOnline: number | null;
  discordMembers: number | null;
}

export interface PresenceLabels {
  website: string;
  minecraft: string;
  discord: string;
}

/**
 * Produce the exact text sent to Discord. Offline services intentionally omit
 * their capacity so an old `0/500` value can never look like a live reading.
 */
export function presenceLabels(snapshot: PresenceSnapshot): PresenceLabels {
  return {
    website: `🌐 mazora.us • ${snapshot.websiteOnline ? "Live" : "Offline"}`,
    minecraft:
      snapshot.minecraftOnline && snapshot.minecraftPlayers !== null
        ? snapshot.minecraftMax !== null
          ? `⛏️ mc.mazora.us • ${snapshot.minecraftPlayers}/${snapshot.minecraftMax}`
          : `⛏️ mc.mazora.us • ${snapshot.minecraftPlayers} online`
        : "⛏️ mc.mazora.us • Offline",
    discord:
      snapshot.discordOnline === null
        ? "🟣 Discord • Count unavailable"
        : `🟣 Discord • ${snapshot.discordOnline} online`,
  };
}
