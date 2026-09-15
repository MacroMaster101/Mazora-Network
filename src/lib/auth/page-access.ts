import "server-only";

import { redirect } from "next/navigation";
import { getSession, getSessionUserId, type Session } from "@/lib/auth";
import { isStaff } from "@/lib/auth/roles";
import { canAccessModule } from "@/lib/auth/module-access-shared";
import { getAllModulePermissions, isItOnlyModule, PAGES_PERMISSION_KEY } from "@/lib/auth/permissions";
import { PAGE_CONTENT_DEFINITIONS, type PageContentDefinition } from "@/lib/page-content";

/**
 * Permission view for the page hub.
 *
 * Two gates, deliberately. `pages.permissions` decides who may open the hub at
 * all, and each editable page then carries the permission key of the module
 * that owns it — so holding the hub grant never yields edit access to copy the
 * viewer could not already edit. Someone granted the hub and nothing else gets
 * an empty hub, which is the honest answer rather than a silent redirect.
 *
 * Resolving that needs one answer per key, which is why this reads the whole
 * permission snapshot once rather than calling `canManageModule` fourteen
 * times — the same round-trip problem the admin navigation already solved.
 */
export interface PageHubAccess {
  session: Session;
  /** Only the pages this viewer may actually open an editor for. */
  pages: PageContentDefinition[];
  canManage(permissionKey: string): boolean;
}

export async function getPageHubAccess(
  session: Session | null,
  userId?: string | null,
): Promise<Omit<PageHubAccess, "session">> {
  if (!session) return { pages: [], canManage: () => false };

  const permissions = await getAllModulePermissions();
  const canManage = (permissionKey: string) => {
    const permission = permissions[permissionKey];
    if (!permission) return false;
    return canAccessModule(session.role, {
      itOnly: isItOnlyModule(permissionKey),
      configuredRoles: permission.roles,
      configuredUserIds: permission.userIds,
      userId,
    });
  };

  return {
    pages: Object.values(PAGE_CONTENT_DEFINITIONS).filter((page) => canManage(page.permissionKey)),
    canManage,
  };
}

/**
 * Gate the hub on its own module, and return only the pages the viewer may
 * actually open. Mirrors `requireModuleAccess`: staff without the grant land on
 * the no-access notice, everyone else is bounced off the control panel.
 */
export async function requirePageHubAccess(path: string): Promise<PageHubAccess> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  const access = await getPageHubAccess(session, userId);

  if (session && access.canManage(PAGES_PERMISSION_KEY)) return { session, ...access };

  if (session && isStaff(session.role)) {
    const params = new URLSearchParams({ from: path });
    redirect(`/admin/no-access?${params}`);
  }

  redirect("/");
}

/**
 * Both grants, for one page editor.
 *
 * The hub grant is what decides who works on public page copy at all; the
 * page's own module decides which pages. Checking only the latter here would
 * make the hub grant cosmetic — revoking it would hide the link while
 * `/admin/pages/news` stayed open to anyone holding News. Checking only the
 * former would let a hub grant unlock copy its holder cannot otherwise edit.
 * So: both, on the route and again in the action that writes.
 */
export async function canEditPageContent(
  permissionKey: string,
  session: Session | null,
  userId?: string | null,
): Promise<boolean> {
  if (!session) return false;
  const { canManage } = await getPageHubAccess(session, userId);
  return canManage(PAGES_PERMISSION_KEY) && canManage(permissionKey);
}

export async function requirePageEditorAccess(permissionKey: string, path: string): Promise<Session> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;

  if (session && (await canEditPageContent(permissionKey, session, userId))) return session;

  if (session && isStaff(session.role)) {
    const params = new URLSearchParams({ from: path });
    redirect(`/admin/no-access?${params}`);
  }

  redirect("/");
}
