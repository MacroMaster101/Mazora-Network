import Image from "next/image";
import { BookOpenText, Newspaper, Radio, Sparkles } from "lucide-react";
import { getNews } from "@/lib/data/content";
import { EmptyState, Reveal } from "@/components/shared";
import { NewsExplorer } from "@/components/shared/news-explorer";
import { NewsVisitorStat } from "@/components/shared/news-visitor-stat";
import { getPreviewNews } from "@/lib/news/preview-fixtures";
import { getNewsVisitorCount } from "@/lib/data/news-visitors";
import { publicPageMetadata } from "@/lib/seo";
import { getPageContent } from "@/lib/data/page-content";
// news-pages.css holds rules split out of globals.css and must load first, which
// is the order they cascaded in there. Do not reshuffle.
import "@/styles/news-pages.css";
import "@/styles/newsroom-redesign.css";
import "@/styles/newsroom-world.css";
import "@/styles/newsroom-world-finish.css";
import "@/styles/newsroom-vertical-world.css";
import "@/styles/newsroom-responsive.css";

export const metadata = publicPageMetadata({
  title: "News",
  description: "Server updates, patch notes, announcements and community stories from the network.",
  path: "/news",
});

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ previewNews?: string }>;
}) {
  const previewValue = (await searchParams).previewNews;
  const previewNews = process.env.NODE_ENV === "development" && previewValue === "15";
  const previewEmpty = process.env.NODE_ENV === "development" && previewValue === "0";
  const [articles, visitorCount, copy] = await Promise.all([
    previewEmpty ? Promise.resolve([]) : previewNews ? Promise.resolve(getPreviewNews()) : getNews(),
    getNewsVisitorCount(),
    getPageContent("news"),
  ]);

  return (
    <div className="newsroom-page">
      <section className="newsroom-hero">
        <div className="newsroom-hero-backdrop" aria-hidden="true" />
        <div className="shell newsroom-hero-shell">
          <div className="newsroom-live-pill"><Radio size={13} /> <span data-page-field="heroEyebrow">{copy.heroEyebrow}</span></div>

          <div className="newsroom-mast">
            <div className="newsroom-mast-stat newsroom-mast-stat-left">
              <span className="newsroom-stat-label">
                <BookOpenText size={16} aria-hidden="true" />
                <small>Stories shared</small>
              </span>
              <strong>{articles.length.toLocaleString()}</strong>
            </div>

            <div className="newsroom-mast-brand">
              <span className="newsroom-brand-aura" aria-hidden="true" />
              <Image
                src="/images/mazora-logo.webp"
                alt="Mazora Network"
                width={300}
                height={200}
                className="newsroom-mast-logo animate-float"
              />
            </div>

            <NewsVisitorStat initialCount={visitorCount} />
          </div>

          <div className="newsroom-hero-copy">
            <h1><span data-page-field="heroTitle">{copy.heroTitle}</span> <span data-page-field="heroAccent">{copy.heroAccent}</span></h1>
            <p data-page-field="heroLead">{copy.heroLead}</p>
            <div className="newsroom-hero-note">
              <Sparkles size={16} />
              <span><strong data-page-field="noteStrong">{copy.noteStrong}</strong> <span data-page-field="noteRest">{copy.noteRest}</span></span>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell newsroom-section">
        <Reveal>
          {articles.length > 0 ? (
            <NewsExplorer articles={articles} />
          ) : (
            <EmptyState
              className="news-empty-state"
              icon={<Newspaper size={24} />}
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/discord" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          )}
        </Reveal>
      </section>
    </div>
  );
}
