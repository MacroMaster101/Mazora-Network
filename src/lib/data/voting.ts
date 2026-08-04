import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
        return seeded.map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          reward: r.rewardDescription || "",
          rewardDescription: r.rewardDescription || "",
          cooldownHours: r.cooldownHours,
          enabled: r.enabled,
        }));
      } catch (seedErr) {
        console.error("Failed to seed default vote sites", seedErr);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      reward: r.rewardDescription || "",
      rewardDescription: r.rewardDescription || "",
      cooldownHours: r.cooldownHours,
      enabled: r.enabled,
    }));
  } catch (error) {
    console.error("Failed to load admin vote sites:", error);
    return defaultVoteSites;
  }
}
