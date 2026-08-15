"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/** "/game-modes" -> "Loading game modes", "/" -> "Loading home". */
function labelFor(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  return `Loading ${segment ? segment.replace(/-/g, " ") : "home"}`;
}

/**
 * Route-level fallback shown while a page's server content streams in.
 *
 * A centred logo rather than a skeleton: a skeleton imitates a layout it cannot
 * know, and against this site's detailed world artwork flat panels read as grey
 * clutter. The 250ms appearance delay lives in CSS, so quick navigations never
 * flash it and the loading layer never depends on hydration to look right.
 *
 * `tone="world"` suits the dark artwork behind the public site, dashboard and
 * admin (shared by both themes). `tone="surface"` is for the auth form column,
 * which is a real theme surface and turns light.
 *
 * `forPath` overrides the label's source. A `loading.tsx` fallback renders
 * *after* the router has committed the new URL, so `usePathname()` is already
 * the destination and the default is right. NavigationLoader renders this
 * during the transition instead, while `usePathname()` still reports the page
 * being left — it passes the destination explicitly so the label does not read
 * "Loading store" on the way *out* of the store.
 */
export function RouteLoading({
  tone = "world",
  forPath,
  instant = false,
}: {
  tone?: "world" | "surface";
  forPath?: string;
  instant?: boolean;
}) {
  const pathname = usePathname();
  const target = forPath ?? pathname;

  return (
    // Next's scroll manager inspects the first element in a loading boundary.
    // Keeping this wrapper in normal flow lets it focus/scroll normally while
    // the inner world-tone screen remains a fixed full-viewport overlay.
    <div className="route-loading-boundary">
      <div
        className="route-loading"
        data-tone={tone}
        /*
          As a loading.tsx fallback this mounts the instant a navigation starts, so
          the 250ms CSS appearance delay is what stops quick hops from flashing it.
          NavigationLoader instead waits out its own slow-navigation threshold
          before mounting, so by the time this renders the delay has already been
          served — paying it twice would push the logo past a second.
        */
        data-instant={instant ? "true" : undefined}
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading page…</span>
        <div className="route-loading-ring" aria-hidden="true">
          <Image
            src="/images/mazora-logo.webp"
            alt=""
            width={216}
            height={144}
            priority
            className="route-loading-logo"
          />
        </div>
        <p className="route-loading-title" aria-hidden="true">{labelFor(target)}</p>
        <p className="route-loading-copy" aria-hidden="true">One moment…</p>
      </div>
    </div>
  );
}
