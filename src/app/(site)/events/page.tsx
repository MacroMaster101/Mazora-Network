import type { Metadata } from "next";
import { getEvents } from "@/lib/data/content";
import { PageHero, Reveal } from "@/components/shared";
import { EventsExplorer } from "@/components/shared/events-explorer";

export const metadata: Metadata = {
  title: "Events",
  description: "Tournaments, build competitions and community nights — upcoming, live and completed.",
};

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <>
      <PageHero eyebrow="Competitions & community" title="There's always something happening." lead="Tournaments, build competitions, and spontaneous community nights. Show up and win something." />
      <section className="section shell">
        <Reveal>
          <EventsExplorer events={events} />
        </Reveal>
      </section>
    </>
  );
}
