import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarClock,
  Gamepad2,
  Globe2,
  MessagesSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { getCommunityStats, getEvents, getGallery, getGameModes, getNews } from "@/lib/data/content";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { fmtDate, withCommas } from "@/lib/utils";
import {
  CopyIpButton,
  EventCard,
  GameModeCard,
  Reveal,
  SectionHeader,
  StatCounter,
} from "@/components/shared";
import { NewsBoard } from "@/components/shared/news-board";
import { coverGradient } from "@/components/shared/accent";

const features = [
  { icon: Sparkles, title: "Made for discovery", copy: "Handcrafted quests, original items, and worlds that reward curiosity." },
  { icon: ShieldCheck, title: "Fair by design", copy: "Active moderation and progression where skill beats spending. No pay-to-win." },
  { icon: CalendarClock, title: "Always evolving", copy: "Fresh seasons, community events, and meaningful updates every month." },
  { icon: MessagesSquare, title: "A real community", copy: "Find a team, trade safely, share builds, and shape what we create next." },
  { icon: Zap, title: "Fast & reliable", copy: "Premium infrastructure tuned for smooth combat and dependable uptime." },
  { icon: Globe2, title: "Java + Bedrock", copy: "Play together across PC, mobile, and supported consoles with cross-play." },
];

