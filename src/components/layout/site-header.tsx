import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { canManageGallery, canManageNews } from "@/lib/auth/permissions";
import { visibleAdminNav } from "@/lib/admin-nav";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { HeaderActions } from "./header-actions";
import { ScrollHeader } from "./scroll-header";
import { MobileMenu } from "./mobile-menu";
import { ThemeCycleButton } from "@/components/theme/theme-toggle";
import { CartTrigger } from "@/components/shared/cart-trigger";

export async function SiteHeader({ world = false, stable = false }: { world?: boolean; stable?: boolean }) {
  const [session, generalSettings] = await Promise.all([
    getSession(),
    getSiteGeneralSettings(),
  ]);
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
    <>
      {generalSettings.maintenanceMode && (
        <div className="relative z-50 w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-1.5 text-center text-xs font-semibold backdrop-blur-md flex items-center justify-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Network Maintenance Mode is active — Scheduled updates are currently underway.</span>
        </div>
      )}
      <ScrollHeader world={world} stable={stable}>
        <div className="header-shell shell flex h-[4.85rem] items-center justify-between gap-4">
          {/* Left: Single unified Brand Logo (responsive sizing via CSS) */}
          <div className="shrink-0 flex items-center">
            <Logo height={130} className="header-brand-logo animate-float" priority />
          </div>

          {/* Center: Desktop Navigation Links (hidden on mobile/tablet < 1100px) */}
          <div className="hidden min-w-0 flex-1 justify-center min-[1100px]:flex">
            <NavLinks />
          </div>

          {/* Right: Desktop Account & Utility Dock (hidden on mobile/tablet < 1100px) */}
          <div className="desktop-account-dock hidden shrink-0 items-center justify-end min-[1100px]:flex">
            <div className="flex items-center gap-1.5">
              <CartTrigger compact className="header-cart-trigger" />
              <ThemeCycleButton />
            </div>
            <span className="dock-divider" aria-hidden="true" />
            <HeaderActions session={session} />
          </div>

          {/* Right: Mobile Controls (hidden on desktop >= 1100px) */}
          <div className="flex items-center gap-2 shrink-0 min-[1100px]:hidden">
            <HeaderActions session={session} />
            <CartTrigger compact className="header-cart-trigger" />
            <MobileMenu session={session} adminNav={adminNav} />
          </div>
        </div>
      </ScrollHeader>
    </>
  );
}
