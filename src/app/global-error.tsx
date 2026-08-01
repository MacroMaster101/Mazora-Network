"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#08060e", color: "#f9f7fc", fontFamily: "system-ui, sans-serif" }}>
        <main className="global-error-shell">
          <style>{`
            *{box-sizing:border-box}.global-error-shell{min-height:100vh;display:grid;place-items:center;padding:clamp(16px,4vw,48px);background:linear-gradient(125deg,rgba(5,2,11,.82),rgba(7,3,14,.96)),url('/images/mazora-world-continuation.webp') center/cover fixed}.global-error-card{width:min(1120px,100%);min-height:min(640px,calc(100vh - 48px));display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.28fr);overflow:hidden;border:1px solid rgba(216,180,254,.24);border-radius:30px;background:linear-gradient(140deg,rgba(18,11,31,.95),rgba(7,4,14,.97));box-shadow:0 44px 130px -35px rgba(0,0,0,.95)}.global-error-brand{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(28px,5vw,52px);border-right:1px solid rgba(216,180,254,.14);background:radial-gradient(circle at 50% 25%,rgba(139,92,246,.22),transparent 60%)}.global-error-brand img{width:min(190px,72%);height:auto}.global-error-brand span{margin-top:auto;color:rgba(216,180,254,.68);font:800 10px ui-monospace,monospace;letter-spacing:.2em}.global-error-brand strong{font-size:clamp(120px,16vw,200px);line-height:.78;letter-spacing:-.08em;text-shadow:0 20px 70px rgba(139,92,246,.4)}.global-error-content{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:clamp(34px,7vw,88px)}.global-error-code{margin:0;color:#d8b4fe;font:800 11px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}.global-error-content h1{max-width:620px;margin:16px 0 0;font-size:clamp(38px,6vw,68px);line-height:.98;letter-spacing:-.055em}.global-error-content>p:last-of-type{max-width:580px;margin:20px 0 0;color:#bdb3cd;font-size:16px;line-height:1.75}.global-error-content button{margin-top:30px;min-height:50px;padding:0 24px;border:1px solid rgba(255,255,255,.24);border-radius:14px;background:linear-gradient(135deg,#9f67f7,#7c3aed);box-shadow:0 18px 36px -22px #8b5cf6;color:white;font-weight:800;cursor:pointer}@media(max-width:760px){.global-error-shell{padding:0}.global-error-card{width:100%;min-height:100vh;grid-template-columns:1fr;border:0;border-radius:0}.global-error-brand{min-height:180px;padding:22px;border-right:0;border-bottom:1px solid rgba(216,180,254,.14)}.global-error-brand img{width:110px}.global-error-brand span{display:none}.global-error-brand strong{position:absolute;right:24px;top:58px;font-size:110px}.global-error-content{padding:clamp(28px,8vw,54px)}}
          `}</style>
          <section className="global-error-card">
            <aside className="global-error-brand" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/mazora-logo.webp" alt="" />
              <span>MAZORA NETWORK</span>
              <strong>!</strong>
            </aside>
            <div className="global-error-content">
              <p className="global-error-code">Critical network fallback</p>
              <h1>The portal lost connection.</h1>
              <p>A critical site error stopped this page before the normal recovery tools could load. Your account and progress are safe.</p>
              <button type="button" onClick={reset}>Reconnect to Mazora</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}