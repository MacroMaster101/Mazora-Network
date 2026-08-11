import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock3, Sparkles, Terminal, Users } from "lucide-react";
import { getGameMode } from "@/lib/data/content";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { CopyIpButton, Icon, PageHero, Reveal } from "@/components/shared";
import { accentStyles } from "@/components/shared/accent";

// Per-request so an unknown slug returns a real 404 instead of a soft 200. See
// the store detail page for the full reasoning.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mode = await getGameMode(slug);
  if (!mode) return { title: "Game mode not found", robots: { index: false, follow: false } };
  return { title: mode.name, description: mode.description };
}

export default async function GameModeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [mode, status] = await Promise.all([getGameMode(slug), getServerStatus()]);
  if (!mode) notFound();

  const accent = accentStyles[mode.accent];
  const isLive = mode.storeStatus === "live";

  return (
    <>
      <PageHero
        backLink={{ href: "/game-modes", label: "All game modes" }}
        eyebrow={mode.tagline || (isLive ? "Store live" : "Coming soon")}
        title={mode.name}
        lead={mode.description}
        illustration={
          <div className="relative group p-2">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={260}
              height={173}
              priority
              className="relative animate-float object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-black/30 ${accent.text}`}>
            <Icon name={mode.icon} size={20} />
          </span>
          {isLive && <CopyIpButton ip={site.javaIp} label="Copy server IP" />}
          {status.live && (
            <span className="chip">
              <Users size={14} /> {status.players} online now
            </span>
          )}
          <span className="chip telemetry">{mode.version}</span>
        </div>
      </PageHero>

      {isLive ? (
        <section className="section shell grid gap-6 lg:grid-cols-3">
          <Reveal className="panel p-6 lg:col-span-2">
            <h2 className="font-display text-xl font-bold">Features</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {mode.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check size={17} className="mt-0.5 shrink-0 text-accent-bright" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-8 font-display text-xl font-bold">Mode rules</h2>
            <ul className="mt-4 space-y-2">
              {mode.rules.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.bg}`} />
                  {r}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.05} className="space-y-6">
            <div className="panel p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Terminal size={18} className="text-accent-bright" /> Useful commands
              </h2>
              <dl className="mt-4 space-y-3">
                {mode.commands.map((c) => (
                  <div key={c.cmd}>
                    <dt className="telemetry text-sm font-semibold text-accent-bright">{c.cmd}</dt>
                    <dd className="text-sm text-muted">{c.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="glass p-6">
              <h2 className="font-display text-lg font-bold">How to join</h2>
              <p className="mt-2 text-sm text-muted">
                Connect to the network, then run <span className="telemetry text-ink">/join {mode.slug}</span> from the hub —
                or pick {mode.name} from the compass menu.
              </p>
              <Link href="/play" className="btn btn-ghost btn-sm mt-4">
                Full join guide
              </Link>
            </div>
          </Reveal>
        </section>
      ) : (
        <section className="section shell">
          <Reveal className="gamemode-coming-soon">
            <div className="gamemode-coming-soon-orbit" aria-hidden="true">
              <span />
              <span />
              <Icon name={mode.icon} size={34} />
            </div>
            <p className="eyebrow">Game mode</p>
            <h2>{mode.name} is coming soon.</h2>
            <p>
              This world is still being built and balanced. Check back soon, or explore the modes that are already live.
            </p>
            <div>
              <Clock3 size={15} />
              Coming soon
            </div>
          </Reveal>

          {mode.features.length > 0 && (
            <Reveal delay={0.05} className="panel mt-8 p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <Sparkles size={18} className="text-accent-bright" /> What&apos;s planned
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {mode.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={17} className="mt-0.5 shrink-0 text-accent-bright" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </section>
      )}
    </>
  );
}
