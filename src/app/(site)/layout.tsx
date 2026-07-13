import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader world />
      <div className="site-world-frame">
        <main id="main" className="site-world-main">
          <div className="site-world-content">{children}</div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
