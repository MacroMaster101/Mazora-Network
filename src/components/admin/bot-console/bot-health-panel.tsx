import type { PresenceHealth } from "@/lib/data/discord-presence-health";
import type { ChannelRoute } from "@/lib/data/bot-console";

type PresenceResult = { ok: true; health: PresenceHealth } | { ok: false; reason: string };
type RoutesResult = { ok: true; routes: ChannelRoute[] } | { ok: false; reason: string };

function Chip({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-sm font-medium ${ok ? "text-emerald-400" : "text-amber-400"}`}>{detail}</p>
    </div>
  );
}

export function BotHealthPanel({
  presence,
  routes,
  tokenSet,
  keyOk,
  guildSet,
  appIdSet,
}: {
  presence: PresenceResult;
  routes: RoutesResult;
  /** Whether DISCORD_BOT_TOKEN is set, resolved server-side so this token check never reads process.env from a component. */
  tokenSet: boolean;
  /** Whether DISCORD_APP_PUBLIC_KEY is set and well-formed, resolved the same way. */
  keyOk: boolean;
  /** Whether DISCORD_GUILD_ID is set. Resolved in the server-only data reader. */
  guildSet: boolean;
  /** Whether DISCORD_APPLICATION_ID is set. Resolved in the server-only data reader. */
  appIdSet: boolean;
}) {
  // If any channel resolved, the token works and the guild is reachable.
  const guildReachable = routes.ok && routes.routes.some((route) => route.resolved !== null);
  const workerOk = presence.ok && presence.health.discord === "connected";

  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Bot health</h2>
        <p className="text-xs text-muted">Connection state and whether each secret is present.</p>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Chip
          label="Presence worker"
          ok={workerOk}
          detail={presence.ok ? presence.health.discord : presence.reason}
        />
        <Chip label="Guild reachable" ok={guildReachable} detail={guildReachable ? "Yes" : "Not confirmed"} />
        <Chip label="Bot token" ok={tokenSet} detail={tokenSet ? "Set" : "Missing"} />
        <Chip label="Signature key" ok={keyOk} detail={keyOk ? "Valid" : "Missing or malformed"} />
        <Chip label="Guild id" ok={guildSet} detail={guildSet ? "Set" : "Missing"} />
        <Chip label="Application id" ok={appIdSet} detail={appIdSet ? "Set" : "Missing"} />
      </div>
    </section>
  );
}
