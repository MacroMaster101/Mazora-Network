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
  | "vip"
  | "staff"
  | "moderator"
  | "administrator"
  | "owner";

export interface GameMode {
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
  readMinutes: number;
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
  category: string;
  accent: Accent;
  author: string;
}

export interface Product {
  slug: string;
  name: string;
  category: "Ranks" | "Cosmetics" | "Coins" | "Crate Keys" | "Bundles";
  description: string;
  price: number;
  salePrice?: number;
  features: string[];
  accent: Accent;
  badge?: string;
}

export interface VoteSite {
  id: string;
  name: string;
  url: string;
  reward: string;
  cooldownHours: number;
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
