import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Server, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeCycleButton } from "@/components/theme/theme-toggle";
import { site } from "@/lib/site";

/**
 * Sign-in surfaces carry no content worth ranking and every one of them is a
 * near-duplicate of the others, so they are kept out of the index. This is a
 * crawling hint only — it is not, and must never be treated as, the access
 * control. That is enforced server-side in each route.
 *
 * Child pages that export their own `metadata` inherit this, because Next
 * merges layout metadata with page metadata rather than replacing it.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-world-panel">
        <div className="auth-world-grid" aria-hidden="true" />
        <div className="auth-world-content">
          <Logo priority height={104} className="auth-world-logo" />

          <div className="auth-world-message">
            <p className="auth-world-kicker"><span /> Mazora player network</p>
            <h2>One account.<br />Every world.</h2>
            <p>
              Keep your progress, community identity, event entries, and support history together wherever you play.
            </p>

            <div className="auth-world-features">
              <div><Gamepad2 size={18} /><span><strong>Java + Bedrock</strong>One connected profile</span></div>
              <div><ShieldCheck size={18} /><span><strong>Player-first</strong>Fair and secure by design</span></div>
              <div><Users size={18} /><span><strong>Community ready</strong>Forums, events, and teams</span></div>
            </div>
          </div>

          <div className="auth-world-status">
            <span className="auth-live-dot" />
            <span><strong>Network online</strong>{site.javaIp}</span>
            <Server size={17} />
          </div>
        </div>

      </aside>

      <main id="main" className="auth-main">
        <div className="auth-mobile-scene" aria-hidden="true" />
        <header className="auth-topbar">
          <Logo priority height={76} className="auth-mobile-logo" />
          <p className="auth-portal-label"><span /> Player portal</p>
          <div className="auth-topbar-actions">
            <ThemeCycleButton className="auth-theme-toggle" />
            <Link href="/" className="auth-home-link">
              <ArrowLeft size={15} /> <span>Back home</span>
            </Link>
          </div>
        </header>

        <div className="auth-content">{children}</div>

        <footer className="auth-footer">
          <span>© 2026 Mazora Network</span>
          <span aria-hidden="true">·</span>
          <Link href="/rules">Community rules</Link>
          <span aria-hidden="true">·</span>
          <Link href="/support">Need help?</Link>
        </footer>
      </main>
    </div>
  );
}
