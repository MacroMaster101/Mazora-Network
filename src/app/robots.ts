import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

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
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
