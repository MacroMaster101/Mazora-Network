import Link from "next/link";
import type { Player } from "@/lib/types";
import { playtime, relative } from "@/lib/utils";
import { MinecraftAvatar } from "./minecraft-avatar";
import { RoleBadge } from "./role-badge";
import { cn } from "@/lib/utils";

export function PlayerCard({ player }: { player: Player }) {
  const online = player.status === "online";
  return (
    <Link
      href={`/players/${player.username}`}
      className="panel panel-hover group flex items-center gap-4 p-4"
    >
      <div className="relative">
        <MinecraftAvatar username={player.username} size={52} />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card",
            online ? "bg-success" : "bg-muted",
          )}
          title={online ? "Online" : "Offline"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold group-hover:text-accent-bright">{player.username}</span>
          <RoleBadge rank={player.rank} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted">
          <span className="telemetry">Lv {player.level}</span>
          <span>{playtime(player.playtimeHours)}</span>
          <span>{online ? "online now" : relative(player.lastSeen)}</span>
        </div>
      </div>
    </Link>
  );
}
