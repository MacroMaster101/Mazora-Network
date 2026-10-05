"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/ui/app-link";
import { MinecraftAvatar } from "@/components/shared/minecraft-avatar";
import type { EventRegistrant } from "@/lib/data/event-registrations";
import { cn } from "@/lib/utils";

/** Slots per page. 24 fills whole rows at 2, 3, 4, 6 and 8 columns. */
const PAGE_SIZE = 24;
/** Empty slots drawn after the players, as a hint of the room still left. */
const MAX_EMPTY = 8;

/**
 * Who registered, drawn as Minecraft inventory slots: a head and name in each
 * taken slot. Long lists page through 24 at a time, like flipping a chest
 * page, with arrow buttons and a swipe on touch screens.
 */
export function PlayerSlots({
  registrants,
  maxParticipants,
  viewerName,
  open,
  profilesOpen,
  title,
  emptyMessage,
}: {
  registrants: EventRegistrant[];
  maxParticipants: number;
  /** The viewer's linked Minecraft name, so their own slot can be marked. */
  viewerName: string | null;
  open: boolean;
  /** False while /players/<name> is launch-gated; slots are then not links. */
  profilesOpen: boolean;
  /** Heading and empty message from the Events page editor. */
  title: string;
  emptyMessage: string;
}) {
  const pages = Math.max(1, Math.ceil(registrants.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const touchX = useRef<number | null>(null);

  const current = Math.min(page, pages - 1);
  const first = current * PAGE_SIZE;
  const shown = registrants.slice(first, first + PAGE_SIZE);
  const spotsLeft = Math.max(0, maxParticipants - registrants.length);
  const onLastPage = current === pages - 1;
  const empty = open && onLastPage ? Math.min(MAX_EMPTY, PAGE_SIZE - shown.length, spotsLeft) : 0;
  const you = viewerName?.toLowerCase() ?? null;

  const go = (next: number) => setPage(Math.max(0, Math.min(pages - 1, next)));

  return (
    <section className="panel p-6" aria-labelledby="event-players">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="event-players" className="font-display text-xl font-bold">
          {title}
        </h2>
        <p className="text-sm text-muted">
          {registrants.length} of {maxParticipants} spots taken
        </p>
      </div>

      {registrants.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          {open ? emptyMessage : "No players registered for this event."}
        </p>
      )}

      {(shown.length > 0 || empty > 0) && (
        <ul
          className="event-slots mt-5"
          aria-label={pages > 1 ? `Players ${first + 1} to ${first + shown.length}` : undefined}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start === null || end === undefined || Math.abs(end - start) < 48) return;
            go(end < start ? current + 1 : current - 1);
          }}
        >
          {shown.map((player) => {
            const isYou = you !== null && player.username.toLowerCase() === you;
            const label = isYou ? `${player.username} (you)` : player.username;
            const body = (
              <>
                <MinecraftAvatar username={player.username} skinUrl={player.skinUrl} size={40} rounded="rounded-[4px]" />
                <span className="event-slot-name">{isYou ? "You" : player.username}</span>
              </>
            );
            return (
              <li key={player.username}>
                {profilesOpen ? (
                  <Link href={`/players/${encodeURIComponent(player.username)}`} className={cn("event-slot", isYou && "is-you")} title={label}>
                    {body}
                  </Link>
                ) : (
                  <span className={cn("event-slot", isYou && "is-you")} title={label}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`open-${i}`} aria-hidden>
              <span className="event-slot is-empty" />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Player pages">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="event-page-button"
            aria-label="Previous players"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-sm font-semibold text-ink" aria-live="polite">
              {first + 1}–{first + shown.length} of {registrants.length}
            </span>
            {pages <= 12 && (
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: pages }, (_, i) => (
                <span key={i} className={cn("event-page-dot", i === current && "is-current")} />
              ))}
            </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === pages - 1}
            className="event-page-button"
            aria-label="Next players"
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </section>
  );
}
