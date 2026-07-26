/**
 * Presentational kit for the staff control room at /admin.
 *
 * The room is one screen for every staff rank — boards appear as the viewer's
 * rank allows, rather than sending each role to its own page. Its signature is
 * that it never disguises where a number came from: live upstream/database
 * values are bracketed and pulse, demo-dataset values carry a DEMO tag, and
 * anything not yet wired to the database is a dashed STANDBY block instead of
 * a reassuring zero.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/** Role accent as an RGB triplet, matching the staff badge palette. */
export function roleAccent(role: Role): string {
  switch (role) {
    case "it":
      return "6 182 212";
    case "owner":
      return "var(--gold)";
    case "administrator":
      return "139 92 246";
    case "senior_moderator":
      return "245 158 11";
    case "moderator":
      return "244 63 94";
    default:
      return "16 185 129";
  }
}

/** Short relative time — "4m", "3h", "2d". */
export function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** The header: who is on duty, and whether the network is answering. */
export function WatchBar({
  displayName,
  role,
  online,
  max,
  version,
  live,
}: {
  displayName: string;
  role: Role;
  online: number;
  max: number;
  version: string;
  live: boolean;
}) {
  return (
    <header className="cr-watch flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-7 sm:py-6">
      <div className="min-w-0">
        <span className="cr-rolechip">On duty · {roleLabel(role)}</span>
        <h1 className="mt-3 truncate font-display text-2xl font-bold sm:text-[1.75rem]">{displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          Everything you can act on, in one place. Boards unlock with your rank.
        </p>
      </div>

      <div className={cn("shrink-0 rounded-xl border border-line bg-card/70 px-4 py-3", live && "cr-live")}>
        {live ? (
          <>
            <span className="flex items-center gap-2">
              <span className="cr-dot" aria-hidden="true" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">Network live</span>
            </span>
            <p className="telemetry mt-1.5 text-xl font-bold">
              {online}
              <span className="text-sm font-normal text-muted"> / {max} online</span>
            </p>
            <p className="text-xs text-muted">Minecraft {version}</p>
          </>
        ) : (
          <>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">Network</span>
            <p className="mt-1.5 text-sm font-semibold text-warning">Status unavailable</p>
            <p className="text-xs text-muted">The status service did not answer.</p>
          </>
        )}
      </div>
    </header>
  );
}

/** A single telemetry figure. `live` brackets it; `tag` labels its source. */
export function Metric({
  label,
  value,
  detail,
  live = false,
  tag,
}: {
  label: string;
  value: string;
  detail?: string;
  live?: boolean;
  tag?: string;
}) {
  return (
    <div className={cn("cr-metric", live && "cr-live")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
        {live ? <span className="cr-dot shrink-0" aria-label="live" /> : tag ? <span className="cr-tag">{tag}</span> : null}
      </div>
      <p className="cr-metric-value mt-2">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

/** A titled region of the room. */
export function Board({
  title,
  icon,
  href,
  linkLabel,
  tag,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  href?: string;
  linkLabel?: string;
  tag?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cr-board", className)}>
      <div className="cr-board-head">
        <h2 className="cr-board-title">
          {icon}
          {title}
        </h2>
        <span className="flex items-center gap-2">
          {tag && <span className="cr-tag">{tag}</span>}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-ink"
            >
              {linkLabel ?? "Open"} <ArrowUpRight size={13} />
            </Link>
          )}
        </span>
      </div>
      {children}
    </section>
  );
}

/**
 * A queue that has no database behind it yet. Deliberately not a "0" — it says
 * what is true: the page exists, the data pipe does not.
 */
export function StandbyQueue({ items }: { items: { label: string; href: string; icon: ReactNode }[] }) {
  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="cr-standby flex items-center gap-3 px-3.5 py-3 transition-colors">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-ink/5 text-muted">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="block text-[0.68rem] text-muted">Awaiting database</span>
          </span>
          <ArrowUpRight size={14} className="shrink-0 text-muted" />
        </Link>
      ))}
    </div>
  );
}

/** Shown when a board's source isn't configured — never a fabricated zero. */
export function BoardNotice({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
