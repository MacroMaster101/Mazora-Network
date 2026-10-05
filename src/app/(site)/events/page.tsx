import { publicPageMetadata } from "@/lib/seo";
import { CalendarDays } from "lucide-react";
import { getEvents } from "@/lib/data/content";
import { EmptyState, FloatingBrandLogo, PageHero, Reveal } from "@/components/shared";
import { EventsBoard } from "@/components/events/events-board";
import { getPageContent } from "@/lib/data/page-content";
import "@/styles/events.css";

export const metadata = publicPageMetadata({
  title: "Events",
  description: "Tournaments, build competitions and community nights — upcoming, live and completed.",
  path: "/events",
});

// Event availability is live database state; do not block production builds
// while waiting for an external database during static generation.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [allEvents, copy] = await Promise.all([getEvents(), getPageContent("events")]);
  // Cancelled events stay reachable by link but are not listed.
  const events = allEvents.filter((e) => e.status !== "cancelled");

  return (
    <>
      <PageHero
        eyebrow={copy.heroEyebrow}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ eyebrow: "heroEyebrow", title: "heroTitle", lead: "heroLead" }}
        illustration={<FloatingBrandLogo />}
      />
      <section className="section shell">
        {events.length === 0 ? (
          <Reveal>
            <EmptyState
              icon={<CalendarDays size={24} />}
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/discord" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          </Reveal>
        ) : (
          <EventsBoard
            events={events}
            copy={{
              currentTitle: copy.currentTitle,
              pastTitle: copy.pastTitle,
              noCurrentMessage: copy.noCurrentMessage,
              noLiveMessage: copy.noLiveMessage,
              noUpcomingMessage: copy.noUpcomingMessage,
              leadCta: copy.leadCta,
              liveCta: copy.liveCta,
              pastMoreCta: copy.pastMoreCta,
            }}
          />
        )}
      </section>
    </>
  );
}
