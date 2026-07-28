"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

let visitorRequest: Promise<number | null> | null = null;
const articleReadRequests = new Map<string, Promise<number | null>>();

function recordVisit(): Promise<number | null> {
  visitorRequest ??= fetch("/api/news/visitors", { method: "POST" })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { count?: number };
      return typeof payload.count === "number" ? payload.count : null;
    })
    .catch(() => null);
  return visitorRequest;
}

function recordArticleRead(slug: string): Promise<number | null> {
  const existing = articleReadRequests.get(slug);
  if (existing) return existing;

  const request = fetch(`/api/news/${encodeURIComponent(slug)}/reads`, { method: "POST" })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { count?: number };
      return typeof payload.count === "number" ? payload.count : null;
    })
    .catch(() => null);
  articleReadRequests.set(slug, request);
  return request;
}

type NewsVisitorStatProps = {
  initialCount: number;
  articleSlug?: string;
};

export function NewsVisitorStat({ initialCount, articleSlug }: NewsVisitorStatProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    const request = articleSlug ? recordArticleRead(articleSlug) : recordVisit();
    request.then((nextCount) => {
      if (active && nextCount !== null) setCount(nextCount);
    });
    return () => {
      active = false;
    };
  }, [articleSlug]);

  return (
    <div className="newsroom-mast-stat newsroom-mast-stat-right">
      <span className="newsroom-stat-label">
        <UsersRound size={16} aria-hidden="true" />
        <small>{articleSlug ? "Article reads" : "Readers today"}</small>
      </span>
      <strong>{count.toLocaleString()}</strong>
    </div>
  );
}
