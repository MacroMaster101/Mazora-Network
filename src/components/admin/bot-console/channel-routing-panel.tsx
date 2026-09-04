import { Hash, Radio, TriangleAlert } from "lucide-react";
import type { ChannelRoute } from "@/lib/data/bot-console";

type RoutesResult = { ok: true; routes: ChannelRoute[] } | { ok: false; reason: string };

export function ChannelRoutingPanel({ routes }: { routes: RoutesResult }) {
  const list = routes.ok ? routes.routes : [];
  const unreachable = list.filter((route) => !route.resolved).length;

  return (
    <section className="panel overflow-hidden p-0">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/10 text-sky-500">
            <Radio size={17} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold">Channel routing</h2>
            <p className="mt-0.5 text-[11px] text-muted">Where each capability posts, resolved live against Discord.</p>
          </div>
        </div>

        {list.length > 0 && (
          <span
            className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:self-auto ${
              unreachable > 0
                ? "border-amber-400/25 bg-amber-500/10 text-amber-500"
                : "border-emerald-400/25 bg-emerald-500/10 text-emerald-500"
            }`}
          >
            {unreachable > 0 ? `${unreachable} unreachable` : `all ${list.length} resolved`}
          </span>
        )}
      </header>

      {!routes.ok && <p className="px-5 py-5 text-sm text-muted sm:px-6">{routes.reason}</p>}

      {routes.ok && list.length === 0 && (
        <p className="px-5 py-5 text-sm text-muted sm:px-6">No channels are configured.</p>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-line">
          {list.map((route) => (
            <li
              key={route.name}
              className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 sm:px-6 ${
                route.resolved ? "" : "bg-amber-500/[0.04]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${route.resolved ? "bg-emerald-500" : "bg-amber-500"}`}
                  aria-hidden
                />
                <span className="truncate">{route.label}</span>
              </span>

              {/*
                The hash is an icon, not part of the string, so the channel name
                stays one uninterrupted run of monospace. Discord names carrying
                emoji and "・" separators were otherwise breaking across the
                inherited body font and rendering ragged.
              */}
              {route.resolved ? (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 py-1 pl-1.5 pr-2 text-emerald-500">
                  <Hash size={11} className="shrink-0 opacity-70" aria-hidden />
                  <span className="truncate font-mono text-[11px] leading-none">{route.resolved}</span>
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-500">
                  <TriangleAlert size={11} aria-hidden /> Unreachable
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
