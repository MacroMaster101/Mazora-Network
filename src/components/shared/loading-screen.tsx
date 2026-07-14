import Image from "next/image";

export function LoadingScreen() {
  return (
    <section className="initial-loader" role="status" aria-live="polite" aria-label="Preparing Mazora Network">
      <Image src="/images/mazora-world-continuation.webp" alt="" fill priority sizes="100vw" className="initial-loader-backdrop" />
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
            <Image src="/images/mazora-logo.webp" alt="Mazora Network" width={270} height={180} className="initial-loader-logo" />
          </div>
        </div>
        <p className="initial-loader-eyebrow"><span /> Enter the network <span /></p>
        <h1>Preparing your adventure</h1>
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
