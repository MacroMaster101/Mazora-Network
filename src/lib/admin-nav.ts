import {
  Bell,
  BellRing,
  Blocks,
  Bug,
  CalendarDays,
  FileText,
  Gamepad2,
  Gauge,
  Gavel,
  Image,
  KeyRound,
  Lightbulb,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  UserCog,
  Users,
  UsersRound,
  Vote,
  Receipt,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { hasAtLeast } from "@/lib/auth/roles";

/**
 * The staff navigation, defined once so the desktop sidebar and the mobile
 * drawer can never drift apart.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  icon: typeof Users;
  minRole: Role;
  /** Exact-path matching, for parents whose children have their own entries. */
  exact?: boolean;
  /** Overrides minRole when defined — used where access is configurable. */
  visible?: boolean;
}

export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

export function buildAdminNav({
  canManageNews,
  canManageGallery,
}: {
  canManageNews: boolean;
  canManageGallery?: boolean;
}): AdminNavGroup[] {
  return [
    {
      heading: "Overview",
      items: [{ label: "Control room", href: "/admin", icon: Gauge, minRole: "helper", exact: true }],
    },
    {
      heading: "Community",
      items: [
        { label: "Users", href: "/admin/users", icon: Users, minRole: "owner" },
        { label: "Minecraft Players", href: "/admin/players", icon: Blocks, minRole: "moderator" },
        { label: "Staff", href: "/admin/staff", icon: ShieldCheck, minRole: "owner" },
      ],
    },
    {
      heading: "Content",
      items: [
        { label: "Play", href: "/admin/play", icon: Gamepad2, minRole: "administrator" },
        { label: "News", href: "/admin/news", icon: FileText, minRole: "administrator", visible: canManageNews },
        { label: "Events", href: "/admin/events", icon: CalendarDays, minRole: "administrator" },
        { label: "Game Modes", href: "/admin/game-modes", icon: Blocks, minRole: "administrator" },
        { label: "Rules", href: "/admin/rules", icon: ScrollText, minRole: "administrator" },
        { label: "Gallery", href: "/admin/gallery", icon: Image, minRole: "administrator", visible: canManageGallery },
      ],
    },
    {
      heading: "Support",
      items: [
        { label: "Tickets", href: "/admin/tickets", icon: Ticket, minRole: "helper" },
        { label: "Appeals", href: "/admin/appeals", icon: Gavel, minRole: "helper" },
        { label: "Reports", href: "/admin/reports", icon: ShieldAlert, minRole: "helper" },
        { label: "Bug Reports", href: "/admin/bugs", icon: Bug, minRole: "helper" },
        { label: "Suggestions", href: "/admin/suggestions", icon: Lightbulb, minRole: "helper" },
      ],
    },
    {
      heading: "Commerce",
      items: [
        { label: "Store", href: "/admin/store", icon: ShoppingBag, minRole: "administrator" },
        { label: "Orders", href: "/admin/orders", icon: Receipt, minRole: "administrator" },
        { label: "Voting", href: "/admin/voting", icon: Vote, minRole: "administrator" },
      ],
    },
    {
      heading: "System",
      items: [
        { label: "Notifications", href: "/admin/notifications", icon: Bell, minRole: "owner" },
        { label: "Permissions", href: "/admin/permissions", icon: KeyRound, minRole: "owner" },
        { label: "Settings", href: "/admin/settings", icon: Settings, minRole: "it" },
        { label: "Audit Logs", href: "/admin/audit-logs", icon: UsersRound, minRole: "it" },
      ],
    },
    {
      // The staffer's OWN account — distinct from the community-wide tools above.
      heading: "My Account",
      items: [
        { label: "My Settings", href: "/admin/account", icon: UserCog, minRole: "helper", exact: true },
        { label: "My Notifications", href: "/admin/account/notifications", icon: BellRing, minRole: "helper" },
        { label: "My Purchases", href: "/admin/account/purchases", icon: Receipt, minRole: "helper" },
      ],
    },
  ];
}

/** Groups the given role may actually see, with empty groups dropped. */
export function visibleAdminNav(
  role: Role,
  options: { canManageNews: boolean; canManageGallery?: boolean },
): AdminNavGroup[] {
  return buildAdminNav(options)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible ?? hasAtLeast(role, item.minRole)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isAdminNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact || item.href === "/admin") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
