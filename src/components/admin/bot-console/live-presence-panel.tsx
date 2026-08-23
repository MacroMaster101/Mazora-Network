import type { PresenceHealth } from "@/lib/data/discord-presence-health";
import { presenceLabels } from "@/lib/presence-status";
import { relative } from "@/lib/utils";

type PresenceResult = { ok: true; health: PresenceHealth } | { ok: false; reason: string };

export function LivePresencePanel({ presence }: { presence: PresenceResult }) {
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
            const labels = presenceLabels(presence.health.snapshot);
            const { online } = presence.health;
            // Falls back to "Unknown" rather than presenceLabels' Offline text
            // when the worker's response omitted the field entirely — an
            // absent reading is not the same fact as a confirmed-offline one.
            const rows: { key: string; text: string }[] = [
              { key: "website", text: online.website === null ? "🌐 mazora.us • Unknown" : labels.website },
              {
                key: "minecraft",
                text: online.minecraft === null ? "⛏️ mc.mazora.us • Unknown" : labels.minecraft,
              },
              { key: "discord", text: labels.discord },
            ];
            return (
              <ul className="grid gap-1 font-mono text-sm">
                {rows.map((row) => (
                  <li key={row.key}>{row.text}</li>
                ))}
              </ul>
            );
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
            Refresh and rotation intervals are set on the Render worker and are not reported by its
            health endpoint, so they are not shown here.
          </p>
        </>
      )}
    </section>
  );
}
