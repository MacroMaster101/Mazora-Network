import "server-only";
import type { NextRequest } from "next/server";
import { CONSENT_ACCEPTED, CONSENT_COOKIE } from "@/lib/consent-client";

/** Single capped cookie holding every article slug this client has been counted for. */
export const READS_COOKIE = "mazora_news_reads";
/** Pre-consolidation format: one cookie per article at path "/". Migrated then expired. */
export const LEGACY_READ_COOKIE_PREFIX = "mazora_news_read_";
export const VISITOR_COOKIE = "mazora_news_visitor";

/**
 * Analytics cookies are scoped to the API path that reads them, so they are not
 * attached to page or static-asset requests. Nothing else on the site needs them.
 */
export const NEWS_COOKIE_PATH = "/api/news";

export const READ_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 12;

/** Cookies must stay under ~4 KB total; leave headroom for the name and attributes. */
const MAX_READS_COOKIE_BYTES = 3_500;

export function analyticsCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Analytics counting is opt-in: absent an explicit "accepted", nothing is
 * counted and no counting cookie is written.
 */
export function hasAnalyticsConsent(request: NextRequest): boolean {
  return request.cookies.get(CONSENT_COOKIE)?.value === CONSENT_ACCEPTED;
}

export function parseReadSlugs(raw: string | undefined, pattern: RegExp): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0 && slug.length <= 120 && pattern.test(slug));
}

/**
 * Serialise newest-last, dropping the oldest entries until the value fits. A
 * dropped slug can be re-counted on a later visit — an acceptable trade for a
 * cookie that can never grow without bound.
 */
export function serializeReadSlugs(slugs: string[]): string {
  let kept = [...new Set(slugs)];
  while (kept.length > 0 && Buffer.byteLength(kept.join(","), "utf8") > MAX_READS_COOKIE_BYTES) {
    kept = kept.slice(1);
  }
  return kept.join(",");
}
