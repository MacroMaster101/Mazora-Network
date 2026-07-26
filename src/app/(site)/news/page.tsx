import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { getNews } from "@/lib/data/content";
import { EmptyState, PageHero, Reveal } from "@/components/shared";
import { NewsExplorer } from "@/components/shared/news-explorer";

export const metadata: Metadata = {
  title: "News",
  description: "Server updates, patch notes, announcements and community stories from the network.",
};

export default async function NewsPage() {
  const articles = await getNews();
  return (
    <>
      <PageHero eyebrow="Newsroom" title="What's new on the network." lead="Updates, patch notes, announcements and the occasional deep dive." />
      <section className="section shell">
        <Reveal>
          {articles.length > 0 ? (
            <NewsExplorer articles={articles} />
          ) : (
            <EmptyState
              icon={<Newspaper size={24} />}
              title="No articles published yet"
              message="Server updates, patch notes and announcements will appear here as soon as the team publishes them."
              cta={{ label: "Join the Discord", href: "/discord" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
