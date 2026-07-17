/**
 * Content repositories. Pages import ONLY from here (and players/status), never
 * the database driver or demo module directly. That keeps the data source a
 * single swappable seam: today these return demo fixtures; wiring them to the
 * Supabase database later changes only this file — no page changes.
 *
 * Functions are async so the swap to real DB reads is a drop-in.
 */
import {
  demoEvents,
  demoGallery,
  demoGameModes,
  demoNews,
  demoProducts,
  demoRules,
  demoStaff,
  demoVoteSites,
} from "@/lib/db/demo";
import type {
  EventItem,
  GalleryImage,
  GameMode,
  NewsArticle,
  Product,
  RuleCategory,
  StaffMember,
  VoteSite,
  TopVoter,
} from "@/lib/types";
import { getDb, schema } from "@/lib/db/client";
import { eq, sql } from "drizzle-orm";

export async function getGameModes(): Promise<GameMode[]> {
  return demoGameModes;
}
export async function getGameMode(slug: string): Promise<GameMode | null> {
  return demoGameModes.find((m) => m.slug === slug) ?? null;
}

export async function getNews(): Promise<NewsArticle[]> {
  return [...demoNews].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
export async function getArticle(slug: string): Promise<NewsArticle | null> {
  return demoNews.find((n) => n.slug === slug) ?? null;
}
export async function getRelatedArticles(slug: string, category: string): Promise<NewsArticle[]> {
  return demoNews.filter((n) => n.slug !== slug && n.category === category).slice(0, 3);
}

export async function getEvents(): Promise<EventItem[]> {
  const order = { live: 0, upcoming: 1, completed: 2 };
  return [...demoEvents].sort(
    (a, b) => order[a.status] - order[b.status] || +new Date(a.startISO) - +new Date(b.startISO),
  );
}
export async function getEvent(slug: string): Promise<EventItem | null> {
  return demoEvents.find((e) => e.slug === slug) ?? null;
}

export async function getRules(): Promise<RuleCategory[]> {
  return demoRules;
}

export async function getStaff(): Promise<StaffMember[]> {
  return demoStaff;
}

export async function getGallery(): Promise<GalleryImage[]> {
  return demoGallery;
}

export async function getProducts(): Promise<Product[]> {
  return demoProducts;
}
export async function getProduct(slug: string): Promise<Product | null> {
  return demoProducts.find((p) => p.slug === slug) ?? null;
}

export async function getVoteSites(): Promise<VoteSite[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db.select().from(schema.voteSites);
      
      const targetUrls = [
        "https://minecraftservers.org/server/688211",
        "https://minecraft-mp.com/server-s358100"
      ];

      const needsSync = rows.length !== 2 || !rows.every((r) => targetUrls.includes(r.url));
      
      if (needsSync) {
        // Clear all and re-insert the two correct ones
        await db.delete(schema.voteSites);
        
        for (const v of demoVoteSites) {
          await db.insert(schema.voteSites).values({
            name: v.name,
            url: v.url,
            rewardDescription: v.reward,
            cooldownHours: v.cooldownHours,
            enabled: true
          });
        }
        
        const freshRows = await db
          .select()
          .from(schema.voteSites)
          .where(eq(schema.voteSites.enabled, true));
          
        return freshRows.map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          reward: r.rewardDescription || "",
          cooldownHours: r.cooldownHours,
        }));
      }

      return rows
        .filter((r) => r.enabled)
        .map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          reward: r.rewardDescription || "",
          cooldownHours: r.cooldownHours,
        }));
    } catch (err) {
      console.error("Failed to fetch vote sites from DB:", err);
    }
  }
  return demoVoteSites;
}

export async function getTopVoters(): Promise<TopVoter[]> {
  const db = getDb();
  if (!db) {
    return [];
  }

  try {
    const rows = await db
      .select({
        username: sql<string>`coalesce(${schema.minecraftAccounts.minecraftUsername}, ${schema.profiles.username}, 'Unknown')`,
        dailyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= now() - interval '24 hours' then 1 end) as integer)`,
        weeklyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= now() - interval '7 days' then 1 end) as integer)`,
        monthlyVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= date_trunc('month', now()) then 1 end) as integer)`,
        lastMonthVotes: sql<number>`cast(count(case when ${schema.voteHistory.votedAt} >= date_trunc('month', now() - interval '1 month') and ${schema.voteHistory.votedAt} < date_trunc('month', now()) then 1 end) as integer)`,
        allTimeVotes: sql<number>`cast(count(*) as integer)`,
      })
      .from(schema.voteHistory)
      .leftJoin(schema.profiles, eq(schema.voteHistory.userId, schema.profiles.userId))
      .leftJoin(schema.minecraftAccounts, eq(schema.voteHistory.userId, schema.minecraftAccounts.userId))
      .groupBy(
        schema.voteHistory.userId,
        schema.profiles.username,
        schema.minecraftAccounts.minecraftUsername
      );

    return rows;
  } catch (error) {
    console.error("Failed to query top voters from database:", error);
    return [];
  }
}

