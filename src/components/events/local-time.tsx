"use client";

import { useEffect, useState } from "react";
import { fmtDate, relative } from "@/lib/utils";

/**
 * An event time in the viewer's own time zone ("Sat 10 Oct, 5:30 AM GMT+5:30").
 * The server cannot know that zone, so the first render shows the UTC date and
 * the local text replaces it after hydration (no mismatch warning).
 */
export function LocalTime({ iso, withTime = true, className }: { iso: string; withTime?: boolean; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    setText(
      date.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : { year: "numeric" }),
      }),
    );
  }, [iso, withTime]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? fmtDate(iso)}
    </time>
  );
}

/**
 * A date ("Oct 26, 2026") in the viewer's own time zone. Same approach as
 * LocalTime: the server renders the UTC date, the browser swaps in its own.
 */
export function LocalDate({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) setText(date.toLocaleDateString("en", DAY));
  }, [iso]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? fmtDate(iso)}
    </time>
  );
}

const DAY = { month: "short", day: "numeric", year: "numeric" } as const;

function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en", DAY);
}

/**
 * "5m ago", or after 30 days a date, in the viewer's zone. The server's render
 * is a moment older than the browser's, so the text is swapped in after
 * hydration; hovering shows the full local date and time.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [view, setView] = useState<{ text: string; title: string } | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    setView({ text: relative(iso, localDay), title: date.toLocaleString("en", { ...DAY, hour: "numeric", minute: "2-digit", timeZoneName: "short" }) });
  }, [iso]);

  return (
    <time dateTime={iso} className={className} title={view?.title} suppressHydrationWarning>
      {view?.text ?? relative(iso)}
    </time>
  );
}

const CLOCK = { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const;

/** A time of day ("2:21 PM GMT+5:30") in the viewer's zone; UTC, labelled, until hydrated. */
export function LocalClock({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) setText(date.toLocaleTimeString("en", CLOCK));
  }, [iso]);

  const date = new Date(iso);
  const utc = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en", { ...CLOCK, timeZone: "UTC" });
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? utc}
    </time>
  );
}
