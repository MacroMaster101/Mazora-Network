import { Star, Hash, Sparkles, User, Calendar } from "lucide-react";
import type { PatchUpdate } from "@/lib/types";

export function DiscordPatchList({ patches }: { patches: PatchUpdate[] }) {
  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong/40 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
            <Sparkles size={20} />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              Server Patch Updates
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent-bright">
                <Hash size={12} /> PATCH-UPDATE
              </span>
            </h3>
            <p className="text-xs text-muted">Latest server changes and feature updates directly from Discord.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {patches.map((patch) => {
          const dateStr = new Date(patch.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return (
            <div
              key={patch.id}
              className="group relative rounded-2xl border border-line-strong/50 bg-ink/5 p-5 transition-all duration-200 hover:border-accent/50 hover:bg-ink/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-amber-400 fill-amber-400/20" />
                  <h4 className="font-display text-lg font-bold text-ink">{patch.version}</h4>
                  <span className="rounded-lg bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent-bright">
                    {patch.targetMode}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <User size={13} className="text-accent-bright" /> {patch.author} ({patch.authorRole || "Owner"})
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} /> {dateStr}
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 pl-1">
                {patch.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
