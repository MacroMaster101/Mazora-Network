import Link from "next/link";
import {
  Activity, ArrowUpRight, Blocks, CalendarDays, Gamepad2, Home, ImageIcon,
  LifeBuoy, MessageCircleMore, MessagesSquare, Newspaper, Search, ScrollText,
  Sparkles, Trophy, UsersRound, Vote,
} from "lucide-react";
import type { PageContentDefinition } from "@/lib/page-content";

const icons = {
  home: Home,
  news: Newspaper,
  events: CalendarDays,
  "game-modes": Blocks,
  rules: ScrollText,
  gallery: ImageIcon,
  staff: UsersRound,
  vote: Vote,
  discord: MessageCircleMore,
  forums: MessagesSquare,
  players: Search,
  leaderboards: Trophy,
  status: Activity,
} as const;

/**
 * Editors that predate the page-copy hub and keep their own control-panel
 * sections. Exported so the hub can drop the ones the viewer has no permission
 * for — the routes themselves still enforce it, this only stops the hub from
 * advertising a door that will bounce them.
 */
export const EXISTING_PAGE_EDITORS = [
  {
    id: "play",
    label: "Play",
    eyebrow: "Existing page editor",
    description: "Edit connection steps, launcher patches, platform guidance, and play FAQs.",
    detail: "Connection details · patches · FAQs",
    href: "/admin/play",
    icon: Gamepad2,
  },
  {
    id: "support",
    label: "Support",
    eyebrow: "Existing page editor",
    description: "Edit the Support Center hero, help cards, guides, and common questions.",
    detail: "Hero · support paths · guides · FAQs",
    href: "/admin/support",
    icon: LifeBuoy,
  },
  {
    id: "suggestions",
    label: "Suggestions",
    eyebrow: "Existing page editor",
    description: "Edit the suggestion landing page, submission form, and community guidance.",
    detail: "Landing page · form · guidance",
    href: "/admin/suggestions",
    icon: Sparkles,
  },
] as const;

export type ExistingPageEditor = (typeof EXISTING_PAGE_EDITORS)[number];

export function PageDashboardCards({
  pages,
  existing,
}: {
  pages: PageContentDefinition[];
  existing: readonly ExistingPageEditor[];
}) {
  return (
    <div className="store-admin-hub-cards">
      {pages.map((page) => {
        const Icon = icons[page.id];
        return (
          <Link key={page.id} href={`/admin/pages/${page.id}`} className="store-admin-hub-card">
            <span className="store-admin-hub-card-icon"><Icon size={22} /></span>
            <span className="store-admin-hub-card-body">
              <em>{page.eyebrow}</em>
              <strong>{page.label} page</strong>
              <p>{page.description}</p>
              <small>{page.panels.length} content panels · {Object.keys(page.defaults).length} editable fields</small>
            </span>
            <span className="store-admin-hub-card-go">Open editor <ArrowUpRight size={15} /></span>
          </Link>
        );
      })}
      {existing.map((page) => {
        const Icon = page.icon;
        return (
          <Link key={page.id} href={page.href} className="store-admin-hub-card">
            <span className="store-admin-hub-card-icon"><Icon size={22} /></span>
            <span className="store-admin-hub-card-body">
              <em>{page.eyebrow}</em>
              <strong>{page.label} page</strong>
              <p>{page.description}</p>
              <small>{page.detail}</small>
            </span>
            <span className="store-admin-hub-card-go">Open editor <ArrowUpRight size={15} /></span>
          </Link>
        );
      })}
    </div>
  );
}
