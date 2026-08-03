import { NextRequest, NextResponse } from "next/server";
import {
  getNewsArticleReadCount,
  incrementNewsArticleReadCount,
} from "@/lib/data/news-visitors";
import { getArticle } from "@/lib/data/content";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import {
  LEGACY_READ_COOKIE_PREFIX,
  NEWS_COOKIE_PATH,
  READS_COOKIE,
  READ_COOKIE_MAX_AGE,
  analyticsCookieOptions,
  hasAnalyticsConsent,
  parseReadSlugs,
  serializeReadSlugs,
} from "@/lib/news-analytics-cookies";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Legacy cookies cleared per response, so a heavy reader drains over a few visits
 *  instead of getting one response with a hundred Set-Cookie headers. */
const LEGACY_CLEANUP_PER_RESPONSE = 25;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limit = rateLimit(clientKey(request, "news-read"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfter) },
    );
  }

  const { slug } = await params;
  if (slug.length > 120 || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "Invalid article slug" }, { status: 400 });
  }

  const article = await getArticle(slug);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Without consent we report the number but never write a counting cookie and
  // never increment — the visit stays entirely unrecorded.
  if (!hasAnalyticsConsent(request)) {
    const count = await getNewsArticleReadCount(slug);
    const response = NextResponse.json({ count });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Reads used to be one cookie per article at path "/", which grew without
  // bound and rode along on every request to the site. They now live in a
  // single capped cookie scoped to this API path; any legacy cookies still on
  // the client are folded in here and then expired.
  const legacyNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => name.startsWith(LEGACY_READ_COOKIE_PREFIX));
  const legacySlugs = legacyNames.map((name) => name.slice(LEGACY_READ_COOKIE_PREFIX.length));

  const known = parseReadSlugs(request.cookies.get(READS_COOKIE)?.value, SLUG_PATTERN);
  const merged = [...new Set([...known, ...legacySlugs.filter((s) => SLUG_PATTERN.test(s))])];
  const alreadyCounted = merged.includes(slug);

  const count = alreadyCounted
    ? await getNewsArticleReadCount(slug)
    : await incrementNewsArticleReadCount(slug);
  const response = NextResponse.json({ count });

  if (!alreadyCounted) merged.push(slug);
  if (!alreadyCounted || legacyNames.length > 0) {
    response.cookies.set(READS_COOKIE, serializeReadSlugs(merged), {
      ...analyticsCookieOptions(),
      path: NEWS_COOKIE_PATH,
      maxAge: READ_COOKIE_MAX_AGE,
    });
  }

  for (const name of legacyNames.slice(0, LEGACY_CLEANUP_PER_RESPONSE)) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
