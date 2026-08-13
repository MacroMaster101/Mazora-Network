import { publicPageMetadata } from "@/lib/seo";
import { CalendarDays } from "lucide-react";
import { getEvents } from "@/lib/data/content";
import { EmptyState, PageHero, Reveal } from "@/components/shared";
import { EventsExplorer } from "@/components/shared/events-explorer";

export const metadata = publicPageMetadata({
  title: "Events",
  description: "Tournaments, build competitions and community nights — upcoming, live and completed.",
  path: "/events",
});

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <>
      <PageHero eyebrow="Competitions & community" title="There's always something happening." lead="Tournaments, build competitions, and spontaneous community nights. Show up and win something." />
      <section className="section shell">
        <Reveal>
          {events.length > 0 ? (
            <EventsExplorer events={events} />
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="No events scheduled"
              message="Tournaments, build competitions and community nights will be listed here once the team schedules them."
              cta={{ label: "Join the Discord", href: "/discord" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
