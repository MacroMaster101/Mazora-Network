"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Re-fetches the current route's server data without reloading the document.
 *
 * router.refresh() re-runs the server components for this route and swaps the
 * result in, so the page keeps its scroll position, any open modal, and
 * anything already typed into a form. A location.reload() would throw all three
 * away — and, since ScrollResetOnReload sends refreshed pages to the top, would
 * also move the reader. This is the same call the admin editors already make
 * after a successful save.
 *
 * useTransition is what makes the pending state truthful: router.refresh() is
 * not awaitable, so without a transition there is no way to know the refetch is
 * still in flight, and the button would report "done" the instant it was
 * clicked. isPending stays true until the new payload has rendered.
 */
export function RefreshButton({
  label = "Refresh",
  iconOnly = false,
}: {
  label?: string;
  /**
   * Drops the visible text and tightens the button to a square. For places that
   * already say what they refresh — a card header sitting next to its own
   * "Updated 08:03" timestamp — where the word would repeat what the row
   * already tells you. The accessible name is unaffected: it comes from
   * aria-label, which is present either way.
   */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      /*
        Disabled while in flight so a second click cannot queue another refetch
        behind the first — each one re-runs every query on the page.
      */
      disabled={isPending}
      className={iconOnly ? "refresh-button refresh-button-compact" : "refresh-button"}
      /*
        The visible text is hidden on narrow screens, so the accessible name has
        to come from somewhere that does not disappear with it.
      */
      aria-label={isPending ? `${label}ing` : label}
      title={label}
    >
      <RefreshCw size={15} className={isPending ? "refresh-button-spin" : undefined} aria-hidden="true" />
      {!iconOnly && <span className="refresh-button-label">{label}</span>}
      {/*
        Screen readers get no signal from a spinning icon, and the refreshed
        content replaces itself silently. This announces the outcome instead.
      */}
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? `${label}ing` : ""}
      </span>
    </button>
  );
}
