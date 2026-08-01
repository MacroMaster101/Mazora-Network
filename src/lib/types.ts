/**
 * Domain types shared across the app. These are the shapes pages consume —
 * repositories return them whether the data comes from the DB or demo fixtures.
 * Icons are stored as string keys (not components) so data stays serializable
 * across the server/client boundary.
 */

export type Accent = "green" | "gold" | "cyan" | "rose" | "violet" | "orange";
export type OnlineStatus = "online" | "offline";

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
