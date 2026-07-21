import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getEvents, getGameModes, getNews, getProducts } from "@/lib/data/content";
import { getPlayers } from "@/lib/data/players";
import { isRouteLaunchGated } from "@/lib/launch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = [
    "",
    "/play",
    "/status",
    "/game-modes",
    "/players",
    "/leaderboards",
    "/news",
    "/events",
    "/rules",
    "/staff",
    "/gallery",
    "/forums",
    "/discord",
    "/vote",
    "/store",
    "/support",
    "/support/staff-application",
    "/support/appeal",
    "/support/suggestions",
    "/privacy",
    "/terms",
    "/refunds",
  ].filter((path) => !isRouteLaunchGated(path || "/")).map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const [modes, news, events, products, players] = await Promise.all([
    getGameModes(),
    getNews(),
    getEvents(),
    getProducts(),
    getPlayers(),
  ]);

  const dynamic: MetadataRoute.Sitemap = [
    ...modes.map((m) => ({ url: `${base}/game-modes/${m.slug}`, lastModified: now, priority: 0.6 })),
    ...news.map((n) => ({ url: `${base}/news/${n.slug}`, lastModified: new Date(n.date), priority: 0.6 })),
    ...events.map((e) => ({ url: `${base}/events/${e.slug}`, lastModified: now, priority: 0.5 })),
    ...products.map((p) => ({ url: `${base}/store/${p.slug}`, lastModified: now, priority: 0.5 })),
    ...players.map((p) => ({ url: `${base}/players/${p.username}`, lastModified: now, priority: 0.4 })),
  ];

  return [...staticRoutes, ...dynamic].filter(({ url }) => !isRouteLaunchGated(new URL(url).pathname));
}
