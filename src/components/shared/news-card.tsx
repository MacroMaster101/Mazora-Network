import Link from "next/link";
import type { NewsArticle } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { CoverArt } from "./cover-art";
import { TonePill } from "@/components/ui";

export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <Link href={`/news/${article.slug}`} className="panel panel-hover group flex flex-col overflow-hidden">
      <CoverArt accent={article.accent} icon="Sparkles" height="h-36" />
      <div className="flex flex-1 flex-col p-5">
        <TonePill tone={article.accent} className="self-start">
          {article.category}
        </TonePill>
        <h3 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-accent-bright">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{article.excerpt}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>{article.author}</span>
          <span className="telemetry">
            {fmtDate(article.date)} · {article.readMinutes}m
          </span>
        </div>
      </div>
    </Link>
  );
}
