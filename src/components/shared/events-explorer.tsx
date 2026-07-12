"use client";

import type { EventItem } from "@/lib/types";
import { Tabs } from "@/components/ui";
import { EventCard } from "./event-card";

export function EventsExplorer({ events }: { events: EventItem[] }) {
  const groups = {
    upcoming: events.filter((e) => e.status === "upcoming"),
    live: events.filter((e) => e.status === "live"),
    completed: events.filter((e) => e.status === "completed"),
  };

  const tabs = [
    { key: "upcoming", label: `Upcoming (${groups.upcoming.length})` },
    { key: "live", label: `Live (${groups.live.length})` },
    { key: "completed", label: `Completed (${groups.completed.length})` },
  ];

  return (
    <Tabs tabs={tabs} initial={groups.live.length ? "live" : "upcoming"}>
      {(active) => {
        const list = groups[active as keyof typeof groups];
        if (list.length === 0) {
          return <p className="glass px-6 py-12 text-center text-sm text-muted">No {active} events right now. Check back soon.</p>;
        }
        return (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => (
              <EventCard key={e.slug} event={e} />
            ))}
          </div>
        );
      }}
    </Tabs>
  );
}
