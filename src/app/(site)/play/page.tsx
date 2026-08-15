import { site } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { getServerStatus } from "@/lib/data/status";
import { getPatchUpdates } from "@/lib/data/patches";
import { getFaqs } from "@/lib/data/faqs";
import { getPlayPageConfig } from "@/lib/data/play-page-config";
import { getStatusTelemetry } from "@/lib/data/status-telemetry";
import { PageHero } from "@/components/shared/page-hero";
import { Accordion } from "@/components/ui/accordion";
import { CopyIpButton } from "@/components/shared/copy-ip-button";
import { Reveal } from "@/components/shared/reveal";
import { Monitor, Smartphone } from "lucide-react";
import { UnifiedServerStatsCard } from "@/components/shared/unified-server-stats-card";

export const metadata = publicPageMetadata({
  title: "How to Play — Connect Java & Bedrock",
  description:
    "Step-by-step connection guide for Java Edition and Bedrock Edition players joining Mazora Network.",
  path: "/play",
});

/*
  force-dynamic already keeps this page off the static path. `revalidate = 0`
  was additionally pinning the *segment's* revalidate to zero, and Next takes
  the minimum of the segment and each fetch — which silently overrode the
  `next: { revalidate: 300 }` on getServerStatus and sent this page to
  mcsrvstat.us on every single request. That put a third-party API on the
  critical path of every /play load (measured ~0.6s here versus ~0.26s for the
  homepage, which reads the same status through the cache).
*/
export const dynamic = "force-dynamic";

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-5 space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="telemetry grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-sm font-bold text-accent-bright">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm text-muted">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function PlayPage() {
  const [status, patchUpdates, faqs, playConfig, telemetry] = await Promise.all([
    getServerStatus(),
    getPatchUpdates(),
    getFaqs(),
    getPlayPageConfig(),
    getStatusTelemetry(),
  ]);

  const online = status.live && status.online;
  const bedrockAddress = `${playConfig.bedrockIp || site.bedrockIp}:${playConfig.bedrockPort || site.bedrockPort}`;

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
          <CopyIpButton ip={playConfig.javaIp || site.javaIp} label="Copy Java IP" />
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
              <p className="telemetry text-sm text-muted">{playConfig.javaIp || site.javaIp}</p>
            </div>
          </div>
          <Steps steps={playConfig.javaSteps} />
          <CopyIpButton ip={playConfig.javaIp || site.javaIp} label="Copy Java IP" className="mt-6 w-full" />
        </Reveal>

        <Reveal delay={0.05} className="panel p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <Smartphone size={22} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Bedrock Edition</h2>
              <p className="telemetry text-sm text-muted">
                {playConfig.bedrockIp || site.bedrockIp} : {playConfig.bedrockPort || site.bedrockPort}
              </p>
            </div>
          </div>
          <Steps steps={playConfig.bedrockSteps} />
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
