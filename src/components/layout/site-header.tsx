import { getSession } from "@/lib/auth";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { HeaderActions } from "./header-actions";
import { ScrollHeader } from "./scroll-header";
import { MobileMenu } from "./mobile-menu";
import { LivePlayerCount } from "@/components/shared/live-player-count";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <ScrollHeader>
      <div className="header-shell shell flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-6">
          <Logo priority className="shrink-0" />
          <NavLinks />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <LivePlayerCount className="hidden sm:inline-flex" />
          <ThemeToggle className="hidden min-[1400px]:inline-flex" />
          <HeaderActions session={session} />
          <MobileMenu session={session} />
        </div>
      </div>
    </ScrollHeader>
  );
}
