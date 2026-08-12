/**
 * Domain types shared across the app. These are the shapes pages consume —
 * repositories return them whether the data comes from the DB or demo fixtures.
 * Icons are stored as string keys (not components) so data stays serializable
 * across the server/client boundary.
 */

export type Accent = "green" | "gold" | "cyan" | "rose" | "violet" | "orange";
export type OnlineStatus = "online" | "offline";

export interface StoreWelcomeBannerConfig {
  badge: string;
  title: string;
  paragraph1: string;
  paragraph2: string;
  supportNote: string;
  imageUrl: string;
  enabled: boolean;
}

export const DEFAULT_STORE_WELCOME_BANNER: StoreWelcomeBannerConfig = {
  badge: "EST. 2020 · SURVIVAL RPG EXPERIENCE",
  title: "Welcome to Mazora - Survival",
  paragraph1:
    "Since 2020, Mazora has been dedicated to delivering a premium survival experience where fantasy, medieval adventure, RPG progression, and classic Minecraft come together in one immersive world. Explore breathtaking custom biomes, conquer handcrafted dungeons, challenge powerful bosses, master unique skills, collect animated weapon cosmetics, and discover countless ways to forge your own adventure through carefully balanced progression.",
  paragraph2:
    "Whether you’re building your dream base, trading with the community, venturing into the unknown, or embracing PvP, Mazora gives you the freedom to play your way. With regular updates, an ever-expanding world, and a welcoming community from around the globe, there’s always something new waiting beyond the horizon.",
  supportNote:
    "Every purchase from our store directly supports Mazora’s ongoing development, helping us create new content, improve existing features, and continue delivering the high-quality survival experience our players have enjoyed since 2020. Thank you for being part of Mazora’s journey.",
  imageUrl: "/images/vote-world-bg-v2.webp",
  enabled: true,
};

export interface StoreRoadmapItem {
  id: string;
  title: string;
  desc: string;
  status: string;
  icon: string;
  enabled: boolean;
}

export interface StoreRoadmapConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: StoreRoadmapItem[];
  enabled: boolean;
}

export const DEFAULT_STORE_ROADMAP: StoreRoadmapConfig = {
  eyebrow: "MARKETPLACE ROADMAP",
  title: "More ways to stand out.",
  subtitle: "Sneak peek at upcoming feature bundles, custom cosmetics, and unique upgrades currently in development.",
  enabled: true,
  items: [
    {
      id: "weapon-bundles",
      title: "Weapon Bundles",
      desc: "Curated sets of animated weapon skins and custom particle trails.",
      status: "Coming Soon",
      icon: "package",
      enabled: true,
    },
    {
      id: "custom-weapons",
      title: "Custom Weapons",
      desc: "Exclusive 3D weapon models with unique skill abilities.",
      status: "In Development",
      icon: "sword",
      enabled: true,
    },
    {
      id: "custom-pets",
      title: "Custom Pets",
      desc: "Animated companion pets with stat boosts and cosmetic effects.",
      status: "Coming Soon",
      icon: "sparkles",
      enabled: true,
    },
    {
      id: "seasonal-cosmetics",
      title: "Seasonal Cosmetics",
      desc: "Limited-edition holiday armor trims, cloaks, and aura particles.",
      status: "Planned",
      icon: "wand",
      enabled: true,
    },
  ],
};

export type Role =
  | "guest"
  | "member"
  | "sponsor"
  | "vip"
  | "helper"
  | "moderator"
  | "senior_moderator"
  | "administrator"
  | "owner"
  | "it";

/** Discord account details captured from a Discord OAuth sign-in. */
export interface DiscordIdentity {
  /** Discord snowflake ID, or empty string when the provider did not supply one. */
  id: string;
  username: string;
  /** CDN avatar URL, when Discord supplied one. */
  avatarUrl?: string;
}

export interface GameMode {
  id?: string;
  slug: string;
  name: string;
  icon: string;
  accent: Accent;
  tagline: string;
  description: string;
  players: number;
  version: string;
  features: string[];
  commands: { cmd: string; desc: string }[];
  rules: string[];
  storeStatus?: "live" | "coming_soon";
  sortOrder?: number;
  enabled?: boolean;
}

export interface NewsArticle {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  category: string;
  accent: Accent;
  date: string; // ISO
  author: string;
  authorRole?: string;
  authorAvatar?: string;
  publisherMode?: "team" | "author";
  readMinutes: number;
  /** Discord CDN image from the imported announcement. Falls back to CoverArt when absent. */
  featuredImage?: string;
}

export type EventStatus = "upcoming" | "live" | "completed";

