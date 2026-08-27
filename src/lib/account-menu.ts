import { isStaff } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

/**
 * The signed-in account menu, shared by the desktop header dropdown and the
 * mobile navigation drawer.
 *
 * These two surfaces were maintained by hand and drifted: the drawer sent staff
 * to /admin from the card showing their personal identity, offered /admin twice,
 * and never offered /dashboard at all. Deriving both from one list is what stops
 * that happening again — a destination added here reaches every surface.
 *
 * Pure and free of server-only imports, so Client Components can call it.
 */

export type AccountMenuIcon = "control-room" | "dashboard" | "settings";

export interface AccountMenuEntry {
  label: string;
  href: string;
  /** Each surface draws its own icon; this only names which one. */
  icon: AccountMenuIcon;
}

/**
 * Entries for `role`, in display order. Staff (helper and above) additionally
 * get the Control Room; everything else is identical for every role, because
 * the personal account screens are not rank-gated.
 *
 * Notifications deliberately has no entry here: the header bell is present at
 * every breakpoint, including mobile, so listing it again would be a second
 * route to a control the user is already looking at.
 */
export function accountMenuFor(role: Role): AccountMenuEntry[] {
  return [
    ...(isStaff(role)
      ? [{ label: "Control Room", href: "/admin", icon: "control-room" as const }]
      : []),
    { label: "My Dashboard", href: "/dashboard", icon: "dashboard" },
    { label: "My Settings", href: "/dashboard/settings", icon: "settings" },
  ];
}
