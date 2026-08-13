/**
 * Structured data (schema.org JSON-LD).
 *
 * Only schemas that describe something genuinely on the page belong here.
 * Nothing in this file invents ratings, reviews or aggregate counts — Google
 * treats fabricated rich-result markup as spam, and the penalty lands on the
 * whole domain rather than the one page.
 *
 * Every `@id` is an absolute https://mazora.us URL so the graph nodes join up
 * across pages instead of each page declaring an unrelated Organization.
 */
import type { Metadata } from "next";
import { site } from "@/lib/site";

const base = site.url.replace(/\/$/, "");

const DEFAULT_SOCIAL_IMAGE = {
  url: absoluteUrl("/images/og-default.webp"),
  width: 1200,
  height: 630,
  alt: `${site.name} — Minecraft survival, skyblock and minigame worlds`,
};

/** Complete metadata for a public page; nested OG fields do not inherit title/description in Next.js. */
export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
}): Metadata {
  const url = absoluteUrl(input.path);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      title: `${input.title} · ${site.name}`,
      description: input.description,
      url,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${input.title} · ${site.name}`,
      description: input.description,
      images: [DEFAULT_SOCIAL_IMAGE.url],
    },
    ...(input.robots ? { robots: input.robots } : {}),
  };
}

export const ORGANIZATION_ID = `${base}/#organization`;
export const WEBSITE_ID = `${base}/#website`;

/** Absolute URL for a site-relative path. Structured data may not use relative URLs. */
export function absoluteUrl(path: string): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: site.name,
    url: `${base}/`,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/images/mazora-icon.png"),
      width: 512,
      height: 512,
    },
    description: site.description,
    sameAs: site.socials.map((s) => s.href),
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.name,
    url: `${base}/`,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * Breadcrumbs for a page. Pass the trail *excluding* the home crumb, which is
 * always prepended. e.g. breadcrumbSchema([{ name: "News", path: "/news" }]).
 */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export interface ArticleSchemaInput {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  imageUrl?: string;
  authorName?: string;
}

export function newsArticleSchema(input: ArticleSchemaInput) {
  const url = absoluteUrl(`/news/${input.slug}`);
  return {
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    // Google truncates headlines past ~110 characters in rich results, and
    // articles here are imported from Discord announcements, whose titles are
    // not written to a length budget.
    headline: input.title.slice(0, 110),
    // Excerpts come from Discord message bodies, so they arrive with hard line
    // breaks in them. Collapsed to single spaces — a description is one line.
    description: input.description.replace(/\s+/g, " ").trim(),
    datePublished: input.publishedAt,
    // Omitted rather than defaulted: claiming a modification that never
    // happened is exactly the kind of signal Google discounts a source for.
    ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    author: input.authorName
      ? { "@type": "Person", name: input.authorName }
      : { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": WEBSITE_ID },
    url,
  };
}

export interface ProductSchemaInput {
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
}

/** Product details that are visible on the public Store page. */
export function productSchema(input: ProductSchemaInput) {
  const url = absoluteUrl(`/store/${input.slug}`);
  const image = /^https?:\/\//.test(input.imageUrl) ? input.imageUrl : absoluteUrl(input.imageUrl);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: input.name,
    description: input.description,
    image: [image],
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: input.price.toFixed(2),
      availability: "https://schema.org/InStock",
      seller: { "@id": ORGANIZATION_ID },
    },
  };
}

/**
 * Wraps nodes in a single @graph document. One script tag per page keeps the
 * nodes cross-referencing each other by @id rather than repeating themselves.
 */
export function jsonLdGraph(...nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
