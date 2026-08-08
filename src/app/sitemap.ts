import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getEvents, getGameModes, getNews, getProducts } from "@/lib/data/content";
import { getPlayers } from "@/lib/data/players";
import { isRouteLaunchGated } from "@/lib/launch";

/**
 * Only canonical, publicly indexable https://mazora.us URLs belong here.
 *
 * `lastModified` is deliberately omitted unless the entry has a real timestamp
 * behind it. Stamping `new Date()` on every row — which this file used to do —
 * tells Google that every page on the site changed at the exact moment it
 * fetched the sitemap. That is never true, and once a source is caught
 * reporting it, the signal stops being used at all. News articles carry a
 * genuine publication date, so they keep theirs; nothing else on the site
 * currently records a modification time.
 *
 * Excluded on purpose:
 *  - /admin, /dashboard, /cart and the auth routes — private or user-specific.
 *  - /help — an alias that renders /support, and canonicalises to it.
 *  - /launch-status — the rewrite target of the pre-launch gate, not a page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");

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
    "/support/report-player",
    "/support/report-bug",
    "/support/content-creator",
    "/privacy",
    "/terms",
    "/refunds",
  ].map((path) => ({
    url: `${base}${path}`,
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
    ...modes.map((m) => ({ url: `${base}/game-modes/${m.slug}`, priority: 0.6 })),
    ...news.map((n) => ({ url: `${base}/news/${n.slug}`, lastModified: new Date(n.date), priority: 0.6 })),
    ...events.map((e) => ({ url: `${base}/events/${e.slug}`, priority: 0.5 })),
    ...products.map((p) => ({ url: `${base}/store/${p.slug}`, priority: 0.5 })),
    ...players.map((p) => ({ url: `${base}/players/${p.username}`, priority: 0.4 })),
  ];

  // One filter over the finished list: a launch-gated route rewrites to
  // /launch-status, so submitting it would hand Google a redirect-like page.
  // Deduped because a slug collision between two content types would otherwise
  // emit the same <loc> twice, which validators flag.
  const seen = new Set<string>();
  return [...staticRoutes, ...dynamic].filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return !isRouteLaunchGated(new URL(url).pathname);
  });
}
