"use client";

import { useState } from "react";
import Link from "@/components/ui/app-link";
import { CalendarDays, Gamepad2, Gift, Users } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { Countdown } from "@/components/shared/countdown";
import { EventCard } from "@/components/shared/event-card";
import { cn } from "@/lib/utils";
import { EventCoverMedia } from "./event-cover-media";
import { LocalTime } from "./local-time";
import { EVENT_STATUS_LABEL } from "./status";

type Filter = "all" | "live" | "upcoming";

/** Board copy from the Events page editor (/admin/pages/events). */
export interface EventBoardCopy {
  currentTitle: string;
  pastTitle: string;
  noCurrentMessage: string;
  noLiveMessage: string;
  noUpcomingMessage: string;
  leadCta: string;
  liveCta: string;
  pastMoreCta: string;
}

/** The card button labels, which the homepage shares. */
export type EventCardCopy = Pick<EventBoardCopy, "leadCta" | "liveCta">;

/** Past events shown before "Show more". Three rows of the three-column grid. */
const PAST_STEP = 9;

/**
 * /events: live and upcoming events laid out like the newsroom (one large lead
 * card, then two-up rows) with a filter, and finished events in a grid below.
 * Every card is one link to the event page.
 */
export function EventsBoard({ events, copy }: { events: EventItem[]; copy: EventBoardCopy }) {
  // Live first, then soonest to start. Events arrive sorted by start already.
  const current = [
    ...events.filter((e) => e.status === "live"),
    ...events.filter((e) => e.status === "upcoming"),
  ];
  const past = events.filter((e) => e.status === "completed").reverse();
  const counts = {
    all: current.length,
    live: current.filter((e) => e.status === "live").length,
    upcoming: current.filter((e) => e.status === "upcoming").length,
  };

  const [filter, setFilter] = useState<Filter>("all");
  const [pastShown, setPastShown] = useState(PAST_STEP);
  const shown = filter === "all" ? current : current.filter((e) => e.status === filter);
  const [lead, ...rest] = shown;

  return (
    <div className="space-y-16">
      <section aria-labelledby="events-current" className="space-y-6">
        <div className="event-board-head">
          <h2 id="events-current" className="font-display text-2xl font-bold sm:text-3xl" data-page-field="currentTitle">
            {copy.currentTitle}
          </h2>
          {counts.all > 0 && (
            <div className="event-filter-card" role="group" aria-label="Show events">
              {(["all", "live", "upcoming"] as const).map((key) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {key === "all" ? "All" : key === "live" ? "Live" : "Upcoming"}
                  <span className="event-filter-count">{counts[key]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!lead ? (
          <p
            className="panel px-6 py-12 text-center text-sm text-muted"
            data-page-field={counts.all === 0 ? "noCurrentMessage" : filter === "live" ? "noLiveMessage" : "noUpcomingMessage"}
          >
            {counts.all === 0 ? copy.noCurrentMessage : filter === "live" ? copy.noLiveMessage : copy.noUpcomingMessage}
          </p>
        ) : (
          <>
            <LeadEvent event={lead} copy={copy} />
            {rest.length > 0 && (
              <div className="grid gap-5 lg:grid-cols-2">
                {rest.map((event) => (
                  <RowEvent key={event.id} event={event} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="events-past" className="space-y-6">
          <h2 id="events-past" className="font-display text-2xl font-bold sm:text-3xl" data-page-field="pastTitle">
            {copy.pastTitle}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {past.slice(0, pastShown).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {past.length > pastShown && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setPastShown((n) => n + PAST_STEP)} className="btn btn-secondary">
                <span data-page-field="pastMoreCta">{copy.pastMoreCta}</span> ({past.length - pastShown} left)
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ event }: { event: EventItem }) {
  return (
    <span className="event-cover-tag event-art-badge" data-tone={event.status}>
      {event.status === "live" && <span className="event-cover-live-dot" />}
      {EVENT_STATUS_LABEL[event.status]}
    </span>
  );
}

function Capacity({ event }: { event: EventItem }) {
  const full = event.joined >= event.maxParticipants;
  const fill = event.maxParticipants > 0 ? Math.min(100, (event.joined / event.maxParticipants) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Users size={14} className="text-muted" /> {event.joined}/{event.maxParticipants}
        </span>
        {/* The card already shows when it starts, so a countdown here only
            repeated the date; the live countdown is on the event page. */}
        <span className={cn("text-sm", full ? "font-semibold text-gold" : "text-muted")}>
          {full ? "Full" : `${event.maxParticipants - event.joined} ${event.maxParticipants - event.joined === 1 ? "spot" : "spots"} left`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className={cn("h-full rounded-full", full ? "bg-gold" : "bg-accent")} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

export function LeadEvent({ event, copy }: { event: EventItem; copy: EventCardCopy }) {
  return (
    <Link href={`/events/${event.slug}`} className="panel event-lead-card group">
      <div className="event-lead-art">
        <EventCoverMedia imageUrl={event.imageUrl} sizes="(min-width: 900px) 55vw, 100vw" priority scrim={false} />
        <StatusBadge event={event} />
        {/* The details side gives the date; the art side counts down to it. */}
        {event.status === "upcoming" && (
          <div className="event-art-countdown">
            <span className="event-art-countdown-label">Starts in</span>
            <Countdown to={event.startISO} big boxClassName="event-art-countdown-box" />
          </div>
        )}
      </div>
      <div className="event-lead-copy">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <Gamepad2 size={13} /> {event.mode}
          </span>
        </div>
        <h3 className="event-lead-title">{event.title}</h3>
        {event.description && <p className="line-clamp-3 text-base leading-relaxed text-muted">{event.description}</p>}
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center gap-2.5">
            <dt className="sr-only">Starts</dt>
            <CalendarDays size={16} className="shrink-0 text-accent-bright" />
            <dd className="font-semibold text-ink">
              <LocalTime iso={event.startISO} />
            </dd>
          </div>
          {event.rewards[0] && (
            <div className="flex items-center gap-2.5">
              <dt className="sr-only">Reward</dt>
              <Gift size={16} className="shrink-0 text-gold" />
              <dd className="text-ink">{event.rewards[0]}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto space-y-4 border-t border-line pt-5">
          <Capacity event={event} />
          <span className="event-card-cta" data-page-field={event.status === "live" ? "liveCta" : "leadCta"}>
            {event.status === "live" ? copy.liveCta : copy.leadCta}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function RowEvent({ event }: { event: EventItem }) {
  return (
    <Link href={`/events/${event.slug}`} className="panel event-row-card group">
      <div className="event-row-art">
        <EventCoverMedia imageUrl={event.imageUrl} sizes="(min-width: 1024px) 22vw, (min-width: 520px) 40vw, 100vw" scrim={false} />
        <StatusBadge event={event} />
        {event.status === "upcoming" && (
          <span className="event-art-timer">
            Starts in <Countdown to={event.startISO} />
          </span>
        )}
      </div>
      <div className="event-row-copy">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <LocalTime iso={event.startISO} withTime={false} />
          <span className="chip">{event.mode}</span>
        </div>
        <h3 className="event-row-title">{event.title}</h3>
        {event.description && <p className="line-clamp-2 text-sm text-muted">{event.description}</p>}
        <div className="mt-auto border-t border-line pt-4">
          <Capacity event={event} />
        </div>
      </div>
    </Link>
  );
}
