/**
 * Seed the connected database with the Phase-1 demo content, so you can verify
 * the Supabase connection end-to-end.
 *
 * Usage:
 *   1. Set DATABASE_URL to your Supabase Postgres connection string.
 *   2. Run `npm run db:push` to create the tables from the Drizzle schema.
 *   3. Run `npm run db:seed`.
 *
 * Phase 1 pages still render the in-memory demo data; wiring page reads to these
 * rows happens per-repository in src/lib/data in a later phase.
 */
import { getDb } from "./client";
import * as s from "./schema";
import {
  demoEvents,
  demoGallery,
  demoGameModes,
  demoNews,
  demoProducts,
  demoRules,
  demoStaff,
  demoVoteSites,
} from "./demo";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("DATABASE_URL is not set — nothing to seed. Set it and try again.");
    process.exit(1);
  }

  console.log("Seeding game modes…");
  for (const m of demoGameModes) {
    await db
      .insert(s.gameModes)
      .values({ name: m.name, slug: m.slug, description: m.description, playerCount: m.players })
      .onConflictDoNothing();
  }

  console.log("Seeding news…");
  for (const n of demoNews) {
    await db
      .insert(s.newsArticles)
      .values({
        title: n.title,
        slug: n.slug,
        excerpt: n.excerpt,
        content: n.body.join("\n\n"),
        category: n.category,
        authorName: n.author,
        status: "published",
        publishedAt: new Date(n.date),
      })
      .onConflictDoNothing();
  }

  console.log("Seeding events…");
  for (const e of demoEvents) {
    await db
      .insert(s.events)
      .values({
        title: e.title,
        slug: e.slug,
        description: e.description,
        startAt: new Date(e.startISO),
        endAt: new Date(e.endISO),
        status: e.status,
        gameMode: e.mode,
        rewards: e.rewards,
        maxParticipants: e.maxParticipants,
      })
      .onConflictDoNothing();
  }

  console.log("Seeding products…");
  for (const p of demoProducts) {
    await db
      .insert(s.products)
      .values({
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        price: String(p.price),
        salePrice: p.salePrice ? String(p.salePrice) : null,
      })
      .onConflictDoNothing();
  }

  console.log("Seeding vote sites…");
  for (const v of demoVoteSites) {
    await db
      .insert(s.voteSites)
      .values({ name: v.name, url: v.url, rewardDescription: v.reward, cooldownHours: v.cooldownHours })
      .onConflictDoNothing();
  }

  console.log("Seeding rules…");
  for (let i = 0; i < demoRules.length; i++) {
    const cat = demoRules[i];
    const [row] = await db
      .insert(s.ruleCategories)
      .values({ name: cat.name, slug: cat.slug, sortOrder: i })
      .onConflictDoNothing()
      .returning();
    if (row) {
      for (let j = 0; j < cat.items.length; j++) {
        await db.insert(s.rules).values({
          categoryId: row.id,
          title: cat.items[j].title,
          description: cat.items[j].body,
          sortOrder: j,
        });
      }
    }
  }

  console.log("Seeding staff…");
  for (let i = 0; i < demoStaff.length; i++) {
    const st = demoStaff[i];
    await db
      .insert(s.staffMembers)
      .values({ username: st.username, staffRole: st.group, bio: st.bio, sortOrder: i })
      .onConflictDoNothing();
  }

  console.log("Seeding gallery…");
  for (const g of demoGallery) {
    await db.insert(s.galleryImages).values({ title: g.title, category: g.category }).onConflictDoNothing();
  }

  console.log("Done. Database seeded with Phase-1 demo content.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