export default async function HomePage() {
  const [status, modes, news, events, stats, gallery] = await Promise.all([
    getServerStatus(),
    getGameModes(),
    getNews(),
    getEvents(),
    getCommunityStats(),
    getGallery(),
  ]);

  const upcoming = events.filter((e) => e.status !== "completed").slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="relative -mt-16 overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/mazora-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-45 dark:opacity-35"
          />
          <div className="absolute inset-0 [background:linear-gradient(180deg,rgb(var(--base)/0.5),rgb(var(--base)/0.82)_58%,rgb(var(--base)))]" />
          <div className="absolute inset-0 mix-blend-overlay [background:linear-gradient(120deg,rgb(var(--accent-rgb)/0.5),transparent_55%)]" />
          <div className="absolute inset-0 [background:radial-gradient(60rem_36rem_at_50%_-10%,rgb(var(--accent-rgb)/0.24),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.05] [background:linear-gradient(rgb(var(--ink)/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--ink)/0.5)_1px,transparent_1px)] [background-size:40px_40px]" />
        </div>

        <div className="shell relative py-14 sm:py-20 lg:py-24">
          <p className="eyebrow mb-8 flex animate-fade-up justify-center">
            <span className="dot animate-pulse" /> Season II · Frontiers is live
          </p>

          {/* Centered logo flanked by the two live community stats */}
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            {/* Players online */}
            <div className="order-2 flex animate-fade-up items-center justify-center gap-4 lg:order-1 lg:justify-end" style={{ animationDelay: "120ms" }}>
              <div className="text-center lg:text-right">
                <p className="font-display text-xl font-extrabold sm:text-2xl">
                  <span className="text-accent-bright">{status.live ? withCommas(status.players) : "—"}</span>{" "}
                  <span className="uppercase tracking-wide text-ink/90">Players Online</span>
                </p>
                <div className="mt-1.5 flex justify-center lg:justify-end">
                  <CopyIpButton ip={site.javaIp} variant="inline" />
                </div>
              </div>
              <Link
                href="/play"
                aria-label="How to play"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-white shadow-lg shadow-accent/40 transition-transform hover:scale-105"
              >
                <Play size={22} className="ml-0.5 fill-current" />
              </Link>
            </div>

            {/* Logo */}
            <div className="order-1 flex animate-fade-up justify-center lg:order-2">
              <Image
                src="/images/mazora-logo.png"
                alt="Mazora Network"
                width={360}
                height={240}
                priority
                sizes="(max-width: 640px) 80vw, 360px"
                className="w-[min(78vw,360px)] max-w-none object-contain drop-shadow-[0_10px_40px_rgba(139,92,246,0.4)]"
              />
            </div>

            {/* Discord */}
            <div className="order-3 flex animate-fade-up items-center justify-center gap-4 lg:justify-start" style={{ animationDelay: "120ms" }}>
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                aria-label="Join our Discord"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-white shadow-lg shadow-accent/40 transition-transform hover:scale-105"
              >
                <MessagesSquare size={22} />
              </a>
              <div className="text-center lg:text-left">
                <p className="font-display text-xl font-extrabold sm:text-2xl">
                  <span className="text-accent-bright">3,128</span>{" "}
                  <span className="uppercase tracking-wide text-ink/90">Users Online</span>
                </p>
                <a
                  href={site.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="telemetry mt-1.5 inline-block text-sm text-muted hover:text-accent-bright"
                >
                  discord.mazora.net
                </a>
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="mt-11 flex animate-fade-up flex-wrap justify-center gap-3" style={{ animationDelay: "200ms" }}>
            <Link href="/play" className="btn btn-primary">
              Play now <ArrowRight size={16} />
            </Link>
            <CopyIpButton ip={site.javaIp} label="Copy server IP" />
            <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <MessagesSquare size={16} /> Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* NEWS — featured story + card grid */}
      <section className="section shell pt-14 sm:pt-16">
        <Reveal>
          <SectionHeader eyebrow="From the network" title="Latest news & updates." href="/news" action="All news" />
        </Reveal>
        <Reveal className="mt-8">
          <NewsBoard articles={news} />
        </Reveal>
      </section>

      {/* STATS */}
      <section className="shell -mt-4">
        <Reveal className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <div className="panel hud flex flex-col justify-center p-5">
            <span className="telemetry text-3xl font-bold">
              {status.live ? <StatCounter value={String(status.players)} /> : "—"}
            </span>
            <span className="mt-1 text-sm text-muted">Players online</span>
            <span className="text-xs text-muted">{status.live ? "live now" : "status not connected"}</span>
          </div>
          {stats.map((s) => (
            <div key={s.label} className="panel flex flex-col justify-center p-5">
              <span className="telemetry text-3xl font-bold">
                <StatCounter value={s.value} />
              </span>
              <span className="mt-1 text-sm text-muted">{s.label}</span>
              <span className="text-xs text-muted">{s.detail}</span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ABOUT */}
      <section className="section shell">
        <Reveal>
          <div className="glass grid gap-8 p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="eyebrow mb-3">About the network</p>
              <h2 className="text-3xl font-bold sm:text-4xl">A place worth logging back in for.</h2>
              <p className="mt-4 text-muted">
                {site.name} started in a Discord call in 2023 with one goal: build the server we always wanted to play on.
                Today it&apos;s a growing community across {site.region}, spanning six carefully tuned game modes and one shared account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/game-modes" className="btn btn-ghost btn-sm">
                  Explore modes
                </Link>
                <Link href="/staff" className="btn btn-ghost btn-sm">
                  Meet the team
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                ["Launched", fmtDate(site.launchDate)],
                ["Region", site.region],
                ["Platforms", "Java + Bedrock"],
                ["Version", site.version],
                ["Game modes", String(modes.length)],
                ["Economy", "Player-driven"],
              ].map(([k, v]) => (
                <div key={k} className="bg-card p-5">
                  <dt className="text-xs uppercase tracking-widest text-muted">{k}</dt>
                  <dd className="telemetry mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* GAME MODES */}
      <section className="section shell">
        <Reveal>
          <SectionHeader
            eyebrow="Choose your story"
            title="Six worlds. Endless possibilities."
            copy="Every mode is carefully tuned, actively developed, and connected through one account."
            href="/game-modes"
            action="Explore all modes"
          />
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((mode, i) => (
            <Reveal key={mode.slug} delay={i * 0.05}>
              <GameModeCard mode={mode} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* WHY PLAY */}
      <section className="section shell">
        <Reveal>
          <SectionHeader eyebrow="The Mazora difference" title="Built around players, not purchases." center />
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group bg-card p-6 transition-colors hover:bg-accent/[0.06]">
              <f.icon size={22} className="text-accent-bright" />
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EVENTS */}
      <section className="section shell">
        <Reveal>
          <SectionHeader eyebrow="Save the date" title="Meet us in the arena." href="/events" action="All events" />
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event, i) => (
            <Reveal key={event.slug} delay={i * 0.05}>
              <EventCard event={event} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section className="section shell">
        <Reveal>
          <SectionHeader eyebrow="Screenshots" title="Worlds worth showing off." href="/gallery" action="Open gallery" />
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {gallery.slice(0, 6).map((g) => (
            <Link
              key={g.id}
              href="/gallery"
              className="group relative aspect-square overflow-hidden rounded-xl border border-line"
              style={{ backgroundImage: coverGradient(g.accent) }}
            >
              <span className="absolute inset-0 grid place-items-end p-3">
                <span className="text-xs font-medium text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                  {g.title}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* DISCORD CTA */}
      <section className="section shell">
        <Reveal>
          <div className="glass relative overflow-hidden p-8 text-center sm:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(40rem_20rem_at_50%_0%,rgba(139,92,246,0.14),transparent_60%)]" />
            <div className="relative">
              <p className="eyebrow justify-center">18,400+ members</p>
              <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
                The adventure continues on Discord.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">
                Get announcements first, find your next teammate, join giveaways, and talk directly with the team shaping {site.name}.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <MessagesSquare size={16} /> Join the community
                </a>
                <Link href="/discord" className="btn btn-ghost">
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section className="section shell">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-line bg-gradient-to-b from-card to-surface p-10 text-center sm:p-16">
            <Gamepad2 size={32} className="text-accent-bright" />
            <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">Ready to start your adventure?</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <CopyIpButton ip={site.javaIp} label="Copy server IP" />
              <Link href="/play" className="btn btn-ghost">
                How to join
              </Link>
              <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-ghost">
                Join Discord
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
