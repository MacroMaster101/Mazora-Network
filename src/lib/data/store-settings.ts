import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { MAX_STORE_FEATURED_SLUGS, MIN_STORE_FEATURED_SLUGS } from "@/lib/types";

export const STORE_FEATURED_PICKS_KEY = "store.featured_picks";
export const DEFAULT_STORE_FEATURED_SLUGS = [
  "battlepass-premium",
  "key-legendary-1",
  "rank-conqueror-permanent",
];

/*
  The bounds were exactly three, in five places, and the read was the strict one:
  a saved list of any other length was thrown away and the defaults shown
  instead, so staff who picked two saw three products they had not chosen and no
  explanation. The row is an auto-fitting grid, so the count was never a layout
  constraint — only a bound worth keeping so the section stays a shortlist.

  Defined in lib/types because the admin editor is a client component and this
  module reaches the database. Re-exported so server callers can keep taking
  everything about this setting from one place.
*/
export { MAX_STORE_FEATURED_SLUGS, MIN_STORE_FEATURED_SLUGS } from "@/lib/types";

export async function getStoreFeaturedSlugs(): Promise<string[]> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_FEATURED_SLUGS;
  }
  if (!db) return DEFAULT_STORE_FEATURED_SLUGS;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_FEATURED_PICKS_KEY))
      .limit(1);
    const value = row?.value;
    if (!Array.isArray(value)) return DEFAULT_STORE_FEATURED_SLUGS;
    const slugs = value
      .filter((slug): slug is string => typeof slug === "string")
      .slice(0, MAX_STORE_FEATURED_SLUGS);
    // Only an empty list falls back — any saved selection is the staff's answer.
    return slugs.length >= MIN_STORE_FEATURED_SLUGS ? slugs : DEFAULT_STORE_FEATURED_SLUGS;
  } catch {
    /* DB may not have this table/key yet — fall back silently */
    return DEFAULT_STORE_FEATURED_SLUGS;
  }
}

import {
  DEFAULT_STORE_ROADMAP,
  DEFAULT_STORE_WELCOME_BANNER,
  type StoreRoadmapConfig,
  type StoreRoadmapItem,
  type StoreWelcomeBannerConfig,
} from "@/lib/types";

export { DEFAULT_STORE_ROADMAP, DEFAULT_STORE_WELCOME_BANNER, type StoreRoadmapConfig, type StoreRoadmapItem, type StoreWelcomeBannerConfig };
export const STORE_WELCOME_BANNER_KEY = "store.welcome_banner";
export const STORE_ROADMAP_KEY = "store.roadmap";

export async function getStoreWelcomeBanner(): Promise<StoreWelcomeBannerConfig> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_WELCOME_BANNER;
  }
  if (!db) return DEFAULT_STORE_WELCOME_BANNER;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_WELCOME_BANNER_KEY))
      .limit(1);
    if (!row?.value || typeof row.value !== "object") return DEFAULT_STORE_WELCOME_BANNER;
    const v = row.value as Record<string, unknown>;
    return {
      badge: typeof v.badge === "string" ? v.badge : DEFAULT_STORE_WELCOME_BANNER.badge,
      title: typeof v.title === "string" ? v.title : DEFAULT_STORE_WELCOME_BANNER.title,
      paragraph1: typeof v.paragraph1 === "string" ? v.paragraph1 : DEFAULT_STORE_WELCOME_BANNER.paragraph1,
      paragraph2: typeof v.paragraph2 === "string" ? v.paragraph2 : DEFAULT_STORE_WELCOME_BANNER.paragraph2,
      supportNote: typeof v.supportNote === "string" ? v.supportNote : DEFAULT_STORE_WELCOME_BANNER.supportNote,
      imageUrl: (function() {
        const raw = typeof v.imageUrl === "string" && v.imageUrl.trim() ? v.imageUrl.trim() : DEFAULT_STORE_WELCOME_BANNER.imageUrl;
        return raw.startsWith("/images/store/") && raw.endsWith(".png") ? raw.replace(/\.png$/, ".webp") : raw;
      })(),
      enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_STORE_WELCOME_BANNER.enabled,
    };
  } catch {
    /* DB may not have this table/key yet — fall back silently */
    return DEFAULT_STORE_WELCOME_BANNER;
  }
}

export async function getStoreRoadmap(): Promise<StoreRoadmapConfig> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_ROADMAP;
  }
  if (!db) return DEFAULT_STORE_ROADMAP;

  try {
    const rows = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_ROADMAP_KEY))
      .limit(1);
    const row = rows[0];
    if (!row?.value || typeof row.value !== "object") return DEFAULT_STORE_ROADMAP;
    const v = row.value as Record<string, unknown>;
    const rawItems = Array.isArray(v.items) ? v.items : DEFAULT_STORE_ROADMAP.items;
    const items: StoreRoadmapItem[] = rawItems
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, idx) => ({
        id: typeof item.id === "string" ? item.id : `roadmap-${idx}`,
        title: typeof item.title === "string" ? item.title : "Upcoming Feature",
        desc: typeof item.desc === "string" ? item.desc : "",
        status: typeof item.status === "string" ? item.status : "Coming Soon",
        icon: typeof item.icon === "string" ? item.icon : "package",
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      }));

    return {
      eyebrow: typeof v.eyebrow === "string" ? v.eyebrow : DEFAULT_STORE_ROADMAP.eyebrow,
      title: typeof v.title === "string" ? v.title : DEFAULT_STORE_ROADMAP.title,
      subtitle: typeof v.subtitle === "string" ? v.subtitle : DEFAULT_STORE_ROADMAP.subtitle,
      enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_STORE_ROADMAP.enabled,
      items: items.length > 0 ? items : DEFAULT_STORE_ROADMAP.items,
    };
  } catch {
    /* DB may not have this key yet — fall back silently */
    return DEFAULT_STORE_ROADMAP;
  }
}

import {
  DEFAULT_STORE_INVOICE_DETAILS,
  type StoreInvoiceDetails,
} from "@/lib/types";
export { DEFAULT_STORE_INVOICE_DETAILS, type StoreInvoiceDetails };

export const STORE_INVOICE_DETAILS_KEY = "store.invoice_details";

/** Trims, drops blanks, and caps the list so one paste cannot grow the header. */
function toAddressLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function optionalText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * The issuer block for store invoices. Degrades to the defaults whenever the
 * row is missing or malformed, so the invoice page always renders rather than
 * erroring on a document staff are about to hand to a buyer.
 */
export async function getStoreInvoiceDetails(): Promise<StoreInvoiceDetails> {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return DEFAULT_STORE_INVOICE_DETAILS;
  }
  if (!db) return DEFAULT_STORE_INVOICE_DETAILS;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_INVOICE_DETAILS_KEY))
      .limit(1);
    if (!row?.value || typeof row.value !== "object") return DEFAULT_STORE_INVOICE_DETAILS;
    const v = row.value as Record<string, unknown>;
    return {
      businessName: optionalText(v.businessName, DEFAULT_STORE_INVOICE_DETAILS.businessName),
      website: optionalText(v.website, DEFAULT_STORE_INVOICE_DETAILS.website),
      addressLines: toAddressLines(v.addressLines),
      // These two are genuinely optional, so an empty string stays empty
      // instead of falling back to a default the operator never entered.
      postcode: typeof v.postcode === "string" ? v.postcode.trim() : "",
      footerNote: typeof v.footerNote === "string" ? v.footerNote.trim() : "",
    };
  } catch {
    return DEFAULT_STORE_INVOICE_DETAILS;
  }
}
