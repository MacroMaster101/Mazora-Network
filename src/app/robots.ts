import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { isLaunchModeEnabled, launchGates } from "@/lib/launch";

/**
 * Crawling directives — a courtesy to well-behaved bots, never a security
 * control. Everything listed below is independently protected by a server-side
 * session/role check; a disallow line only stops a URL being fetched, and any
 * client is free to ignore it.
 *
 * Nothing that Google needs in order to *render* a public page is blocked:
 * /_next/static (JS, CSS, fonts) and /images stay crawlable, because a blocked
 * stylesheet makes Googlebot score the page on a broken layout.
 */
export default function robots(): MetadataRoute.Robots {
  const base = site.url.replace(/\/$/, "");

  /*
    The launch gate REWRITES rather than redirects, so a gated URL answers 200
    with the "Coming Soon" body instead of 404. For /players that matters: it is
    a `tree` gate, so /players/<any string at all> returns 200, and a crawler
    that wanders in finds an unbounded space of identical pages, each
    self-canonicalising to its own junk slug. The pages carry noindex, so this
    is crawl budget and Search Console noise rather than ranking damage — but
    there is no reason to spend either.

    Derived from `launchGates` instead of being listed by hand so the two cannot
    drift, and dropped automatically once MAZORA_LAUNCH_MODE is off and the real
    routes should be crawled.
  */
  const gatedPaths = isLaunchModeEnabled() ? launchGates.map((gate) => gate.path) : [];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/api/",
        "/auth/",
        "/cart",
        "/login",
        "/logout",
        "/register",
        "/reset-password",
        "/forgot-password",
        "/confirm-email",
        "/verify-email",
        // Rewrite target for the pre-launch gate: real content lives at the
        // gated URL, so this must never be indexed in its place.
        "/launch-status",
        ...gatedPaths,
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
