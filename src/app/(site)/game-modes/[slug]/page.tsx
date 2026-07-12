import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Terminal, Users } from "lucide-react";
import { getGameMode, getGameModes } from "@/lib/data/content";
import { site } from "@/lib/site";
import { CopyIpButton, Icon, Reveal } from "@/components/shared";
import { accentStyles, coverGradient } from "@/components/shared/accent";

export async function generateStaticParams() {
  const modes = await getGameModes();
  return modes.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mode = await getGameMode(slug);
  if (!mode) return { title: "Game mode not found" };
  return { title: mode.name, description: mode.description };
}

export default async function GameModeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mode = await getGameMode(slug);
  if (!mode) notFound();

  const accent = accentStyles[mode.accent];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line" style={{ backgroundImage: coverGradient(mode.accent) }}>
        <div className="absolute inset-0 opacity-[0.12] [background:linear-gradient(rgb(var(--ink)/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--ink)/0.5)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="shell relative py-16 sm:py-24">
          <Link href="/game-modes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> All game modes
          </Link>
          <div className="flex items-center gap-4">
            <span className={`grid h-16 w-16 place-items-center rounded-2xl border border-line-strong bg-black/30 ${accent.text}`}>
              <Icon name={mode.icon} size={32} />
            </span>
            <div>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{mode.name}</h1>
              <p className={`mt-1 text-lg ${accent.text}`}>{mode.tagline}</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted">{mode.description}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <CopyIpButton ip={site.javaIp} label="Copy server IP" />
            <span className="chip">
              <Users size={14} /> {mode.players} playing now
            </span>
            <span className="chip telemetry">{mode.version}</span>
          </div>
        </div>
      </section>

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
    </>
  );
}
