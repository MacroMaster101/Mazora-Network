import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Radio } from "lucide-react";
import type { Role } from "@/lib/types";
import { UserAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import { cn } from "@/lib/utils";

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
  username,
  displayName,
  avatarUrl,
  role,
  online,
  max,
  version,
  live,
}: {
  username?: string;
  displayName: string;
  /** The signed-in member's chosen avatar, when they have one. */
  avatarUrl?: string;
  role: Role;
  online: number;
  max: number;
  version: string;
  live: boolean;
}) {
  return (
    <header className="panel relative overflow-hidden p-6 sm:p-7 border-accent/30 bg-card/80 backdrop-blur-xl shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar username={username || displayName} avatarUrl={avatarUrl} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <RankChip role={role} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                On Duty
              </span>
            </div>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl text-ink">
              {displayName}
            </h1>
            <p className="mt-1 text-xs text-muted">
              Everything you can act on, in one place. Operations unlock with your staff rank.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-2xl border p-4 transition-all min-w-[200px]",
            live
              ? "border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/10",
          )}
        >
          {live ? (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Network Live
                </span>
                <Radio size={12} className="text-emerald-500" />
              </span>
              <p className="telemetry mt-2 text-2xl font-black text-ink">
                {online}
                <span className="text-xs font-semibold text-muted"> / {max} online</span>
              </p>
              <p className="text-[11px] font-medium text-muted mt-0.5">Minecraft Leaf {version}</p>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                Network Standby
              </span>
              <p className="mt-1 text-xs font-semibold text-amber-500">Status unavailable</p>
              <p className="text-[11px] text-muted">The server query did not answer.</p>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** A single telemetry figure. */
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
    <div
      className={cn(
        "panel p-4 transition-all hover:border-accent/40 hover:shadow-md",
        live && "border-emerald-500/20 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
        {live ? (
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500 shrink-0" />
        ) : tag ? (
          <span className="cr-tag text-[9px]">{tag}</span>
        ) : null}
      </div>
      <p className="telemetry mt-2 text-2xl font-black text-ink">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted font-medium truncate">{detail}</p>}
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
    <section className={cn("panel overflow-hidden p-0", className)}>
      <div className="flex items-center justify-between border-b border-line/60 px-5 py-4 bg-ink/5 dark:bg-surface/50">
        <h2 className="font-display text-sm font-bold text-ink flex items-center gap-2">
          <span className="text-accent-bright">{icon}</span>
          {title}
        </h2>
        <span className="flex items-center gap-2">
          {tag && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                tag === "Live"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-line bg-ink/5 text-muted",
              )}
            >
              {tag}
            </span>
          )}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent-bright hover:underline"
            >
              {linkLabel ?? "Open"} <ArrowUpRight size={13} />
            </Link>
          )}
        </span>
      </div>
      <div>{children}</div>
    </section>
  );
}

/** A queue component for quick staff actions. */
export function StandbyQueue({
  items,
  showDiagnostics = false,
}: {
  items: { label: string; href: string; icon: ReactNode }[];
  showDiagnostics?: boolean;
}) {
  return (
    <div className="grid gap-2.5 p-4 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-xl border border-line bg-card/50 p-3.5 transition-all hover:border-accent/40 hover:bg-accent/5 group"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-ink/5 text-accent-bright group-hover:scale-105 transition-transform">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-ink group-hover:text-accent-bright transition-colors">
              {item.label}
            </span>
            <span className="block text-[10px] text-muted font-medium">
              {showDiagnostics ? "Awaiting database" : "Coming soon"}
            </span>
          </span>
          <ArrowUpRight size={14} className="shrink-0 text-muted group-hover:text-accent-bright transition-colors" />
        </Link>
      ))}
    </div>
  );
}

/** Shown when a board's source isn't configured — never a fabricated zero. */
export function BoardNotice({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-xs font-medium text-muted">{children}</p>;
}

