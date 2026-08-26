import Image from "next/image";
import { BookOpenText, Newspaper, Radio, Sparkles } from "lucide-react";
import { getNews } from "@/lib/data/content";
import { EmptyState, Reveal } from "@/components/shared";
import { NewsExplorer } from "@/components/shared/news-explorer";
import { NewsVisitorStat } from "@/components/shared/news-visitor-stat";
import { getPreviewNews } from "@/lib/news/preview-fixtures";
import { getNewsVisitorCount } from "@/lib/data/news-visitors";
import { publicPageMetadata } from "@/lib/seo";
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
  const [articles, visitorCount] = await Promise.all([
    previewEmpty ? Promise.resolve([]) : previewNews ? Promise.resolve(getPreviewNews()) : getNews(),
    getNewsVisitorCount(),
  ]);

  return (
    <div className="newsroom-page">
      <section className="newsroom-hero">
        <div className="newsroom-hero-backdrop" aria-hidden="true" />
        <div className="shell newsroom-hero-shell">
          <div className="newsroom-live-pill"><Radio size={13} /> Latest from Mazora</div>

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
            <h1>Stories from <span>across the network.</span></h1>
            <p>
              Discover new releases, server changes, upcoming events and the moments shaping the Mazora community.
            </p>
            <div className="newsroom-hero-note">
              <Sparkles size={16} />
              <span><strong>Made for our community</strong> and updated by the Mazora team.</span>
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
              title="No articles published yet"
              message="Server updates, patch notes and announcements will appear here as soon as the team publishes them."
              cta={{ label: "Join the Discord", href: "/discord" }}
            />
          )}
        </Reveal>
      </section>
    </div>
  );
}
