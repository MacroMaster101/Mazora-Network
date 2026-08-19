import { publicPageMetadata } from "@/lib/seo";
import { Activity, Signal, Server, Clock, Gauge } from "lucide-react";
import { getServerStatus } from "@/lib/data/status";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { site } from "@/lib/site";
import { PageHero, CopyIpButton, Reveal, FloatingBrandLogo } from "@/components/shared";

export const metadata = publicPageMetadata({
  title: "Server Status",
  description: `Live status for ${site.name} — player count, version, MOTD, ping and uptime for Java and Bedrock.`,
  path: "/status",
});

export const dynamic = "force-dynamic";

function Stat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="panel p-5">
      <Icon size={18} className="text-accent-bright" />
      <div className="telemetry mt-3 text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

export default async function StatusPage() {
  const [status, generalSettings] = await Promise.all([
    getServerStatus(),
    getSiteGeneralSettings(),
  ]);

  const online = status.live && status.online;
  const activeJavaIp = generalSettings.javaIp || site.javaIp;
  const activeBedrockIp = generalSettings.bedrockIp || site.bedrockIp;
  const activeBedrockPort = generalSettings.bedrockPort || site.bedrockPort;
  const activeVersion = generalSettings.version || status.version || site.version;

  return (
    <>
      <PageHero
        eyebrow="Live telemetry"
        title="Server status"
        lead="A real-time look at the network. When our status API is connected, everything here updates automatically."
        illustration={<FloatingBrandLogo />}
      />

      <section className="section shell">
        {!status.live && (
          <Reveal className="glass mb-8 flex items-center gap-3 p-5">
            <Activity size={20} className="text-warning" />
            <p className="text-sm text-muted">
              The live provider could not reach <span className="telemetry text-ink">{activeJavaIp}</span>. Check that the
              server is running and accepts Server List Ping requests; the website will not show fabricated numbers.
            </p>
          </Reveal>
        )}

        <Reveal className="hud glass flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className={online ? "dot animate-pulse" : "dot dot-off"} style={{ width: 12, height: 12 }} />
            <div>
              <p className="font-display text-xl font-bold">
                {!status.live ? "Status unavailable" : online ? "Server online" : "Server offline"}
              </p>
              <p className="telemetry text-sm text-muted">
                Last updated {new Date(status.lastUpdate).toLocaleTimeString("en", { timeZone: "UTC", timeZoneName: "short" })}
              </p>
            </div>
          </div>
          <CopyIpButton ip={activeJavaIp} label="Copy server IP" />
        </Reveal>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Activity} label="Players online" value={online ? `${status.players}/${status.max}` : status.live ? "Offline" : "—"} />
          <Stat icon={Server} label="Version" value={activeVersion} />
          <Stat icon={Signal} label="Ping" value={online ? `${status.ping}ms` : status.live ? "Offline" : "—"} />
          <Stat icon={Gauge} label="Uptime" value={online ? status.uptime : status.live ? "Offline" : "—"} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal className="panel p-6">
            <h3 className="font-display font-bold">Java Edition</h3>
            <div className="mt-3 flex items-center justify-between">
              <CopyIpButton ip={activeJavaIp} variant="inline" />
              <span className={`inline-flex items-center gap-2 text-sm ${status.java.online ? "text-success" : "text-muted"}`}>
                <span className={status.java.online ? "dot" : "dot dot-off"} /> {status.java.online ? "Reachable" : status.live ? "Offline" : "Unknown"}
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.05} className="panel p-6">
            <h3 className="font-display font-bold">Bedrock Edition</h3>
            <div className="mt-3 flex items-center justify-between">
              <CopyIpButton ip={`${activeBedrockIp}:${activeBedrockPort}`} variant="inline" />
              <span className={`inline-flex items-center gap-2 text-sm ${status.bedrock.online ? "text-success" : "text-muted"}`}>
                <span className={status.bedrock.online ? "dot" : "dot dot-off"} /> {status.bedrock.online ? "Reachable" : status.live ? "Offline" : "Unknown"}
              </span>
            </div>
          </Reveal>
        </div>

        {status.motd && (
          <Reveal className="panel mt-4 p-6">
            <h3 className="font-display font-bold">MOTD</h3>
            <p className="telemetry mt-2 text-muted">{status.motd}</p>
          </Reveal>
        )}

        {/* History — illustrative until a status history store is connected */}
        <Reveal className="panel mt-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Uptime history</h3>
            <span className="chip">
              <Clock size={13} /> last 24h
            </span>
          </div>
          <div className="mt-4 flex items-end gap-1" aria-hidden>
            {Array.from({ length: 48 }).map((_, i) => {
              const h = 40 + Math.round(Math.sin(i / 3) * 12 + (i % 5) * 4);
              return <div key={i} className="flex-1 rounded-t bg-accent/30" style={{ height: `${h}px` }} />;
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Illustrative visual. Real history appears once a status API and a history store are connected.
          </p>
        </Reveal>
      </section>
    </>
  );
}
