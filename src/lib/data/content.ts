/**
 * Content repositories. Pages import ONLY from here (and players/status), never
 * the database driver or demo module directly. That keeps the data source a
 * single swappable seam: today these return demo fixtures; wiring them to Neon
 * or Supabase later changes only this file — no page changes.
 *
 * Functions are async so the swap to real DB reads is a drop-in.
 */
import {
  demoEvents,
  demoGallery,
  demoGameModes,
  demoNews,
  demoProducts,
  demoRules,
  demoStaff,
  demoVoteSites,
} from "@/lib/db/demo";
import type {
  EventItem,
  GalleryImage,
  GameMode,
  NewsArticle,
  Product,
  RuleCategory,
  StaffMember,
  VoteSite,
} from "@/lib/types";

export async function getGameModes(): Promise<GameMode[]> {
  return demoGameModes;
}
export async function getGameMode(slug: string): Promise<GameMode | null> {
  return demoGameModes.find((m) => m.slug === slug) ?? null;
}

export async function getNews(): Promise<NewsArticle[]> {
  return [...demoNews].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
export async function getArticle(slug: string): Promise<NewsArticle | null> {
  return demoNews.find((n) => n.slug === slug) ?? null;
}
export async function getRelatedArticles(slug: string, category: string): Promise<NewsArticle[]> {
  return demoNews.filter((n) => n.slug !== slug && n.category === category).slice(0, 3);
}

export async function getEvents(): Promise<EventItem[]> {
  const order = { live: 0, upcoming: 1, completed: 2 };
  return [...demoEvents].sort(
    (a, b) => order[a.status] - order[b.status] || +new Date(a.startISO) - +new Date(b.startISO),
  );
}
export async function getEvent(slug: string): Promise<EventItem | null> {
  return demoEvents.find((e) => e.slug === slug) ?? null;
}

export async function getRules(): Promise<RuleCategory[]> {
  return demoRules;
}

export async function getStaff(): Promise<StaffMember[]> {
  return demoStaff;
}

export async function getGallery(): Promise<GalleryImage[]> {
  return demoGallery;
}

export async function getProducts(): Promise<Product[]> {
  return demoProducts;
}
export async function getProduct(slug: string): Promise<Product | null> {
  return demoProducts.find((p) => p.slug === slug) ?? null;
}

export async function getVoteSites(): Promise<VoteSite[]> {
  return demoVoteSites;
}
