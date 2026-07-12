"use client";

import { useEffect, useState } from "react";
import type { ServerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact live status pill for the header. Polls /api/status server-side cache. */
export function LivePlayerCount({ className }: { className?: string }) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as ServerStatus;
        if (alive) {
          setStatus(data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    }
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const online = status?.live && status.online;

  return (
    <div
      className={cn(
        "telemetry inline-flex items-center gap-2 rounded-lg border border-line-strong bg-ink/5 px-3 py-1.5 text-xs",
        className,
      )}
      title={online ? "Server online" : "Live status unavailable"}
    >
      <span className={cn("dot", online ? "animate-pulse" : "dot-off")} />
      {failed || !status ? (
        <span className="text-muted">status…</span>
      ) : online ? (
        <span>
          <span className="text-ink">{status.players}</span>
          <span className="text-muted">/{status.max}</span>
        </span>
      ) : (
        <span className="text-muted">offline</span>
      )}
    </div>
  );
}
