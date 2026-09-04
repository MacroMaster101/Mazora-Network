"use client";

import { useEffect, useState } from "react";
import { holdMsAt, nextPresenceIndex, shouldRotate } from "@/lib/presence-rotation";

export interface PresenceRow {
  id: string;
  /** Discord's activity verb: Playing, Watching, Listening, Competing. */
  verb: string;
  text: string;
  /** How long this status stays on screen, matching the worker's own hold. */
  holdMs: number;
}

/**
 * Mirror what the bot is showing in Discord, one status at a time.
 *
 * The point of this card is that it is not a list. Discord only ever displays
 * one activity, and each status now holds for its own duration, so a static
 * list of three lines showed neither what a member sees nor how long they see
 * it. This runs the same per-status schedule the worker runs, which is why the
 * two stay in step.
 */
export function PresenceRotator({ rows, fallbackHoldMs }: { rows: PresenceRow[]; fallbackHoldMs: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const rotating = shouldRotate(rows.length);
  // Repairs an index left over from a longer list, e.g. after a status stops
  // resolving, without waiting for the next tick to come round.
  const safeIndex = rows.length > 0 ? index % rows.length : 0;
  const holdMs = holdMsAt(
    rows.map((row) => row.holdMs),
    safeIndex,
    fallbackHoldMs,
  );

  useEffect(() => {
    if (!rotating || paused) return;
    // A timeout rather than an interval: the delay changes with each status,
    // so the next tick has to be scheduled from the row currently showing.
    const timer = setTimeout(() => {
      setIndex((current) => nextPresenceIndex(current, rows.length));
    }, holdMs);
    return () => clearTimeout(timer);
  }, [rotating, paused, holdMs, rows.length, safeIndex]);

  if (rows.length === 0) return null;
  const row = rows[safeIndex];

  return (
    <div
      className="presence-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{row.verb}</p>
      {/* aria-live so the rotation is announced rather than silently swapping
          under a screen reader that has already read the previous line. */}
      <p className="mt-1 font-mono text-sm text-ink" aria-live="polite">
        {row.text}
      </p>

      {rotating && (
        <div className="mt-3 flex items-center gap-3">
          {/* Keyed on the index so the animation restarts cleanly each cycle
              rather than continuing from wherever the previous one ended. */}
          <span className="presence-progress" aria-hidden>
            <span
              key={`${safeIndex}-${paused}`}
              className="presence-progress-fill"
              style={{ animationDuration: `${holdMs}ms`, animationPlayState: paused ? "paused" : "running" }}
            />
          </span>
          <span className="flex shrink-0 gap-1.5">
            {rows.map((candidate, position) => (
              <button
                key={candidate.id}
                type="button"
                aria-label={`Show ${candidate.verb} ${candidate.text}`}
                aria-current={position === safeIndex}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  position === safeIndex ? "bg-accent" : "bg-ink/25 hover:bg-ink/50"
                }`}
                onClick={() => setIndex(position)}
              />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
