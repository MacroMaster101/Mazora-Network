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
 */
export function RouteLoading({ tone = "world" }: { tone?: "world" | "surface" }) {
  const pathname = usePathname();

  return (
    <div className="route-loading" data-tone={tone} role="status" aria-live="polite">
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
      <p className="route-loading-title" aria-hidden="true">{labelFor(pathname)}</p>
      <p className="route-loading-copy" aria-hidden="true">One moment…</p>
    </div>
  );
}