export interface EventItem {
  slug: string;
  title: string;
  description: string;
  icon: string;
  accent: Accent;
  startISO: string;
  endISO: string;
  status: EventStatus;
  mode: string;
  prize: string;
  joined: number;
  maxParticipants: number;
  requirements: string[];
  rewards: string[];
  rules: string[];

  winners?: { place: number; username: string; prize: string }[];
}

export interface Player {
  username: string;
  uuid: string;
  /** A self-uploaded skin's processed head icon, when set. See MinecraftAvatar. */
  customSkinUrl?: string | null;
  rank: string;
  accent: Accent;
  level: number;
  playtimeHours: number;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  balance: number;
  blocksMined: number;
  blocksPlaced: number;
  killStreak: number;
  status: OnlineStatus;
  firstJoined: string; // ISO
  lastSeen: string; // ISO or "now"
  currentMode: string;
  badges: string[];
  achievements: string[];
}

export interface RuleCategory {
  slug: string;
  name: string;
  icon: string;
  updated: string; // ISO
  items: { title: string; body: string }[];
}

export interface StaffMember {
  username: string;
  group: string; // Owner, Management, Administrators, Developers, Moderators, Helpers, Builders
  title: string;
  bio: string;
  joinDate: string; // ISO
  discord?: string;
  status: OnlineStatus;
  accent: Accent;
}

export interface GalleryImage {
  id: string;
  title: string;
  description?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  category: string;
  accent?: Accent;
  author: string;
  authorAvatar?: string | null;
  featured: boolean;
  likesCount: number;
  hasLiked?: boolean;
  createdAt: string;
}

export interface Product {
  id?: string;
  slug: string;
  name: string;
  imageUrl?: string;
  category: string;
  description: string;
  price: number;
  salePrice?: number;
  features: string[];
  accent: Accent;
  badge?: string;
  family?: string;
  billing?: "Monthly" | "Permanent";
  subcategory?: string;
  gameModeSlug?: string;
  sortOrder?: number;
  enabled?: boolean;
}

export interface StoreSubcategoryConfig {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  icon?: string;
}

export interface StoreCategoryConfig {
  gameModeSlug: string;
  key: Product["category"];
  label: string;
  eyebrow: string;
  description: string;
  accent: Accent;
  sortOrder: number;
  enabled: boolean;
  useSubcategories: boolean;
  subcategories: StoreSubcategoryConfig[];
  icon?: string;
}

export interface VoteSite {
  id: string;
  name: string;
  url: string;
  reward: string;
  cooldownHours: number;
}

export interface TopVoter {
  username: string;
  dailyVotes: number;
  weeklyVotes: number;
  monthlyVotes: number;
  lastMonthVotes: number;
  allTimeVotes: number;
}



export interface ServerStatus {
  online: boolean;
  players: number;
  max: number;
  version: string;
  motd: string;
  ping: number;
  uptime: string;
  lastUpdate: string; // ISO
  java: { online: boolean; address: string };
  bedrock: { online: boolean; address: string; port: string };
  /** true only when a real status API is configured */
  live: boolean;
}

export interface PatchUpdate {
  id: string;
  version: string;
  targetMode: string;
  date: string;
  author: string;
  authorRole?: string;
  authorAvatar?: string;
  changes: string[];
  discordChannel?: string;
}

export interface PlayPageConfig {
  javaIp: string;
  bedrockIp: string;
  bedrockPort: string;
  supportedVersion: string;
  discordChannelId: string;
  heroTitle: string;
  heroLead: string;
  statusOverride: "live" | "degraded" | "offline";
  telemetryMessage?: string;
  javaSteps: string[];
  bedrockSteps: string[];
}

export const DEFAULT_PLAY_CONFIG: PlayPageConfig = {
  javaIp: "mc.mazora.us",
  bedrockIp: "mc.mazora.us",
  bedrockPort: "8876",
  supportedVersion: "Leaf 1.21.11",
  discordChannelId: "1193207365906997379",
  heroTitle: "Joining takes about a minute.",
  heroLead: "Copy the address, add the server, and you're in. Here's exactly how on both editions.",
  statusOverride: "live",
  telemetryMessage: "No downtime recorded during this hour.",
  javaSteps: [
    "Open Minecraft Java Edition.",
    "Click Multiplayer, then Add Server.",
    "Enter Server Name: Mazora Network and Server Address: mc.mazora.us",
    "Click Done, select Mazora Network, and click Join Server.",
  ],
  bedrockSteps: [
    "Open Minecraft on your mobile device, Windows PC, or console.",
    "Tap Play, then choose the Servers tab.",
    "Scroll down and tap Add Server.",
    "Server Name: Mazora Network, Server Address: mc.mazora.us",
    "Enter the port: 8876",
    "Save, then tap the server to join.",
  ],
};

