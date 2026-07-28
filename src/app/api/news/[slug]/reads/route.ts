import { NextRequest, NextResponse } from "next/server";
import {
  getNewsArticleReadCount,
  incrementNewsArticleReadCount,
} from "@/lib/data/news-visitors";
import { getArticle } from "@/lib/data/content";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readCookieName(slug: string): string {
  return `mazora_news_read_${slug}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (slug.length > 120 || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "Invalid article slug" }, { status: 400 });
  }

  const article = await getArticle(slug);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const cookieName = readCookieName(slug);
  const alreadyCounted = request.cookies.has(cookieName);
  const count = alreadyCounted
    ? await getNewsArticleReadCount(slug)
    : await incrementNewsArticleReadCount(slug);
  const response = NextResponse.json({ count });

  if (!alreadyCounted) {
    response.cookies.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
