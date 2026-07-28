import { NextRequest, NextResponse } from "next/server";
import { getNewsVisitorCount, incrementNewsVisitorCount } from "@/lib/data/news-visitors";

const VISITOR_COOKIE = "mazora_news_visitor";

export async function POST(request: NextRequest) {
  const alreadyCounted = request.cookies.has(VISITOR_COOKIE);
  const count = alreadyCounted ? await getNewsVisitorCount() : await incrementNewsVisitorCount();
  const response = NextResponse.json({ count });

  if (!alreadyCounted) {
    response.cookies.set(VISITOR_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
