import { NextRequest, NextResponse } from "next/server";
import { getNewsVisitorCount, incrementNewsVisitorCount } from "@/lib/data/news-visitors";
import { claimOnce, clientKey, rateLimitShared, retryAfterHeaders } from "@/lib/rate-limit";
import {
  NEWS_COOKIE_PATH,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  analyticsCookieOptions,
  hasAnalyticsConsent,
} from "@/lib/news-analytics-cookies";

export async function POST(request: NextRequest) {
  const limit = await rateLimitShared(clientKey(request, "news-visitor"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfter) },
    );
  }

  // No consent, no counting and no cookie — just report the current total.
  if (!hasAnalyticsConsent(request)) {
    const count = await getNewsVisitorCount();
    const response = NextResponse.json({ count });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // The cookie is only a hint a client can drop. The count itself is claimed
  // once per hashed address in the shared store (clientKey never holds a raw
  // IP), so omitting the cookie or rotating it does not mint another visit.
  // If the store cannot answer, fall back to the cookie alone; the shared
  // limiter above still bounds the rate.
  let alreadyCounted = request.cookies.has(VISITOR_COOKIE);
  if (!alreadyCounted) {
    const claim = await claimOnce(clientKey(request, "news-visitor-seen"), VISITOR_COOKIE_MAX_AGE * 1000);
    alreadyCounted = claim === "duplicate";
  }
  const count = alreadyCounted ? await getNewsVisitorCount() : await incrementNewsVisitorCount();
  const response = NextResponse.json({ count });

  if (!alreadyCounted) {
    response.cookies.set(VISITOR_COOKIE, "1", {
      ...analyticsCookieOptions(),
      path: NEWS_COOKIE_PATH,
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
