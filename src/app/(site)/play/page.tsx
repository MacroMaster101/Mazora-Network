import { publicPageMetadata } from "@/lib/seo";
import { Monitor, Smartphone } from "lucide-react";
import { getPatchUpdates } from "@/lib/data/patches";
import { getFaqs } from "@/lib/data/faqs";
import { getPlayPageConfig } from "@/lib/data/play-page-config";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { getStatusTelemetry } from "@/lib/data/status-telemetry";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { PageHero, CopyIpButton, Reveal, UnifiedServerStatsCard } from "@/components/shared";
import { Accordion } from "@/components/ui";

export const metadata = publicPageMetadata({
  title: "Play",
  description: `How to join ${site.name} on Java and Bedrock — server IP, Bedrock port, server status and connection instructions.`,
  path: "/play",
});

export const dynamic = "force-dynamic";

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-5 space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line-strong bg-ink/5 font-display text-xs font-bold text-ink">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm text-muted">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function PlayPage() {
  const [status, patchUpdates, faqs, playConfig, generalSettings, telemetry] = await Promise.all([
    getServerStatus(),
    getPatchUpdates(),
    getFaqs(),
    getPlayPageConfig(),
    getSiteGeneralSettings(),
    getStatusTelemetry(),
  ]);

  const online = status.live && status.online;
  const activeBedrockIp = playConfig.bedrockIp || generalSettings.bedrockIp || site.bedrockIp;
  const activeBedrockPort = playConfig.bedrockPort || generalSettings.bedrockPort || site.bedrockPort;
  const activeJavaIp = playConfig.javaIp || generalSettings.javaIp || site.javaIp;
  const bedrockAddress = `${activeBedrockIp}:${activeBedrockPort}`;

  const bedrockSteps = (playConfig.bedrockSteps || []).map((step) =>
    step
      .replace(/Enter (?:the )?port:?\s*\d+/i, `Enter the port: ${activeBedrockPort}`)
      .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${activeBedrockIp}`)
      .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${generalSettings.name || site.name}`)
  );

  const javaSteps = (playConfig.javaSteps || []).map((step) =>
    step
      .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${activeJavaIp}`)
      .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${generalSettings.name || site.name}`)
  );

  return (
    <>
      <PageHero
        eyebrow="Get started"
        title={playConfig.heroTitle || "Joining takes about a minute."}
        lead={playConfig.heroLead || "Copy the address, add the server, and you're in. Here's exactly how on both editions."}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${online ? "border-success/40 text-success" : "border-line-strong text-muted"}`}>
            <span className={online ? "dot animate-pulse" : "dot dot-off"} />
            {online ? `Online · ${status.players}/${status.max}` : status.live ? "Offline" : "Status unavailable"}
          </span>
          <CopyIpButton ip={activeJavaIp} label="Copy Java IP" />
        </div>
      </PageHero>

      <section className="section shell grid gap-6 lg:grid-cols-2">
        <Reveal className="panel p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <Monitor size={22} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Java Edition</h2>
              <p className="telemetry text-sm text-muted">{activeJavaIp}</p>
            </div>
          </div>
          <Steps steps={javaSteps} />
          <CopyIpButton ip={activeJavaIp} label="Copy Java IP" className="mt-6 w-full" />
        </Reveal>

        <Reveal delay={0.05} className="panel p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <Smartphone size={22} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Bedrock Edition</h2>
              <p className="telemetry text-sm text-muted">
                {activeBedrockIp} : {activeBedrockPort}
              </p>
            </div>
          </div>
          <Steps steps={bedrockSteps} />
          <CopyIpButton ip={bedrockAddress} label="Copy Bedrock IP" className="mt-6 w-full" />
        </Reveal>
      </section>

      {/* Single Unified Server Stats, Telemetry Graph & Patch Updates Card */}
      <section className="section shell">
        <Reveal>
          <UnifiedServerStatsCard
            status={status}
            patches={patchUpdates}
            customTelemetryMessage={playConfig.telemetryMessage}
            telemetry={telemetry}
          />
        </Reveal>
      </section>

      <section className="section shell">
        <Reveal>
          <h2 className="text-3xl font-bold">Frequently asked</h2>
          <p className="mt-2 text-muted">Everything you need to know before your first login.</p>
          <Accordion className="mt-6" items={faqs} />
        </Reveal>
      </section>
    </>
  );
}
