import type { NewsArticle } from "@/lib/types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 28, 12);

const stories = [
  ["voice-chat-live", "In-Game Voice Chat Is Now Live", "Updates", "Explore, build and trade while talking naturally with nearby players across supported Mazora worlds.", "/images/mazora-community-hero.webp"],
  ["season-three", "Season Three: A New Realm Awakens", "Announcements", "A new season brings refreshed progression, unexplored landscapes and community-wide challenges.", "/images/mazora-world-continuation.webp"],
  ["dragon-fight", "The End Fight Returns This Weekend", "Events", "Choose your loadout, rally your team and meet the Ender Dragon in our biggest community fight yet.", "/images/vote-midnight-citadel-v10.webp"],
  ["combat-pass", "Battle Pass: Champions of the Rift", "Store", "Unlock a new reward path filled with cosmetics, boosters and seasonal collectibles.", "/images/store/battlepass-premium.webp"],
  ["bedrock-update", "Bedrock Players Get a Smoother Journey", "Patch Notes", "Connection stability, menus and cross-play feedback have all received a focused quality pass.", "/images/vote-sanctuary-path-v9.webp"],
  ["creative-contest", "Build Beyond the Horizon", "Community", "The creative contest opens with three themes, community voting and exclusive winner rewards.", "/images/vote-world-bg-v2.webp"],
  ["market-refresh", "Player Markets Have Been Refreshed", "Updates", "Shop discovery is faster, listings are clearer and trading now feels better on every device.", "/images/store/shop-marketplace-bg.webp"],
  ["maintenance-july", "Network Maintenance Briefing", "Maintenance", "A short maintenance window will improve world saves, matchmaking and backup reliability.", "/images/vote-body-bg.webp"],
  ["pvp-balance", "PvP Balance Update: Faster, Fairer Fights", "Patch Notes", "Weapon timing, knockback and arena pacing have been tuned using community match data.", "/images/vote-mission-hero-v3.webp"],
  ["top-voters", "Celebrating This Month’s Top Voters", "Community", "Meet the players helping Mazora grow and see the rewards earned at the top of the leaderboard.", "/images/vote-rewards-sanctuary-v5.webp"],
  ["crate-weekend", "Legendary Crate Weekend Begins", "Store", "A limited weekend rotation introduces new cosmetics alongside returning community favourites.", "/images/store/key-legendary.webp"],
  ["survival-expansion", "The Survival Frontier Expands", "Announcements", "New biomes, structures and resource zones are opening beyond the established border.", "/images/vote-sanctuary-continuation-v7.webp"],
  ["rules-update", "Community Rules: Clearer and Easier to Read", "Updates", "The rulebook now gives players faster answers with simpler language and better examples.", "/images/vote-reward-realm-v6.webp"],
  ["event-winners", "Reopening Event Winners", "Events", "Relive the standout moments and celebrate the teams that claimed the reopening trophies.", "/images/vote-reward-vault-v4.webp"],
  ["performance-pass", "Behind the Scenes: The Performance Pass", "Patch Notes", "A look at the server-side changes reducing lag spikes during busy events and world travel.", "/images/vote-hero-bg-v2.webp"],
] as const;

const accents: NewsArticle["accent"][] = ["violet", "cyan", "gold", "green", "rose", "orange"];

export function getPreviewNews(): NewsArticle[] {
  return stories.map(([slug, title, category, excerpt, featuredImage], index) => ({
    slug: `preview-${slug}`,
    title,
    category,
    excerpt,
    featuredImage,
    body: [excerpt, "This is local preview content used to test the newsroom layout with a realistic publishing volume."],
    accent: accents[index % accents.length],
    date: new Date(NOW - index * DAY).toISOString(),
    author: index % 3 === 0 ? "Mazora Team" : index % 3 === 1 ? "OshSparky" : "Network Staff",
    readMinutes: 2 + (index % 5),
  }));
}
