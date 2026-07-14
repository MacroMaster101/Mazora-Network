"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#08060e", color: "#f9f7fc", fontFamily: "system-ui, sans-serif" }}>
        <main className="global-error-shell">
          <style>{`
            .global-error-shell{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center;background:linear-gradient(rgba(6,3,12,.74),rgba(6,3,12,.94)),url('/images/mazora-community-hero.webp') center/cover}
            .global-error-card{width:min(540px,100%);padding:34px 28px;border:1px solid rgba(216,180,254,.22);border-radius:24px;background:rgba(12,8,21,.86);box-shadow:0 32px 90px rgba(0,0,0,.55);backdrop-filter:blur(18px)}
            .global-error-card img{width:180px;height:auto;object-fit:contain;filter:drop-shadow(0 8px 20px rgba(0,0,0,.5))}
            .global-error-code{margin:18px 0 0;color:#d8b4fe;font:700 11px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}
            .global-error-card h1{margin:12px 0 0;font-size:clamp(28px,7vw,42px);line-height:1.05}
            .global-error-card p:last-of-type{margin:14px auto 0;max-width:430px;color:#b2a8c2;line-height:1.65}
            .global-error-card button{margin-top:24px;min-height:48px;padding:0 22px;border:1px solid rgba(255,255,255,.24);border-radius:14px;background:linear-gradient(135deg,#9f67f7,#7c3aed);box-shadow:0 18px 36px -22px #8b5cf6;color:white;font-weight:750;cursor:pointer}
          `}</style>
          <section className="global-error-card">
            {/* A plain img keeps the last-resort boundary independent from Next image services. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/mazora-logo.webp" alt="Mazora Network" />
            <p className="global-error-code">Network fallback</p>
            <h1>The portal lost connection.</h1>
            <p>A critical chunk could not be generated. Your account and progress are safe; reconnect to Mazora to continue.</p>
            <button type="button" onClick={reset}>Reconnect to Mazora</button>
          </section>
        </main>
      </body>
    </html>
  );
}