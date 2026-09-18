"use client";

import { RankChip } from "@/components/admin/rank-chip";
import { PresenceDot } from "@/components/presence/presence-dot";
import { UserAvatar } from "@/components/shared";
import type { OnlineMember } from "@/lib/data/presence";
import { PRESENCE_LABELS } from "@/lib/presence-rules";

const STATUS_TEXT: Record<OnlineMember["status"], string> = {
  online: "text-emerald-600 dark:text-emerald-400",
  idle: "text-amber-600 dark:text-amber-400",
  dnd: "text-red-600 dark:text-red-400",
};

/** One person in an online panel: avatar with status dot, name, rank and status. */
export function OnlineMemberRow({ member, showRank }: { member: OnlineMember; showRank: boolean }) {
  const name = member.displayName ?? member.username;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-ink/[0.03]">
      <span className="relative shrink-0">
        <UserAvatar username={member.username} avatarUrl={member.avatarUrl ?? undefined} size={36} rounded="rounded-xl" />
        <PresenceDot
          status={member.status}
          decorative
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 border-[2.5px] border-[rgb(var(--card))]"
        />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm leading-tight">{name}</strong>
        <span className={`mt-0.5 block text-[11px] font-semibold ${STATUS_TEXT[member.status]}`}>
          {PRESENCE_LABELS[member.status]}
        </span>
      </span>
      {showRank && <RankChip role={member.role} />}
    </li>
  );
}
