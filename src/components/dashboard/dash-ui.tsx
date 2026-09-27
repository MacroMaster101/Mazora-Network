import type { ReactNode } from "react";
import { RefreshButton } from "@/components/shared/refresh-button";
import Link from "@/components/ui/app-link";

/**
 * Page header for every admin and dashboard screen.
 *
 * The refresh control lives here rather than in the `action` slot: thirteen
 * pages already pass their own actions (back links, "Public store", and so on),
 * and putting refresh in that slot would have silently replaced them. Rendering
 * both inside one right-aligned row gives every page refresh for free while
 * leaving its own buttons intact.
 */
export function DashHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  /*
    Laid out by .dash-header-layout (globals.css): on phones the refresh icon
    sits in the top-right corner beside the title and the page's own actions
    take the full width below; from 768px everything shares one row. It used
    to be one wrapping flex row, so on phones refresh fell onto a line of its
    own under full-width actions.
  */
  return (
    <div className={`dash-header-layout panel p-6 sm:p-7 mb-6 border-line-strong bg-card/90 dark:bg-card/80 backdrop-blur-xl shadow-lg ${action ? "has-actions" : ""}`}>
      <div className="dash-header-title min-w-0">
        <h1 className="font-display text-2xl font-bold sm:text-3xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-muted font-medium">{subtitle}</p>}
      </div>
      {action && <div className="dash-header-actions">{action}</div>}
      <div className="dash-header-refresh">
        <RefreshButton iconOnly />
      </div>
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
    <div className="dash-empty-state panel border-line-strong bg-card/90 dark:bg-card/80 backdrop-blur-xl shadow-lg flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl border border-line-strong bg-ink/5 text-muted">{icon}</span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>
      {cta && (
        <Link href={cta.href} className="btn btn-primary btn-sm mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** Long values (a 12-16 character Minecraft name) step the size down so they
 *  stay on one line instead of splitting mid-word; wrapping is the fallback. */
function statValueSize(value: string): string {
  if (value.length >= 12) return "text-base sm:text-xl";
  if (value.length >= 9) return "text-lg sm:text-2xl";
  return "text-2xl";
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="dashboard-stat-tile panel p-5">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className={`telemetry mt-1 font-bold [overflow-wrap:anywhere] ${statValueSize(value)}`} title={value}>{value}</div>
      {detail && <div className="text-xs text-muted">{detail}</div>}
    </div>
  );
}
