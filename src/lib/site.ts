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
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://mazora.us",
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
  {
    label: "Forums",
    children: [
      { label: "Staff application", href: "/support/staff-application", description: "Apply to join the Mazora team" },
      { label: "Content Creator", href: "/support/content-creator", description: "Creator applications and community media" },
      { label: "Ban appeal", href: "/support/appeal", description: "Request a punishment review" },
      { label: "Suggestions", href: "/support/suggestions", description: "Share an idea with the community" },
      { label: "Discussion forum", href: "/forums", description: "Talk updates, modes and builds" },
    ],
  },
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
      { label: "Support", href: "/support" },
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
