import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { canManageGallery, canManageNews } from "@/lib/auth/permissions";
import { visibleAdminNav } from "@/lib/admin-nav";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { HeaderActions } from "./header-actions";
import { ScrollHeader } from "./scroll-header";
import { MobileMenu } from "./mobile-menu";
import { ThemeCycleButton } from "@/components/theme/theme-toggle";
import { CartTrigger } from "@/components/shared/cart-trigger";

export async function SiteHeader({ world = false, stable = false }: { world?: boolean; stable?: boolean }) {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;

  // Staff get their admin sections inside the drawer, so small screens have one
  // menu instead of a site menu plus a scrolling strip of admin links.
  const adminNav =
    session && isStaff(session.role)
      ? visibleAdminNav(session.role, {
          canManageNews: await canManageNews(session, userId),
          canManageGallery: await canManageGallery(session, userId),
        }).map((group) => ({
          heading: group.heading,
          items: group.items.map((item) => ({ label: item.label, href: item.href, exact: item.exact ?? false })),
        }))
      : null;

  return (
    <ScrollHeader world={world} stable={stable}>
      <div className="header-shell shell grid h-[4.75rem] grid-cols-[1fr_auto] items-center gap-3 min-[1200px]:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start min-[1200px]:hidden">
          <Logo height={84} className="mobile-header-logo" priority />
        </div>
        <div className="hidden justify-self-start min-[1200px]:block">
          <Logo height={96} className="header-brand-logo" priority />
        </div>
        <div className="hidden min-w-0 justify-self-center min-[1200px]:block">
          <NavLinks />
        </div>
        <div className="desktop-account-dock hidden shrink-0 items-center justify-self-end min-[1200px]:flex">
          <div className="flex items-center gap-1.5">
            <CartTrigger compact className="header-cart-trigger" />
            <ThemeCycleButton />
          </div>
          <span className="dock-divider" aria-hidden="true" />
          <HeaderActions session={session} />
        </div>
        <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end min-[1200px]:hidden">
          <HeaderActions session={session} />
          <CartTrigger compact className="header-cart-trigger" />
          <MobileMenu session={session} adminNav={adminNav} />
        </div>
      </div>
    </ScrollHeader>
  );
}
