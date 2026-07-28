import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { ArticleArt } from "./article-art";
import { NewsAuthor } from "./news-author";

export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <Link href={`/news/${article.slug}`} className="news-public-card group flex flex-col overflow-hidden">
      <ArticleArt
        article={article}
        height="aspect-[16/10]"
        sizes="(max-width: 768px) 100vw, 33vw"
        hoverZoom
      />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="news-public-kicker">{article.category}</span>
          <span className="telemetry text-[11px] text-muted">{fmtDate(article.date)}</span>
        </div>
        <h3 className="mt-4 text-balance font-display text-xl font-bold leading-snug transition-colors group-hover:text-accent-bright">
          {article.title}
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{article.excerpt}</p>
        <div className="mt-5">
          <NewsAuthor article={article} compact />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line/80 pt-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <Clock3 size={13} /> {article.readMinutes} min read
          </span>
          <span className="flex items-center gap-1 font-semibold text-accent-bright">
            Read story <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
