import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RouteContentTransition } from "@/components/shared/route-content-transition";
import "@/styles/home.generated.css";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader world />
      <div className="site-world-frame">
        <main id="main" className="site-world-main">
          <div className="site-world-content">
            <RouteContentTransition>{children}</RouteContentTransition>
          </div>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
