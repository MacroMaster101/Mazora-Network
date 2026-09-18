"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import type { OnlineStaffMember } from "@/lib/data/presence";
import { OnlineMemberRow } from "./online-member-row";
import { SeeMoreList } from "./see-more-list";

/**
 * Who on the team is around right now.
 *
 * "Online" means a staff member had the site open in the last few minutes — it
 * is evidence of activity, not a promise of availability, so the copy says
 * staff are online rather than that they are waiting to help. The dot shows
 * whether they are active, idle or do-not-disturb; invisible staff are absent.
 */
export function OnlineStaffPanel({ staff }: { staff: OnlineStaffMember[] }) {
  return (
    <OnlinePanel id="online-staff-heading" icon={<ShieldCheck size={16} aria-hidden="true" />} title="Online Staff" count={staff.length} noun="staff">
      {staff.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-6 text-muted">No staff are online right now.</p>
      ) : (
        <SeeMoreList {...ONLINE_LIST} noun={["staff member", "staff members"]}>
          {staff.map((member) => (
            <OnlineMemberRow key={member.userId} member={member} showRank />
          ))}
        </SeeMoreList>
      )}
    </OnlinePanel>
  );
}

/**
 * How both online panels list people: five rows, then "See more", which expands
 * into a scrolling list of fixed height rather than growing the sidebar.
 */
export const ONLINE_LIST = {
  as: "ul",
  className: "py-1.5",
  expandedClassName: "max-h-80 overflow-y-auto overscroll-contain",
  toggleClassName: "border-t border-line px-4 py-2.5",
  limit: 5,
} as const;

/** The frame both online panels share: heading, live count, body. */
export function OnlinePanel({
  id,
  icon,
  title,
  count,
  noun,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count: number;
  noun: string;
  children: ReactNode;
}) {
  return (
    <aside className="panel overflow-hidden" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={id} className="flex items-center gap-2 font-display text-sm font-extrabold text-accent-bright">
          {icon} {title}
        </h2>
        <span
          className={
            count > 0
              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"
              : "inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-muted"
          }
          aria-label={`${count} ${noun} online`}
        >
          {count > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />}
          {count}
        </span>
      </div>
      {children}
    </aside>
  );
}
