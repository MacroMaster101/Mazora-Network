import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GameMode } from "@/lib/types";
import { CoverArt } from "./cover-art";
import { accentStyles } from "./accent";

export function GameModeCard({ mode }: { mode: GameMode }) {
  return (
    <Link href={`/game-modes/${mode.slug}`} className="panel panel-hover group block overflow-hidden">
      <CoverArt accent={mode.accent} icon={mode.icon} label={mode.version} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">{mode.name}</h3>
          <span className={`hud telemetry rounded-md px-2 py-1 text-xs ${mode.storeStatus === "live" ? accentStyles[mode.accent].text : "text-muted"}`}>
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${mode.storeStatus === "live" ? "bg-emerald-400" : "bg-muted"}`} />
            {mode.storeStatus === "live" ? "Live" : "Soon"}
          </span>
        </div>
        <p className="mt-1 text-sm text-accent-bright/80">{mode.tagline}</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{mode.description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          Learn more
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
