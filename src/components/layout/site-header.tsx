import { getSession } from "@/lib/auth";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { HeaderActions } from "./header-actions";
import { ScrollHeader } from "./scroll-header";
import { BottomNav } from "./bottom-nav";
import { LivePlayerCount } from "@/components/shared/live-player-count";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <>
      <ScrollHeader>
        <div className="shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Logo priority />
            <NavLinks />
          </div>
          <div className="flex items-center gap-2.5">
            <LivePlayerCount />
            <ThemeToggle className="hidden xl:inline-flex" />
            <HeaderActions session={session} />
          </div>
        </div>
      </ScrollHeader>
      <BottomNav session={session} />
    </>
  );
}
