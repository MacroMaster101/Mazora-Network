"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/utils";

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
