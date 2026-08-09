"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade-and-rise on scroll into view.
 *
 * Deliberately not framer-motion. Reveal wraps most sections on most pages, so
 * importing `motion` here pulled the whole animation runtime — 40 KB gzipped —
 * into the bundle every route loads, to drive one opacity/transform transition
 * that CSS does natively. An IntersectionObserver plus a data attribute is the
 * entire mechanism.
 *
 * Reduced-motion users get the fade without the rise, which is the behaviour
 * `<MotionConfig reducedMotion="user">` used to provide. That now lives with
 * the transition itself, in the [data-reveal] rules in globals.css.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Seconds, matching the old framer-motion `transition.delay` signature. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    // Nothing to observe with means the content must simply be visible; never
    // leave it stranded at opacity 0.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // Mirrors the old viewport={{ once: true, margin: "-80px" }}: fire once,
      // slightly before the element reaches the edge of the viewport.
      { rootMargin: "-80px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      data-reveal={shown ? "in" : "out"}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
