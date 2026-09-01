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
 * Did Discord refuse a privileged intent we asked for?
 *
 * Close code 4014. It means the intent is requested in code but not enabled
 * under Developer Portal -> Bot -> Privileged Gateway Intents. Worth telling
 * apart from other login failures, because it is recoverable without anyone
 * touching the portal: drop the intent and connect with less.
 */
export function isMissingPrivilegedIntent(message: string): boolean {
  return /disallowed intents/i.test(message);
}

/**
 * Which login failures are worth retrying.
 *
 * A wrong token or a privileged intent that is not enabled in the Developer
 * Portal will never fix itself, so the worker exits and lets someone correct
 * the configuration. Everything else — most importantly a 429 Cloudflare ban
 * on a shared outbound IP, but equally a DNS blip or a refused socket — clears
 * on its own, so the worker must stay alive and keep trying.
 *
 * Getting this backwards is the difference between a service that heals itself
 * and one that crash-loops, which is why it is tested rather than inlined.
 */
export function isFatalLoginError(message: string): boolean {
  return /invalid token|disallowed intents|invalid intents/i.test(message);
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
    // The member count is a bonus, not a requirement: when it is missing we
    // still show the online count rather than inventing a total or hiding a
    // number we actually have.
    discord:
      snapshot.discordOnline === null
        ? snapshot.discordMembers === null
          ? "🟣 Discord • Count unavailable"
          : `🟣 Discord • ${snapshot.discordMembers} members`
        : snapshot.discordMembers === null
          ? `🟣 Discord • ${snapshot.discordOnline} online`
          : `🟣 Discord • ${snapshot.discordOnline} online (${snapshot.discordMembers} members)`,
  };
}
