"use client";

import { Users } from "lucide-react";
import type { OnlineMember } from "@/lib/data/presence";
import { OnlineMemberRow } from "./online-member-row";
import { SeeMoreList } from "./see-more-list";
import { ONLINE_LIST, OnlinePanel } from "./online-staff-panel";

/**
 * Community members who are around right now. Staff have their own panel, so
 * they are not repeated here, and members who chose Invisible never appear.
 * A rank badge shows only for supporter ranks — "Member" on every row is noise.
 */
export function WhosOnlinePanel({ members }: { members: OnlineMember[] }) {
  return (
    <OnlinePanel id="whos-online-heading" icon={<Users size={16} aria-hidden="true" />} title="Who's Online" count={members.length} noun="members">
      {members.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-6 text-muted">No members are online right now.</p>
      ) : (
        <SeeMoreList {...ONLINE_LIST} noun={["member", "members"]}>
          {members.map((member) => (
            <OnlineMemberRow key={member.userId} member={member} showRank={member.role !== "member"} />
          ))}
        </SeeMoreList>
      )}
    </OnlinePanel>
  );
}
