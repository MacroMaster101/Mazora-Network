/**
 * Seed script to populate 14 high quality demo gallery items using local Mazora artwork assets.
 * Usage: npx tsx --env-file=.env scripts/seed-gallery.ts
 */
import postgres from "postgres";

const DEMO_GALLERY = [
  {
    title: "Dragon's Reach Mountain Citadel",
    description: "Built over 3 months by our senior builders. Features floating crystal towers, automated redstone bridges, and a custom dragon roost.",
    imageUrl: "/images/vote-midnight-citadel-v10.webp",
    category: "builds",
    authorName: "Mazora Network",
    status: "published",
    featured: true,
    likesCount: 142,
  },
  {
    title: "End Dragon Nether-Core Boss Raid",
    description: "Screen capture from last Saturday's community boss event! Over 45 players joined the raid to defeat the Nether-Core Titan.",
    imageUrl: "/images/newsroom-signal-depths-v1.png",
    category: "events",
    authorName: "Vortex_Craft",
    status: "published",
    featured: true,
    likesCount: 98,
  },
  {
    title: "Celestial Nexus Main Lobby",
    description: "Our newly revamped spawn hub featuring interactive NPC portals, leaderboard pedestals, and dynamic seasonal lighting.",
    imageUrl: "/images/vote-rewards-sanctuary-v5.png",
    category: "spawns",
    authorName: "Mazora Network",
    status: "published",
    featured: false,
    likesCount: 76,
  },
  {
    title: "Community Summer Fireworks Festival",
    description: "Captured during our annual summer event in the central town square. Thanks to everyone who brought custom fireworks!",
    imageUrl: "/images/mazora-community-hero.webp",
    category: "community",
    authorName: "StarGazer99",
    status: "published",
    featured: false,
    likesCount: 64,
  },
  {
    title: "Obsidian Fortress & Lava Moat",
    description: "Faction base built on the Survival realm with deep obsidian vaults and automated potion defense systems.",
    imageUrl: "/images/vote-reward-vault-v4.png",
    category: "builds",
    authorName: "ShadowBuilder",
    status: "published",
    featured: false,
    likesCount: 45,
  },
  {
    title: "Wither Monarch Realm Battle",
    description: "Epic screenshot from the tier-5 Wither Boss encounter in the Nether Arena.",
    imageUrl: "/images/newsroom-signal-realm-v1.png",
    category: "events",
    authorName: "EnderKnight",
    status: "published",
    featured: false,
    likesCount: 88,
  },
  {
    title: "Steampunk Airship Docks Hub",
    description: "Spawn dock built for the Skyblock realm with custom airships and warp portals.",
    imageUrl: "/images/vote-sanctuary-path-v9.webp",
    category: "spawns",
    authorName: "Mazora Network",
    status: "published",
    featured: false,
    likesCount: 53,
  },
  {
    title: "Guild House Meetup Selfie",
    description: "Squad photo after completing the Lifesteal Guild Hall construction project!",
    imageUrl: "/images/mazora-world-continuation.webp",
    category: "community",
    authorName: "PixelQueen",
    status: "published",
    featured: false,
    likesCount: 112,
  },
  {
    title: "Gothic Cathedral of the Void",
    description: "Detailed Gothic architecture featuring stained glass quartz windows and towering spires.",
    imageUrl: "/images/vote-sanctuary-continuation-v7.png",
    category: "builds",
    authorName: "ArchitechtX",
    status: "published",
    featured: true,
    likesCount: 156,
  },
  {
    title: "Tournament Finals 1v1 PvP Arena",
    description: "Action shot from the monthly PvP championship match between EnderKnight and BladeMaster.",
    imageUrl: "/images/vote-mission-hero-v3.png",
    category: "events",
    authorName: "Mazora Network",
    status: "published",
    featured: false,
    likesCount: 71,
  },
  {
    title: "Mystic Woodland Treehouse Village",
    description: "Interconnected giant jungle treehouses built entirely in Survival mode without flying commands.",
    imageUrl: "/images/vote-world-bg-v2.png",
    category: "builds",
    authorName: "ForestElf",
    status: "published",
    featured: false,
    likesCount: 39,
  },
  {
    title: "Undersea Atlantis Portal Temple",
    description: "Glass dome subaquatic spawn temple with guardian monuments and prismarine pillars.",
    imageUrl: "/images/vote-reward-realm-v6.png",
    category: "spawns",
    authorName: "AquaCrafter",
    status: "published",
    featured: false,
    likesCount: 61,
  },
  {
    title: "Ancient Ruin Portal Monument",
    description: "Explorer build featuring mossy stone bricks, custom skull decorations, and hidden loot vaults.",
    imageUrl: "/images/newsroom-header-continuation-v3.png",
    category: "builds",
    authorName: "RuinHunter",
    status: "published",
    featured: false,
    likesCount: 52,
  },
  {
    title: "Pending Build Submission Demo",
    description: "A community player submission awaiting staff review in the admin panel queue.",
    imageUrl: "/images/vote-hero-bg-v2.png",
    category: "builds",
    authorName: "NewbieBuilder",
    status: "pending",
    featured: false,
    likesCount: 0,
  },
];

async function seed() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false });

  try {
    console.log("Clearing existing gallery entries...");
    await sql`DELETE FROM gallery_likes`;
    await sql`DELETE FROM gallery_images`;

    console.log("Seeding demo gallery items with local Mazora high-res artwork assets...");
    for (const item of DEMO_GALLERY) {
      await sql`
        INSERT INTO gallery_images (
          title, description, image_url, category, author_name, status, featured, likes_count
        ) VALUES (
          ${item.title}, ${item.description}, ${item.imageUrl}, ${item.category}, ${item.authorName}, ${item.status}, ${item.featured}, ${item.likesCount}
        )
      `;
    }
    console.log(`✓ Successfully seeded ${DEMO_GALLERY.length} local demo gallery entries!`);
  } catch (err) {
    console.error("Failed to seed gallery items:", err);
  } finally {
    await sql.end();
  }
}

seed();
