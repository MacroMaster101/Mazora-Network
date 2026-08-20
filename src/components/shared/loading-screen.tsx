export function LoadingScreen() {
  return (
    <section className="initial-loader" role="status" aria-live="polite" aria-label="Preparing Mazora Network">
      {/*
        The backdrop is a CSS background, not an <Image>, and that is a load-order
        decision rather than a styling one. As a `priority` <Image> it emitted a
        `<link rel=preload as=image imageSizes=100vw>` into <head> — and because
        this splash renders before the page content, that preload sat *ahead* of
        the hero image that actually sets LCP. On a throttled mobile connection
        the two competed for the same bandwidth and the splash won, which is what
        Lighthouse reported as "LCP request discovery".

        As a background it is discovered during CSS parse instead, at normal
        priority, and it resolves to the very same file .site-world-frame::before
        already paints on every route — so the whole page downloads this artwork
        once rather than twice.
      */}
      <div className="initial-loader-backdrop" aria-hidden="true" />
      <div className="initial-loader-shade" aria-hidden="true" />
      <div className="initial-loader-grid" aria-hidden="true" />
      <div className="initial-loader-glow" aria-hidden="true" />
      <div className="initial-loader-topline" aria-hidden="true">
        <span>MAZORA / GATEWAY</span>
        <span className="initial-loader-online"><i /> NETWORK ONLINE</span>
      </div>
      <div className="initial-loader-content">
        <div className="initial-loader-mark" aria-hidden="true">
          <i className="initial-loader-orbit initial-loader-orbit-outer" />
          <i className="initial-loader-orbit initial-loader-orbit-inner" />
          <div className="initial-loader-logo-wrap">
            {/* Keep this temporary splash asset low priority so it cannot
                compete with the page hero for LCP bandwidth. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mazora-logo.webp"
              alt="Mazora Network"
              width={270}
              height={180}
              loading="eager"
              fetchPriority="low"
              className="initial-loader-logo"
            />
          </div>
        </div>
        <p className="initial-loader-eyebrow"><span /> Enter the network <span /></p>
        {/*
          Deliberately not an <h1>. Transient loading text is not a page
          heading: an <h1> here would sit ahead of the real one in the initial
          markup and become the primary heading crawlers and screen readers saw.
          The wrapper is already role="status" with an aria-label, which is the
          correct semantic for this.

          This splash used to appear twice in the initial HTML — once here via
          InitialSiteLoader's overlay and once as the root loading.tsx fallback.
          The root loading.tsx has been removed, so this is now the only copy.
        */}
        <p className="initial-loader-title">Preparing your adventure</p>
        <p className="initial-loader-copy">Syncing worlds, players, and the latest from Mazora.</p>
        <div className="initial-loader-progress" aria-hidden="true">
          <div className="initial-loader-progress-line"><i /></div>
          <div className="initial-loader-progress-meta">
            <span>LOADING WORLD</span>
            <span className="initial-loader-progress-pulse"><i /><i /><i /></span>
          </div>
        </div>
      </div>
      <div className="initial-loader-footer" aria-hidden="true">
        <span>JAVA + BEDROCK</span>
        <span className="initial-loader-footer-rule" />
        <span>MC.MAZORA.US</span>
      </div>
    </section>
  );
}
