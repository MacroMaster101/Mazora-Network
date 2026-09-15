import { publicPageMetadata } from "@/lib/seo";
import { Activity, Signal, Server, Clock, Gauge } from "lucide-react";
import { getServerStatus } from "@/lib/data/status";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { site } from "@/lib/site";
import { PageHero, CopyIpButton, Reveal, FloatingBrandLogo } from "@/components/shared";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Server Status",
  description: `Live status for ${site.name} — player count, version, MOTD, ping and uptime for Java and Bedrock.`,
  path: "/status",
});

export const dynamic = "force-dynamic";

function Stat({ icon: Icon, label, value, fieldId }: { icon: typeof Activity; label: string; value: string; fieldId?: string }) {
  return (
    <div className="panel p-5">
      <Icon size={18} className="text-accent-bright" />
      <div className="telemetry mt-3 text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted" data-page-field={fieldId}>{label}</div>
    </div>
  );
}

export default async function StatusPage() {
  const [status, generalSettings, copy] = await Promise.all([
    getServerStatus(),
    getSiteGeneralSettings(),
    getPageContent("status"),
  ]);

  const online = status.live && status.online;
  const activeJavaIp = generalSettings.javaIp || site.javaIp;
  const activeBedrockIp = generalSettings.bedrockIp || site.bedrockIp;
  const activeBedrockPort = generalSettings.bedrockPort || site.bedrockPort;
  const activeVersion = generalSettings.version || status.version || site.version;

  return (
    <>
      <PageHero
        eyebrow={copy.heroEyebrow}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ eyebrow: "heroEyebrow", title: "heroTitle", lead: "heroLead" }}
        illustration={<FloatingBrandLogo />}
      />

      <section className="section shell">
        {!status.live && (
          <Reveal className="glass mb-8 flex items-center gap-3 p-5">
            <Activity size={20} className="text-warning" />
            <p className="text-sm text-muted">
              <span data-page-field="providerUnavailable">{copy.providerUnavailable}</span> <span className="telemetry text-ink">({activeJavaIp})</span>
            </p>
          </Reveal>
        )}

        <Reveal className="hud glass flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className={online ? "dot animate-pulse" : "dot dot-off"} style={{ width: 12, height: 12 }} />
            <div>
              <p className="font-display text-xl font-bold" data-page-field={!status.live ? "statusUnavailable" : online ? "serverOnline" : "serverOffline"}>
                {!status.live ? copy.statusUnavailable : online ? copy.serverOnline : copy.serverOffline}
              </p>
              <p className="telemetry text-sm text-muted">
                <span data-page-field="lastUpdated">{copy.lastUpdated}</span> {new Date(status.lastUpdate).toLocaleTimeString("en", { timeZone: "UTC", timeZoneName: "short" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Beside "Last updated", which is the number it refreshes. */}
            <RefreshButton iconOnly />
            <CopyIpButton ip={activeJavaIp} label={copy.copyIpCta} fieldId="copyIpCta" />
          </div>
        </Reveal>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Activity} label={copy.playersLabel} fieldId="playersLabel" value={online ? `${status.players}/${status.max}` : status.live ? copy.offlineLabel : "—"} />
          <Stat icon={Server} label={copy.versionLabel} fieldId="versionLabel" value={activeVersion} />
          <Stat icon={Signal} label={copy.pingLabel} fieldId="pingLabel" value={online ? `${status.ping}ms` : status.live ? copy.offlineLabel : "—"} />
          <Stat icon={Gauge} label={copy.uptimeLabel} fieldId="uptimeLabel" value={online ? status.uptime : status.live ? copy.offlineLabel : "—"} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal className="panel p-6">
            <h3 className="font-display font-bold" data-page-field="javaTitle">{copy.javaTitle}</h3>
            <div className="mt-3 flex items-center justify-between">
              <CopyIpButton ip={activeJavaIp} variant="inline" />
              <span className={`inline-flex items-center gap-2 text-sm ${status.java.online ? "text-success" : "text-muted"}`}>
                <span className={status.java.online ? "dot" : "dot dot-off"} /> <span data-page-field={status.java.online ? "reachableLabel" : status.live ? "offlineLabel" : "unknownLabel"}>{status.java.online ? copy.reachableLabel : status.live ? copy.offlineLabel : copy.unknownLabel}</span>
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.05} className="panel p-6">
            <h3 className="font-display font-bold" data-page-field="bedrockTitle">{copy.bedrockTitle}</h3>
            <div className="mt-3 flex items-center justify-between">
              <CopyIpButton ip={`${activeBedrockIp}:${activeBedrockPort}`} variant="inline" />
              <span className={`inline-flex items-center gap-2 text-sm ${status.bedrock.online ? "text-success" : "text-muted"}`}>
                <span className={status.bedrock.online ? "dot" : "dot dot-off"} /> <span data-page-field={status.bedrock.online ? "reachableLabel" : status.live ? "offlineLabel" : "unknownLabel"}>{status.bedrock.online ? copy.reachableLabel : status.live ? copy.offlineLabel : copy.unknownLabel}</span>
              </span>
            </div>
          </Reveal>
        </div>

        {status.motd && (
          <Reveal className="panel mt-4 p-6">
            <h3 className="font-display font-bold" data-page-field="motdTitle">{copy.motdTitle}</h3>
            <p className="telemetry mt-2 text-muted">{status.motd}</p>
          </Reveal>
        )}

        {/* History — illustrative until a status history store is connected */}
        <Reveal className="panel mt-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold" data-page-field="historyTitle">{copy.historyTitle}</h3>
            <span className="chip">
              <Clock size={13} /> <span data-page-field="historyPeriod">{copy.historyPeriod}</span>
            </span>
          </div>
          <div className="mt-4 flex items-end gap-1" aria-hidden>
            {Array.from({ length: 48 }).map((_, i) => {
              const h = 40 + Math.round(Math.sin(i / 3) * 12 + (i % 5) * 4);
              return <div key={i} className="flex-1 rounded-t bg-accent/30" style={{ height: `${h}px` }} />;
            })}
          </div>
          <p className="mt-3 text-xs text-muted" data-page-field="historyBody">
            {copy.historyBody}
          </p>
        </Reveal>
      </section>
    </>
  );
}
