"use client";

import { useMemo, useState } from "react";
import type { NewsArticle } from "@/lib/types";
import { NewsCard } from "./news-card";
import { cn } from "@/lib/utils";

export function NewsExplorer({ articles }: { articles: NewsArticle[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(articles.map((a) => a.category)))], [articles]);
  const [active, setActive] = useState("All");

  const list = active === "All" ? articles : articles.filter((a) => a.category === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active === c ? "border-accent/50 bg-accent/10 text-accent-bright" : "border-line text-muted hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <NewsCard key={a.slug} article={a} />
        ))}
      </div>
    </div>
  );
}
