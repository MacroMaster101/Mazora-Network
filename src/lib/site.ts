/** Server-wide configuration. In Phase 2 these become editable site_settings rows. */
export const site = {
  name: "Mazora Network",
  shortName: "MAZORA",
  tagline: "Build. Survive. Compete. Create.",
  description:
    "A player-first Minecraft network built around unforgettable worlds, fair competition, and a community worth staying for.",
  javaIp: "play.mazora.net",
  bedrockIp: "bedrock.mazora.net",
  bedrockPort: "19132",
  version: "1.21.x",
  region: "Asia Pacific",
  launchDate: "2023-10-01",
  discord: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/example",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  socials: [
    { label: "Discord", href: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/example", icon: "MessagesSquare" },
    { label: "YouTube", href: "https://youtube.com", icon: "Youtube" },
    { label: "X / Twitter", href: "https://x.com", icon: "Twitter" },
    { label: "TikTok", href: "https://tiktok.com", icon: "Music2" },
  ],
} as const;

/** Primary navigation shown in the header. */
export const primaryNav: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Modes", href: "/game-modes" },
  { label: "Players", href: "/players" },
  { label: "Ranks", href: "/leaderboards" },
  { label: "News", href: "/news" },
  { label: "Events", href: "/events" },
  { label: "Rules", href: "/rules" },
  { label: "Vote", href: "/vote" },
  { label: "Store", href: "/store" },
  { label: "Support", href: "/support" },
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
  { label: "Terms", href: "/support" },
  { label: "Privacy", href: "/support" },
  { label: "Refunds", href: "/support" },
];
