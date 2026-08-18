/**
 * Canonical right-side PageHero brand mark. Keep every public hero in sync.
 *
 * This is the LCP element on every interior page that renders a PageHero.
 * It uses `unoptimized` because the source is a local webp file that's already
 * optimised — skipping the Next.js image optimizer avoids the dev-mode LCP
 * PerformanceObserver false-positive that fires when hydration completes after
 * the browser's LCP measurement window closes. The image still loads eagerly
 * via `priority` (which sets fetchpriority="high" on the `<img>`) but doesn't
 * emit a `<link rel="preload">` for the optimizer URL.
 */
export function FloatingBrandLogo() {
  return (
    <div className="group relative p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/mazora-logo.webp"
        alt="Mazora Network Logo"
        width={310}
        height={207}
        fetchPriority="high"
        decoding="async"
        className="relative h-auto w-[min(68vw,310px)] animate-float object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105 md:w-[310px]"
      />
    </div>
  );
}
