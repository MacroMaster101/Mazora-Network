import { Circle, Users } from "lucide-react";
import type { ServerStatus } from "@/lib/types";
import { MinecraftAvatar } from "./minecraft-avatar";

/**
 * Who is on the server right now, taken from the server-list ping sample that
 * `getServerStatus` already fetches — no plugin and no database rows involved.
 *
 * The sample is capped server-side by `sample-count` in spigot.yml (12 by
 * default), so it is routinely shorter than the online count. The header shows
 * the authoritative count and a "+N more" chip covers the difference, rather
 * than letting the visible names imply the whole population.
 */
export function OnlinePlayers({ status }: { status: ServerStatus }) {
  const sample = status.playerList;
  const hidden = Math.max(0, status.players - sample.length);

  return (
    <div className="panel rounded-2xl border border-line/60 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Online now</h2>
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Circle
            size={8}
            aria-hidden
            className={status.online ? "fill-emerald-400 text-emerald-400" : "fill-muted text-muted"}
          />
          {status.online ? `${status.players} / ${status.max} playing` : "Server offline"}
        </span>
      </div>

      {!status.online ? (
        <p className="mt-4 text-sm text-muted">
          The server isn&apos;t responding right now. Player names return as soon as it&apos;s back up.
        </p>
      ) : sample.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {status.players > 0
            ? "The server is hiding its player list, so names can't be shown."
            : "Nobody is online at the moment. Be the first one in."}
        </p>
      ) : (
        <ul className="mt-5 flex flex-wrap gap-2">
          {sample.map((player) => (
            <li
              key={player.uuid}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface/40 py-1.5 pl-1.5 pr-3"
            >
              <MinecraftAvatar username={player.name} size={24} rounded="rounded-md" />
              <span className="text-sm font-medium text-ink">{player.name}</span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="inline-flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted">
              <Users size={14} aria-hidden />
              +{hidden} more
            </li>
          )}
        </ul>
      )}

      {status.stale && (
        <p className="mt-4 text-xs text-muted">Showing the last successful reading while the status provider recovers.</p>
      )}
    </div>
  );
}
