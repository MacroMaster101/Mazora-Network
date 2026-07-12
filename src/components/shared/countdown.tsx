"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(target: number) {
  const diff = Math.max(0, target - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

/** Live countdown to an ISO time. Compact by default; `big` for detail pages. */
export function Countdown({ to, className, big = false }: { to: string; className?: string; big?: boolean }) {
  const target = new Date(to).getTime();
  const [t, setT] = useState(() => parts(target));

  useEffect(() => {
    const id = setInterval(() => setT(parts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (t.done) {
    return <span className={cn("telemetry text-muted", className)}>Started</span>;
  }

  if (big) {
    const units: [number, string][] = [
      [t.d, "days"],
      [t.h, "hrs"],
      [t.m, "min"],
      [t.s, "sec"],
    ];
    return (
      <div className={cn("flex gap-2", className)}>
        {units.map(([val, label]) => (
          <div key={label} className="panel min-w-[3.75rem] px-3 py-2 text-center">
            <div className="telemetry text-2xl font-bold text-ink">{String(val).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className={cn("telemetry text-sm", className)}>
      {t.d > 0 && `${t.d}d `}
      {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}
    </span>
  );
}
