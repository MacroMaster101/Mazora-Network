import type { Metadata } from "next";
import { Monitor, Smartphone } from "lucide-react";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { PageHero, CopyIpButton, Reveal } from "@/components/shared";
import { Accordion } from "@/components/ui";

export const metadata: Metadata = {
  title: "How to Play",
  description: `Join ${site.name} on Java or Bedrock Edition. Copy the IP, follow the steps, and start playing in minutes.`,
};

const javaSteps = [
  "Open Minecraft: Java Edition.",
  "Click Multiplayer.",
  "Click Add Server.",
  `Enter the server address: ${site.javaIp}`,
  "Click Done to save.",
  "Select the server from your list.",
  "Click Join Server and start playing.",
];

const bedrockSteps = [
  "Open Minecraft: Bedrock Edition.",
  "Tap Play, then the Servers tab.",
  "Scroll down and tap Add Server.",
  `Enter a name (e.g. ${site.name}).`,
  `Enter the address: ${site.bedrockIp}`,
  `Enter the port: ${site.bedrockPort}`,
  "Save, then tap the server to join.",
];

const faqs = [
  { q: "Which Minecraft versions are supported?", a: `We support ${site.version} on both Java and Bedrock. Most recent versions can connect.` },
  { q: "Is the server premium only?", a: "A genuine (premium) Minecraft account is required to play on Java. This keeps the community secure and fair." },
  { q: "Does the server support Bedrock?", a: `Yes. Bedrock players can join at ${site.bedrockIp} on port ${site.bedrockPort}.` },
  { q: "Can mobile and console players join?", a: "Mobile and supported consoles can join through Bedrock cross-play. Some consoles require external server support." },
  { q: "Do I need any mods?", a: "No mods are required. Optimisation and cosmetic mods are allowed; anything granting an unfair advantage is not." },
  { q: "Is the server free?", a: "Completely free to play. Optional cosmetic and rank purchases support the server but never grant pay-to-win advantages." },
];

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
  const status = await getServerStatus();
  const online = status.live && status.online;

  return (
    <>
      <PageHero eyebrow="Get started" title="Joining takes about a minute." lead="Copy the address, add the server, and you're in. Here's exactly how on both editions.">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${online ? "border-success/40 text-success" : "border-line-strong text-muted"}`}>
            <span className={online ? "dot animate-pulse" : "dot dot-off"} />
            {online ? `Online · ${status.players}/${status.max}` : "Status unavailable"}
          </span>
          <CopyIpButton ip={site.javaIp} label="Copy Java IP" />
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
              <p className="telemetry text-sm text-muted">{site.javaIp}</p>
            </div>
          </div>
          <Steps steps={javaSteps} />
          <CopyIpButton ip={site.javaIp} label="Copy Java IP" className="mt-6 w-full" />
        </Reveal>

        <Reveal delay={0.05} className="panel p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <Smartphone size={22} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Bedrock Edition</h2>
              <p className="telemetry text-sm text-muted">
                {site.bedrockIp} : {site.bedrockPort}
              </p>
            </div>
          </div>
          <Steps steps={bedrockSteps} />
          <CopyIpButton ip={site.bedrockIp} label="Copy Bedrock IP" className="mt-6 w-full" />
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
