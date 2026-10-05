import Link from "@/components/ui/app-link";
import { Gift, Users } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { EVENT_STATUS_LABEL } from "@/components/events/status";
import { fmtDate } from "@/lib/utils";
import { EventArt } from "./event-art";
import { cn } from "@/lib/utils";

const statusTone: Record<EventItem["status"], string> = {
  live: "border-danger/50 text-danger",
  upcoming: "border-accent/50 text-accent-bright",
  completed: "border-line-strong text-muted",
  cancelled: "border-line-strong text-muted",
};

export function EventCard({ event }: { event: EventItem }) {
  const fill = event.maxParticipants > 0 ? Math.min(100, (event.joined / event.maxParticipants) * 100) : 0;
  const full = event.joined >= event.maxParticipants;
  return (
    <Link href={`/events/${event.slug}`} className="panel panel-hover group flex flex-col overflow-hidden">
      <div className="relative">
        <EventArt event={event} height="h-40" sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw" />
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-card/90 px-2.5 py-1 text-xs font-semibold",
            statusTone[event.status],
          )}
        >
          {event.status === "live" && <span className="dot animate-pulse" />}
          {EVENT_STATUS_LABEL[event.status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{fmtDate(event.startISO)}</span>
          <span className="chip">{event.mode}</span>
        </div>
        <h3 className="mt-2 font-display text-lg font-bold group-hover:text-accent-bright">{event.title}</h3>
        {event.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{event.description}</p>}
        {event.rewards[0] && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-gold">
            <Gift size={15} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{event.rewards[0]}</span>
          </p>
        )}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Users size={14} /> {event.joined}/{event.maxParticipants}
              {full && event.status === "upcoming" && <span className="font-semibold text-gold">Full</span>}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className={cn("h-full rounded-full", full ? "bg-gold" : "bg-accent")} style={{ width: `${fill}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
