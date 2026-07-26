/**
 * Seed / re-seed the storefront catalogue into the database.
 *
 * The store is the one area that keeps a real catalogue while the rest of the
 * site waits for live content, so this file is the canonical source for
 * provisioning it. Product artwork is resolved through storeArtFor() and
 * written into products.image_url, which makes the database — not the code —
 * the source of truth for what the storefront shows.
 *
 * Safe to re-run: rows are upserted by slug.
 *
 * Usage: npm run db:seed:store
 */
import postgres from "postgres";
import type { Product } from "../src/lib/types";
import { storeArtFor } from "../src/lib/store-art";

type SeedProduct = Omit<Product, "imageUrl">;

const CATALOGUE: SeedProduct[] = [
  { slug: "rank-hero-monthly", name: "Hero (Monthly)", family: "Hero", billing: "Monthly", category: "Ranks", description: "The first step into Mazora's Survival supporter ranks.", price: 2, features: ["Hero rank benefits", "Monthly access", "Survival SMP"], accent: "green", badge: "Monthly" },
  { slug: "rank-hero-permanent", name: "Hero (Permanent)", family: "Hero", billing: "Permanent", category: "Ranks", description: "Keep the Hero rank and its Survival perks permanently.", price: 6, features: ["Hero rank benefits", "Permanent access", "Survival SMP"], accent: "green", badge: "Permanent" },
  { slug: "rank-veteran-monthly", name: "Veteran (Monthly)", family: "Veteran", billing: "Monthly", category: "Ranks", description: "A stronger monthly Survival rank for regular players.", price: 4, features: ["Veteran rank benefits", "Monthly access", "Survival SMP"], accent: "cyan", badge: "Monthly" },
  { slug: "rank-veteran-permanent", name: "Veteran (Permanent)", family: "Veteran", billing: "Permanent", category: "Ranks", description: "Unlock the Veteran rank permanently on Survival.", price: 8, features: ["Veteran rank benefits", "Permanent access", "Survival SMP"], accent: "cyan", badge: "Permanent" },
  { slug: "rank-vip-monthly", name: "VIP (Monthly)", family: "VIP", billing: "Monthly", category: "Ranks", description: "Premium monthly recognition and perks on Survival.", price: 6, features: ["VIP rank benefits", "Monthly access", "Survival SMP"], accent: "violet", badge: "Monthly" },
  { slug: "rank-vip-permanent", name: "VIP (Permanent)", family: "VIP", billing: "Permanent", category: "Ranks", description: "Permanent VIP status across the Survival experience.", price: 10, features: ["VIP rank benefits", "Permanent access", "Survival SMP"], accent: "violet", badge: "Permanent" },
  { slug: "rank-legend-monthly", name: "Legend (Monthly)", family: "Legend", billing: "Monthly", category: "Ranks", description: "A high-tier monthly rank for dedicated Survival players.", price: 10, features: ["Legend rank benefits", "Monthly access", "Survival SMP"], accent: "orange", badge: "Monthly" },
  { slug: "rank-legend-permanent", name: "Legend (Permanent)", family: "Legend", billing: "Permanent", category: "Ranks", description: "Keep the Legend rank and its perks forever.", price: 25, features: ["Legend rank benefits", "Permanent access", "Survival SMP"], accent: "orange", badge: "Permanent" },
  { slug: "rank-immortal-monthly", name: "Immortal (Monthly)", family: "Immortal", billing: "Monthly", category: "Ranks", description: "Elite monthly status for the Survival community.", price: 12, features: ["Immortal rank benefits", "Monthly access", "Survival SMP"], accent: "rose", badge: "Monthly" },
  { slug: "rank-immortal-permanent", name: "Immortal (Permanent)", family: "Immortal", billing: "Permanent", category: "Ranks", description: "Permanent Immortal status and Survival perks.", price: 29.99, features: ["Immortal rank benefits", "Permanent access", "Survival SMP"], accent: "rose", badge: "Permanent" },
  { slug: "rank-conqueror-monthly", name: "Conqueror (Monthly)", family: "Conqueror", billing: "Monthly", category: "Ranks", description: "Mazora's flagship monthly Survival rank.", price: 14.99, features: ["Conqueror rank benefits", "Monthly access", "Survival SMP"], accent: "gold", badge: "Monthly" },
  { slug: "rank-conqueror-permanent", name: "Conqueror (Permanent)", family: "Conqueror", billing: "Permanent", category: "Ranks", description: "The complete permanent Survival supporter rank.", price: 54.99, features: ["Conqueror rank benefits", "Permanent access", "Survival SMP"], accent: "gold", badge: "Top rank" },

  { slug: "key-vote-5", name: "Vote Keys x5", category: "Crate Keys", description: "Five Vote crate keys for Survival rewards.", price: 0.99, features: ["5 Vote keys", "Survival crate access", "Staff delivery"], accent: "green" },
  { slug: "key-epic-3", name: "Epic Keys x3", category: "Crate Keys", description: "Three Epic crate keys with upgraded rewards.", price: 1.5, features: ["3 Epic keys", "Upgraded loot pool", "Staff delivery"], accent: "cyan" },
  { slug: "key-mystery-3", name: "Mystery Keys x3", category: "Crate Keys", description: "Three Mystery crate keys for surprise rewards.", price: 2.5, features: ["3 Mystery keys", "Mystery reward pool", "Staff delivery"], accent: "violet" },
  { slug: "key-seasonal-2", name: "Seasonal Keys x2", category: "Crate Keys", description: "Two limited Seasonal crate keys.", price: 5, features: ["2 Seasonal keys", "Limited reward pool", "Staff delivery"], accent: "rose", badge: "Seasonal" },
  { slug: "key-spawner-2", name: "Spawner Keys x2", category: "Crate Keys", description: "Two keys for the Survival spawner crate.", price: 7, features: ["2 Spawner keys", "Spawner reward pool", "Staff delivery"], accent: "orange" },
  { slug: "key-legendary-1", name: "Legendary Key x1", category: "Crate Keys", description: "One Legendary key for the premium crate.", price: 7.99, features: ["1 Legendary key", "Premium reward pool", "Staff delivery"], accent: "gold", badge: "Legendary" },

  { slug: "battlepass-premium", name: "Premium Battlepass", category: "Battlepass", description: "Unlock the premium Survival battlepass reward track.", price: 4.5, features: ["Premium reward track", "Survival season access", "Staff activation"], accent: "violet", badge: "Premium" },
  { slug: "battlepass-free-reset", name: "Free Battlepass Reset", category: "Battlepass", description: "Reset your free battlepass progress and start the track again.", price: 3.99, features: ["Free track reset", "Survival battlepass", "Staff activation"], accent: "cyan" },

  { slug: "addon-xp-50", name: "50 XP", category: "Add-ons", subcategory: "XP Boosts", description: "Add 50 XP to your Survival progression.", price: 2.99, features: ["50 Survival XP", "Applied by staff", "Manual delivery"], accent: "green" },
  { slug: "addon-xp-200", name: "200 XP", category: "Add-ons", subcategory: "XP Boosts", description: "Add 200 XP to your Survival progression.", price: 11.5, features: ["200 Survival XP", "Applied by staff", "Manual delivery"], accent: "cyan" },
  { slug: "addon-xp-500", name: "500 XP", category: "Add-ons", subcategory: "XP Boosts", description: "Add 500 XP to your Survival progression.", price: 25.99, features: ["500 Survival XP", "Applied by staff", "Manual delivery"], accent: "gold", badge: "Largest boost" },
  { slug: "addon-claim-1000", name: "1,000 Claim Blocks", category: "Add-ons", subcategory: "Claim Blocks", description: "Expand your protected Survival land by 1,000 blocks.", price: 3, features: ["1,000 claim blocks", "Survival SMP", "Staff delivery"], accent: "green" },
  { slug: "addon-claim-4000", name: "4,000 Claim Blocks", category: "Add-ons", subcategory: "Claim Blocks", description: "Expand your protected Survival land by 4,000 blocks.", price: 11.5, features: ["4,000 claim blocks", "Survival SMP", "Staff delivery"], accent: "cyan" },
  { slug: "addon-claim-8000", name: "8,000 Claim Blocks", category: "Add-ons", subcategory: "Claim Blocks", description: "Expand your protected Survival land by 8,000 blocks.", price: 20.99, features: ["8,000 claim blocks", "Survival SMP", "Staff delivery"], accent: "violet" },
  { slug: "addon-claim-10000", name: "10,000 Claim Blocks", category: "Add-ons", subcategory: "Claim Blocks", description: "Expand your protected Survival land by 10,000 blocks.", price: 28.99, features: ["10,000 claim blocks", "Survival SMP", "Staff delivery"], accent: "orange" },
  { slug: "addon-claim-12000", name: "12,000 Claim Blocks", category: "Add-ons", subcategory: "Claim Blocks", description: "The largest Claim Block package in the Survival store.", price: 34.99, features: ["12,000 claim blocks", "Survival SMP", "Staff delivery"], accent: "gold", badge: "Largest pack" },
  { slug: "addon-pp-50", name: "50 Player Points", category: "Add-ons", subcategory: "Player Points", description: "Add 50 Player Points to your Survival account.", price: 3.25, features: ["50 Player Points", "Survival account", "Staff delivery"], accent: "violet" },
  { slug: "addon-pp-100", name: "100 Player Points", category: "Add-ons", subcategory: "Player Points", description: "Add 100 Player Points to your Survival account.", price: 6.5, features: ["100 Player Points", "Survival account", "Staff delivery"], accent: "gold", badge: "Best value" },
];

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set — cannot seed the store.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false });
  let written = 0;
  try {
    for (const [index, p] of CATALOGUE.entries()) {
      const image = storeArtFor({ slug: p.slug, category: p.category });
      await sql`
        insert into public.products
          (name, slug, description, category, price, sale_price, image_url,
           features, accent, badge, family, billing, subcategory, sort_order, enabled)
        values (
          ${p.name}, ${p.slug}, ${p.description}, ${p.category}, ${String(p.price)},
          ${p.salePrice != null ? String(p.salePrice) : null}, ${image},
          ${JSON.stringify(p.features)}::jsonb, ${p.accent ?? null}, ${p.badge ?? null},
          ${p.family ?? null}, ${p.billing ?? null}, ${p.subcategory ?? null}, ${index}, true
        )
        on conflict (slug) do update set
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          price = excluded.price,
          sale_price = excluded.sale_price,
          image_url = excluded.image_url,
          features = excluded.features,
          accent = excluded.accent,
          badge = excluded.badge,
          family = excluded.family,
          billing = excluded.billing,
          subcategory = excluded.subcategory,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
      written += 1;
    }
    console.log(`✓ Seeded ${written} store products (artwork written to image_url).`);
  } catch (err) {
    console.error("✗ Store seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
