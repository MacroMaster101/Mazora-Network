import type { BotPresenceConfig } from "@/lib/data/bot-presence-config";
import type { PresenceHealth } from "@/lib/data/discord-presence-health";
import { resolveStatusText, type PresenceTokens } from "@/lib/presence-template";
import { relative } from "@/lib/utils";
import { PresenceRotator } from "@/components/admin/bot-console/presence-rotator";

type PresenceResult = { ok: true; health: PresenceHealth } | { ok: false; reason: string };

export function LivePresencePanel({
  presence,
  config,
  tokens,
}: {
  presence: PresenceResult;
  config: BotPresenceConfig;
  tokens: PresenceTokens;
}) {
  return (
    <section className="panel p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Live presence</h2>
        <p className="text-xs text-muted">What the bot is displaying in Discord right now.</p>
      </header>

      {!presence.ok && <p className="text-sm text-muted">{presence.reason}</p>}

      {presence.ok && (
        <>
          {(() => {
            // The verb comes along now: the bot displays "Watching ⛏️ …", and
            // showing only the text dropped half of what a member actually sees.
            const rows = config.statuses
              .filter((status) => status.enabled)
              .map((status) => ({
                id: status.id,
                verb: status.activityType,
                text: resolveStatusText(status, tokens),
              }))
              // Narrow only `text`; `verb` keeps its own union, which is
              // assignable to PresenceRow's wider string.
              .filter((row): row is typeof row & { text: string } => row.text !== null);

            if (rows.length === 0) {
              return <p className="text-sm text-muted">No status has a value to show right now.</p>;
            }

            return <PresenceRotator rows={rows} rotateMs={config.rotateMs} />;
          })()}
          <dl className="mt-4 grid gap-1 text-xs text-muted">
            <div className="flex justify-between">
              <dt>Connected since</dt>
              <dd>{presence.health.connectedAt ? relative(presence.health.connectedAt) : "unknown"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Last snapshot</dt>
              <dd>{presence.health.lastSnapshotAt ? relative(presence.health.lastSnapshotAt) : "unknown"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-muted">
            Rotating every {config.rotateMs / 1000}s, in step with the worker. Hover to pause.
          </p>
        </>
      )}
    </section>
  );
}
