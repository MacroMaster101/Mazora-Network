import { MessagesSquare } from "lucide-react";
import type { StaffMember } from "@/lib/types";
import { MinecraftAvatar } from "./minecraft-avatar";
import { cn } from "@/lib/utils";

export function StaffCard({ member }: { member: StaffMember }) {
  const online = member.status === "online";
  return (
    <div className="panel panel-hover p-5 text-center">
      <div className="relative mx-auto w-fit">
        <MinecraftAvatar username={member.username} size={72} rounded="rounded-xl" />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card",
            online ? "bg-success" : "bg-muted",
          )}
          title={online ? "Online" : "Offline"}
        />
      </div>
      <h3 className="mt-3 font-display font-bold">{member.username}</h3>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-bright">{member.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{member.bio}</p>
      {member.discord && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
          <MessagesSquare size={13} /> @{member.discord}
        </p>
      )}
    </div>
  );
}
