import {
  Bell,
  Blocks,
  Bot,
  CalendarDays,
  FileText,
  Gamepad2,
  Gauge,
  Gavel,
  Image,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Users,
  UsersRound,
  Vote,
  Receipt,
  PanelsTopLeft,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { hasAtLeast, isStaff } from "@/lib/auth/roles";

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

/** Permission results calculated server-side for the signed-in staff member. */
export interface AdminNavAccess {
  users: boolean;
  minecraft: boolean;
  suggestions: boolean;
  staff: boolean;
  forums: boolean;
  /** The page-content hub; each editor inside it still checks its own module. */
  pages: boolean;
  play: boolean;
  news: boolean;
  events: boolean;
  gameModes: boolean;
  rules: boolean;
  gallery: boolean;
  support: boolean;
  appeals: boolean;
  store: boolean;
  orders: boolean;
  voting: boolean;
  notifications: boolean;
  bot: boolean;
}

export const ALL_ADMIN_NAV_ACCESS: AdminNavAccess = {
  users: true,
  minecraft: true,
  suggestions: true,
  staff: true,
  forums: true,
  pages: true,
  play: true,
  news: true,
  events: true,
  gameModes: true,
  rules: true,
  gallery: true,
  support: true,
  appeals: true,
  store: true,
  orders: true,
  voting: true,
  notifications: true,
  bot: true,
};

export function buildAdminNav(access: AdminNavAccess): AdminNavGroup[] {
  return [
    {
      heading: "Overview",
      items: [{ label: "Control room", href: "/admin", icon: Gauge, minRole: "helper", exact: true }],
    },
    {
      heading: "Community",
      items: [
        { label: "Users", href: "/admin/users", icon: Users, minRole: "owner", visible: access.users },
        { label: "Minecraft Players", href: "/admin/players", icon: Blocks, minRole: "moderator", visible: access.minecraft },
        { label: "Staff", href: "/admin/staff", icon: ShieldCheck, minRole: "owner", visible: access.staff },
        { label: "Roles", href: "/admin/roles", icon: Tags, minRole: "owner" },
        { label: "Forums", href: "/admin/forums", icon: MessagesSquare, minRole: "administrator", visible: access.forums },
      ],
    },
    {
      heading: "Content",
      items: [
        { label: "Pages", href: "/admin/pages", icon: PanelsTopLeft, minRole: "administrator", visible: access.pages },
        { label: "Play", href: "/admin/play", icon: Gamepad2, minRole: "administrator", visible: access.play },
        { label: "News", href: "/admin/news", icon: FileText, minRole: "administrator", visible: access.news },
        { label: "Events", href: "/admin/events", icon: CalendarDays, minRole: "administrator", visible: access.events },
        { label: "Game Modes", href: "/admin/game-modes", icon: Blocks, minRole: "administrator", visible: access.gameModes },
        { label: "Rules", href: "/admin/rules", icon: ScrollText, minRole: "administrator", visible: access.rules },
        { label: "Gallery", href: "/admin/gallery", icon: Image, minRole: "administrator", visible: access.gallery },
      ],
    },
    {
      heading: "Support",
      items: [
        { label: "Support Pages", href: "/admin/support", icon: LifeBuoy, minRole: "administrator", visible: access.support },
        { label: "Application Forms", href: "/admin/appeals", icon: Gavel, minRole: "administrator", visible: access.appeals },
        { label: "Suggestions", href: "/admin/suggestions", icon: Lightbulb, minRole: "moderator", visible: access.suggestions },
      ],
    },
    {
      heading: "Commerce",
      items: [
        { label: "Store", href: "/admin/store", icon: ShoppingBag, minRole: "administrator", visible: access.store },
        { label: "Orders", href: "/admin/orders", icon: Receipt, minRole: "administrator", visible: access.orders },
        { label: "Voting", href: "/admin/voting", icon: Vote, minRole: "administrator", visible: access.voting },
      ],
    },
    {
      heading: "System",
      items: [
        { label: "Mazora Bot", href: "/admin/mazora-bot", icon: Bot, minRole: "owner", visible: access.bot },
        { label: "Notifications", href: "/admin/notifications", icon: Bell, minRole: "owner", visible: access.notifications },
        { label: "Permissions", href: "/admin/permissions", icon: KeyRound, minRole: "owner" },
        { label: "Settings", href: "/admin/settings", icon: Settings, minRole: "web_dev" },
        { label: "Audit Logs", href: "/admin/audit-logs", icon: UsersRound, minRole: "web_dev" },
      ],
    },
  ];
}

/**
 * `minRole: "helper"` means "any staff": a custom staff role may sit below
 * Helper on the ladder and is still staff. Every other minRole is a real rank gate.
 */
function meetsMinRole(role: Role, minRole: Role): boolean {
  return minRole === "helper" ? isStaff(role) : hasAtLeast(role, minRole);
}

/** Groups the given role may actually see, with empty groups dropped. */
export function visibleAdminNav(
  role: Role,
  access: AdminNavAccess,
): AdminNavGroup[] {
  return buildAdminNav(access)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible ?? meetsMinRole(role, item.minRole)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isAdminNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact || item.href === "/admin") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
