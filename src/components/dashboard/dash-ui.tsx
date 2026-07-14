import type { ReactNode } from "react";
import Link from "next/link";

export function DashHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="dash-header mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Clearly-labelled placeholder for a scaffolded (Phase-2) dashboard section. */
export function DashEmpty({
  icon,
  title,
  message,
  cta,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="glass flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-muted">{icon}</span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>
      {cta && (
        <Link href={cta.href} className="btn btn-ghost btn-sm mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="dashboard-stat-tile panel p-5">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="telemetry mt-1 text-2xl font-bold">{value}</div>
      {detail && <div className="text-xs text-muted">{detail}</div>}
    </div>
  );
}
