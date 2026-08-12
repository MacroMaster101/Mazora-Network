/** The one origin every canonical, OG tag and sitemap URL is built from. */
const CANONICAL_ORIGIN = "https://mazora.us";

/**
 * Resolves the public origin, refusing values that would poison canonical URLs.
 *
 * Every `<link rel="canonical">`, `og:url` and sitemap `<loc>` on the site is
 * derived from this one string, so a wrong value here is not a cosmetic bug —
 * it tells Google the real home of every page is somewhere else. The two ways
 * that actually happens in practice are a `NEXT_PUBLIC_SITE_URL` left pointing
 * at localhost (copied from .env.example into the Vercel dashboard) and one set
 * to the *.vercel.app deployment URL, which 308s to the apex and must never be
 * advertised as canonical.
 *
 * In production those are ignored in favour of the apex, so a misconfigured
 * dashboard degrades to "correct" instead of to "silently de-indexed". Plain
 * http:// is upgraded for the same reason. Development keeps whatever is set,
 * because localhost is the right answer there.
 *
 * Exported for the unit tests; `site.url` below is the only production caller.
 * Test files are gitignored, so static analysis reports this export as unused —
 * it is not. Dropping the `export` would silently break the local test suite.
 */
export function resolvePublicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return CANONICAL_ORIGIN;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return CANONICAL_ORIGIN;
  }

  if (process.env.NODE_ENV !== "production") return parsed.origin;

  const host = parsed.hostname.toLowerCase();
  const unusable =
    parsed.protocol !== "https:" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host.startsWith("www.");
  return unusable ? CANONICAL_ORIGIN : parsed.origin;
}

/** Server-wide configuration. In Phase 2 these become editable site_settings rows. */
export const site = {
  name: "Mazora Network",
  shortName: "MAZORA",
  domain: "mazora.us",
  tagline: "Build. Survive. Compete. Create.",
  description:
    "A player-first Minecraft network built around unforgettable worlds, fair competition, and a community worth staying for.",
  javaIp: "mc.mazora.us",
  bedrockIp: "mc.mazora.us",
  bedrockPort: process.env.NEXT_PUBLIC_BEDROCK_PORT ?? "8876",
  version: "1.21.11",
  region: "Asia Pacific",
  launchDate: "2023-10-01",
  discord: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/ZPrzyGpMyt",
  discordSupportTickets:
    process.env.NEXT_PUBLIC_DISCORD_SUPPORT_TICKETS_URL ??
    "https://discord.com/channels/805453071261237286/1311727859672547478",
  url: resolvePublicOrigin(),
  socials: [
    { label: "Discord", href: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/ZPrzyGpMyt", icon: "Discord" },
    { label: "TikTok", href: "https://www.tiktok.com/@mazoramc?_r=1&_t=ZS-98Q2DRMhZZa", icon: "TikTok" },
  ],
} as const;

export type NavItem = {
  label: string;
  href?: string;
  children?: { label: string; href: string; description?: string }[];
};

/** Primary navigation shown in the header. */
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Gallery", href: "/gallery" },
  { label: "Support", href: "/support" },
  { label: "Our Team", href: "/staff" },
  { label: "Rules", href: "/rules" },
  { label: "Store", href: "/store" },
  {
    label: "More",
    children: [
      { label: "Game modes", href: "/game-modes" },
      { label: "Players", href: "/players" },
      { label: "Leaderboards", href: "/leaderboards" },
      { label: "News", href: "/news" },
      { label: "Events", href: "/events" },
      { label: "Vote", href: "/vote" },
      { label: "Discord", href: "/discord" },
    ],
  },
];

export const footerNav = {
  Explore: [
    { label: "Game Modes", href: "/game-modes" },
    { label: "Players", href: "/players" },
    { label: "Leaderboards", href: "/leaderboards" },
    { label: "Gallery", href: "/gallery" },
    { label: "Staff", href: "/staff" },
  ],
  Community: [
    { label: "News", href: "/news" },
    { label: "Events", href: "/events" },
    { label: "Discord", href: "/discord" },
    { label: "Vote", href: "/vote" },
    { label: "Store", href: "/store" },
  ],
  Support: [
    { label: "Support Center", href: "/support" },
    { label: "Ban Appeal", href: "/support/appeal" },
    { label: "Staff Application", href: "/support/staff-application" },
    { label: "Content Creator", href: "/support/content-creator" },
    { label: "Report a Player", href: "/support/report-player" },
    { label: "Report a Bug", href: "/support/report-bug" },
    { label: "Rules", href: "/rules" },
  ],
  Account: [
    { label: "Log in", href: "/login" },
    { label: "Register", href: "/register" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Settings", href: "/dashboard/settings" },
  ],
};

export const legalNav = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refunds", href: "/refunds" },
];
