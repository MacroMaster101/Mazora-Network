import { publicPageMetadata } from "@/lib/seo";
import { CalendarDays } from "lucide-react";
import { getEvents } from "@/lib/data/content";
import { EmptyState, FloatingBrandLogo, PageHero, Reveal } from "@/components/shared";
import { EventsExplorer } from "@/components/shared/events-explorer";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Events",
  description: "Tournaments, build competitions and community nights — upcoming, live and completed.",
  path: "/events",
});

// Event availability is live database state; do not block production builds
// while waiting for an external database during static generation.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, copy] = await Promise.all([getEvents(), getPageContent("events")]);
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
        <Reveal>
          {events.length > 0 ? (
            <EventsExplorer events={events} />
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/discord" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
