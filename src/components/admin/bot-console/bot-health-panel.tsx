import type { PresenceHealth } from "@/lib/data/discord-presence-health";
import type { ChannelRoute } from "@/lib/data/bot-console";

type PresenceResult = { ok: true; health: PresenceHealth } | { ok: false; reason: string };
type RoutesResult = { ok: true; routes: ChannelRoute[] } | { ok: false; reason: string };

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className={ok ? "text-emerald-400" : "text-amber-400"}>{detail}</span>
    </li>
  );
}

export function BotHealthPanel({
  presence,
  routes,
  tokenSet,
  keyOk,
}: {
  presence: PresenceResult;
  routes: RoutesResult;
  /** Whether DISCORD_BOT_TOKEN is set, resolved server-side so this token check never reads process.env from a component. */
  tokenSet: boolean;
  /** Whether DISCORD_APP_PUBLIC_KEY is set and well-formed, resolved the same way. */
  keyOk: boolean;
}) {
  // If any channel resolved, the token works and the guild is reachable.
  const guildReachable = routes.ok && routes.routes.some((route) => route.resolved !== null);

  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Bot health</h2>
      </header>
      <ul className="grid gap-2">
        <Row label="Bot token" ok={tokenSet} detail={tokenSet ? "Configured" : "Missing"} />
        <Row label="Interactions signature key" ok={keyOk} detail={keyOk ? "Valid" : "Missing or malformed"} />
        <Row
          label="Guild reachable"
          ok={guildReachable}
          detail={guildReachable ? "Yes" : "Not confirmed"}
        />
        <Row
          label="Presence worker"
          ok={presence.ok && presence.health.discord === "connected"}
          detail={presence.ok ? presence.health.discord : presence.reason}
        />
      </ul>
    </section>
  );
}
