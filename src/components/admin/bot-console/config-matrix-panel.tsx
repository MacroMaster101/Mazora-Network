import { AlertTriangle, Check, Minus } from "lucide-react";
import type { BotVarReport } from "@/lib/data/bot-console";

const STATUS_META = {
  set: { icon: Check, label: "Set", tone: "text-emerald-400" },
  unset: { icon: Minus, label: "Not set", tone: "text-muted" },
  malformed: { icon: AlertTriangle, label: "Malformed", tone: "text-amber-400" },
} as const;

/**
 * Reports presence and shape only. Values never reach this component — see
 * readConfigMatrix, which maps each variable to a verdict server-side.
 */
export function ConfigMatrixPanel({ rows }: { rows: BotVarReport[] }) {
  const problems = rows.filter((row) => row.status !== "set");

  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Configuration</h2>
        <p className="text-xs text-muted">
          {problems.length === 0
            ? "Every Discord variable is configured."
            : `${problems.length} variable${problems.length === 1 ? " needs" : "s need"} attention.`}
        </p>
      </header>

      <ul className="grid gap-2">
        {rows.map((row) => {
          const meta = STATUS_META[row.status];
          const Icon = meta.icon;
          return (
            <li key={row.name} className="flex items-start gap-3 border-b border-white/5 pb-2 last:border-0">
              <Icon size={15} className={`mt-0.5 shrink-0 ${meta.tone}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {row.label} <span className="text-xs text-muted">· {meta.label}</span>
                </p>
                <p className="font-mono text-[11px] text-muted">{row.name}</p>
                {row.status !== "set" && <p className="mt-1 text-xs text-muted">{row.impact}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
