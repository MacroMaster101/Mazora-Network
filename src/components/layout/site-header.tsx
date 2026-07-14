import { getSession } from "@/lib/auth";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { HeaderActions } from "./header-actions";
import { ScrollHeader } from "./scroll-header";
import { MobileMenu } from "./mobile-menu";
import { ThemeCycleButton } from "@/components/theme/theme-toggle";

export async function SiteHeader({ world = false }: { world?: boolean }) {
  const session = await getSession();
  return (
    <ScrollHeader world={world}>
      <div className="header-shell shell grid h-[4.75rem] grid-cols-[1fr_auto] items-center gap-3 min-[1200px]:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start min-[1200px]:hidden">
          <Logo height={84} className="mobile-header-logo" />
        </div>
        <div className="hidden justify-self-start min-[1200px]:block">
          <Logo height={96} className="header-brand-logo" />
        </div>
        <div className="hidden min-w-0 justify-self-center min-[1200px]:block">
          <NavLinks />
        </div>
        <div className="desktop-account-dock hidden shrink-0 items-center gap-1.5 justify-self-end min-[1200px]:flex">
          <ThemeCycleButton />
          <HeaderActions session={session} />
        </div>
        <div className="col-start-2 row-start-1 flex justify-self-end min-[1200px]:hidden">
          <MobileMenu session={session} />
        </div>
      </div>
    </ScrollHeader>
  );
}
