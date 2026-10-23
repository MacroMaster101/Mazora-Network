import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { isHttpsUrl } from "@/lib/net/safe-url";
import type { VoteSite } from "@/lib/types";

export interface AdminVoteSite extends VoteSite {
  enabled: boolean;
  rewardDescription?: string;
}

export const defaultVoteSites: AdminVoteSite[] = [
  {
    id: "default-1",
    name: "Minecraft MP",
    url: "https://minecraft-mp.com/",
    reward: "1x Vote Key & $500 Coins",
    rewardDescription: "1x Vote Key & $500 Coins",
    cooldownHours: 24,
    enabled: true,
  },
  {
    id: "default-2",
    name: "Planet Minecraft",
    url: "https://www.planetminecraft.com/",
    reward: "1x Vote Key & 50 XP Levels",
    rewardDescription: "1x Vote Key & 50 XP Levels",
    cooldownHours: 24,
    enabled: true,
  },
  {
    id: "default-3",
    name: "Minecraft Servers",
    url: "https://minecraftservers.org/",
    reward: "1x Vote Key & 2x Claim Blocks",
    rewardDescription: "1x Vote Key & 2x Claim Blocks",
    cooldownHours: 24,
    enabled: true,
  },
  {
    id: "default-4",
    name: "TopG",
    url: "https://topg.org/",
    reward: "1x Vote Key & Rare Shard",
    rewardDescription: "1x Vote Key & Rare Shard",
    cooldownHours: 24,
    enabled: true,
  },
];

type VoteSiteRow = typeof schema.voteSites.$inferSelect;

/** Every stored site, so the editor can still show and fix one with a bad url. */
function toVoteSites(rows: VoteSiteRow[]): AdminVoteSite[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    reward: r.rewardDescription || "",
    rewardDescription: r.rewardDescription || "",
    cooldownHours: r.cooldownHours,
    enabled: r.enabled,
  }));
}

/**
 * The sites /vote may link to. Every url becomes a public href there, so a row
 * that is not a plain https link (saved before the editor checked, or written
 * by hand) is dropped rather than rendered.
 */
export function publicVoteSites<T extends VoteSite & { enabled?: boolean }>(sites: T[]): T[] {
  return sites.filter((s) => s.enabled && isHttpsUrl(s.url));
}

export async function getAdminVoteSites(): Promise<AdminVoteSite[]> {
  const db = getDb();
  if (!db) return defaultVoteSites;

  try {
    const rows = await db.select().from(schema.voteSites);
    if (rows.length === 0) {
      // Seed default vote sites if database table is empty
      try {
        await db.insert(schema.voteSites).values(
          defaultVoteSites.map((site) => ({
            name: site.name,
            url: site.url,
            rewardDescription: site.rewardDescription,
            cooldownHours: site.cooldownHours,
            enabled: site.enabled,
          }))
        );
        const seeded = await db.select().from(schema.voteSites);
        return toVoteSites(seeded);
      } catch (seedErr) {
        console.error("Failed to seed default vote sites", seedErr);
      }
    }

    return toVoteSites(rows);
  } catch (error) {
    console.error("Failed to load admin vote sites:", error);
    return defaultVoteSites;
  }
}
