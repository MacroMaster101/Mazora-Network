import type { Metadata } from "next";
import { getNews } from "@/lib/data/content";
import { PageHero, Reveal } from "@/components/shared";
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
          <NewsExplorer articles={articles} />
        </Reveal>
      </section>
    </>
  );
}
