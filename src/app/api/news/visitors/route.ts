import { NextRequest, NextResponse } from "next/server";
import { getNewsVisitorCount, incrementNewsVisitorCount } from "@/lib/data/news-visitors";
import { clientKey, rateLimit, retryAfterHeaders } from "@/lib/rate-limit";
import {
  NEWS_COOKIE_PATH,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  analyticsCookieOptions,
  hasAnalyticsConsent,
} from "@/lib/news-analytics-cookies";

export async function POST(request: NextRequest) {
  const limit = rateLimit(clientKey(request, "news-visitor"), { limit: 30, windowMs: 60_000 });
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

  const alreadyCounted = request.cookies.has(VISITOR_COOKIE);
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
