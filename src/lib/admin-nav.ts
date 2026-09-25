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
  Video,
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
  contentCreators: boolean;
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
  settings: boolean;
}

export const ALL_ADMIN_NAV_ACCESS: AdminNavAccess = {
  users: true,
  minecraft: true,
  suggestions: true,
  staff: true,
  forums: true,
  contentCreators: true,
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
  settings: true,
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
        { label: "Content Creators", href: "/admin/content-creators", icon: Video, minRole: "administrator", visible: access.contentCreators },
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
        { label: "Settings", href: "/admin/settings", icon: Settings, minRole: "owner", visible: access.settings },
        { label: "Audit Logs", href: "/admin/audit-logs", icon: UsersRound, minRole: "owner" },
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

/**
 * One line per board for the staff guide, keyed by href. Kept beside the nav
 * so a new board and its description land together — a test fails if one is
 * missing or left behind.
 */
export const ADMIN_BOARD_DESCRIPTIONS: Record<string, string> = {
  "/admin": "Network overview and your staff queues at a glance.",
  "/admin/users": "Find member accounts and manage their details.",
  "/admin/players": "Players online now, linked Minecraft accounts, stats and playtime.",
  "/admin/staff": "Everyone holding a staff rank, and their roles.",
  "/admin/roles": "Create, rename, recolour and reorder roles.",
  "/admin/forums": "Forum categories, ordering, locking and cleanup.",
  "/admin/content-creators": "Creator profiles, codes and the public creator directory.",
  "/admin/pages": "One place to open every public page editor.",
  "/admin/play": "Join steps, live stats sync and the Play page FAQ.",
  "/admin/news": "Write, review and publish network news.",
  "/admin/events": "Competitions, schedules, rewards and participant caps.",
  "/admin/game-modes": "Game modes shown on the site and in the store.",
  "/admin/rules": "Edit the public rulebook.",
  "/admin/gallery": "Community screenshots and the moderation queue.",
  "/admin/support": "Support centre cards and their detail pages.",
  "/admin/appeals": "Appeal and application forms: status, intake and links.",
  "/admin/suggestions": "Player ideas and reported content.",
  "/admin/store": "Store products, prices and the catalogue.",
  "/admin/orders": "Store requests, decisions and completed sales.",
  "/admin/voting": "Vote sites, rewards and cooldowns.",
  "/admin/mazora-bot": "Discord bot health, configuration and activity.",
  "/admin/notifications": "Compose and broadcast notifications to members.",
  "/admin/permissions": "Grant staff roles or individual people access to each board.",
  "/admin/settings": "Site identity, server addresses, socials and feature toggles.",
  "/admin/audit-logs": "A record of staff actions across the control room.",
};
