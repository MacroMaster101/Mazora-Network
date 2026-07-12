import Link from "next/link";
import { Gift, Users } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { CoverArt } from "./cover-art";
import { Countdown } from "./countdown";
import { cn } from "@/lib/utils";

const statusTone: Record<EventItem["status"], string> = {
  live: "border-danger/50 text-danger bg-danger/10",
  upcoming: "border-accent/50 text-accent-bright bg-accent/10",
  completed: "border-line-strong text-muted bg-ink/5",
};

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Link href={`/events/${event.slug}`} className="panel panel-hover group flex flex-col overflow-hidden">
      <div className="relative">
        <CoverArt accent={event.accent} icon={event.icon} height="h-36" />
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase",
            statusTone[event.status],
          )}
        >
          {event.status === "live" && <span className="dot animate-pulse" />}
          {event.status}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="telemetry">{fmtDate(event.startISO)}</span>
          <span className="chip">{event.mode}</span>
        </div>
        <h3 className="mt-2 font-display text-lg font-bold group-hover:text-accent-bright">{event.title}</h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted">{event.description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-gold">
            <Gift size={15} /> {event.prize}
          </span>
          {event.status === "upcoming" ? (
            <Countdown to={event.startISO} />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Users size={14} /> {event.joined}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
