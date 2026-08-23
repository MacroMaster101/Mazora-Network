import type { ChannelRoute } from "@/lib/data/bot-console";

type RoutesResult = { ok: true; routes: ChannelRoute[] } | { ok: false; reason: string };

export function ChannelRoutingPanel({ routes }: { routes: RoutesResult }) {
  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Channel routing</h2>
        <p className="text-xs text-muted">Where each capability posts, resolved live against Discord.</p>
      </header>

      {!routes.ok && <p className="text-sm text-muted">{routes.reason}</p>}

      {routes.ok && routes.routes.length === 0 && (
        <p className="text-sm text-muted">No channels are configured.</p>
      )}

      {routes.ok && routes.routes.length > 0 && (
        <ul className="grid gap-2">
          {routes.routes.map((route) => (
            <li key={route.name} className="flex items-center justify-between gap-3 text-sm">
              <span>{route.label}</span>
              <span className={route.resolved ? "text-emerald-400" : "text-amber-400"}>
                {route.resolved ? `#${route.resolved}` : "unreachable"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
