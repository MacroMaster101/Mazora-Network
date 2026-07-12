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
      <section className="hero-stage relative -mt-16 isolate flex min-h-[720px] overflow-hidden pt-16 sm:min-h-[780px] lg:min-h-[min(900px,100svh)]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/mazora-community-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-backdrop object-cover object-center"
          />
          <div className="hero-vignette absolute inset-0" />
          <div className="absolute inset-0 opacity-30 [background:linear-gradient(110deg,transparent_20%,rgb(var(--accent-rgb)/0.22)_50%,transparent_80%)]" />
          <div className="hero-grid absolute inset-0" />
          <div className="hero-orbit absolute left-1/2 top-[43%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[34rem] sm:w-[34rem] lg:h-[42rem] lg:w-[42rem]" />
        </div>

        <div className="shell relative z-10 flex flex-1 flex-col justify-center pb-16 pt-12 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
          <div className="mb-8 flex animate-fade-up justify-center lg:mb-12">
            <div className="hero-kicker">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Season II <span className="text-white/25">/</span> Frontiers
            </div>
          </div>
          {/* Centered logo flanked by the two live community stats */}
          <div className="grid items-center gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,390px)_minmax(0,1fr)] lg:gap-6 xl:gap-10">
            {/* Players online */}
            <div className="order-2 animate-fade-up lg:order-1" style={{ animationDelay: "120ms" }}>
              <div className="hero-stat hero-stat-left group mx-auto max-w-[360px] lg:ml-auto lg:mr-0">
                <div className="hero-stat-icon">
                  <Play size={18} className="ml-0.5 fill-current" />
                </div>
                <div className="min-w-0 text-left lg:text-right">
                  <p className="font-display text-base font-extrabold sm:text-lg xl:text-xl">
                    <span className="text-white">{status.live ? withCommas(status.players) : "—"}</span>{" "}
                    <span className="uppercase tracking-[0.08em] text-white/80">Players Online</span>
                  </p>
                  <div className="relative z-10 mt-1 flex lg:justify-end">
                    <CopyIpButton ip={site.javaIp} variant="inline" />
                  </div>
                </div>
                <Link href="/play" aria-label="How to play" className="absolute inset-0 rounded-[inherit]" />
              </div>
            </div>

            {/* Logo */}
            <div className="group order-1 flex animate-fade-up justify-center lg:order-2">
              <div className="hero-logo-wrap relative">
                <div className="hero-logo-aura absolute inset-[13%] rounded-full blur-3xl transition-colors duration-500" />
                <Image
                  src="/images/mazora-logo.png"
                  alt="Mazora Network"
                  width={390}
                  height={260}
                  priority
                  sizes="(max-width: 640px) 82vw, 390px"
                  className="relative w-[min(82vw,390px)] max-w-none animate-float object-contain drop-shadow-[0_18px_45px_rgba(12,5,28,0.75)] transition-[filter,transform] duration-500 ease-out group-hover:scale-[1.035] group-hover:drop-shadow-[0_18px_55px_rgba(167,110,255,0.55)]"
                />
              </div>
            </div>

            {/* Discord */}
            <div className="order-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <a href={site.discord} target="_blank" rel="noreferrer" className="hero-stat hero-stat-right group mx-auto max-w-[360px] lg:ml-0 lg:mr-auto">
                <div className="hero-stat-icon">
                  <MessagesSquare size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-display text-base font-extrabold sm:text-lg xl:text-xl">
                    <span className="text-white">3,128</span>{" "}
                    <span className="uppercase tracking-[0.08em] text-white/80">Users Online</span>
                  </p>
                  <span className="telemetry mt-1 block text-xs text-white/45 transition-colors group-hover:text-violet-200">
                    discord.mazora.net
                  </span>
                </div>
              </a>
            </div>
          </div>

          {/* Primary actions */}
          <div className="mt-9 flex animate-fade-up justify-center sm:mt-12" style={{ animationDelay: "220ms" }}>
            <div className="hero-actions flex w-full max-w-[560px] flex-col gap-2 p-2 sm:w-auto sm:flex-row">
              <Link href="/play" className="hero-cta hero-cta-primary">
                <Play size={16} className="fill-current" /> Enter the world <ArrowRight size={16} />
              </Link>
              <CopyIpButton ip={site.javaIp} label="Copy server IP" />
              <a href={site.discord} target="_blank" rel="noreferrer" className="hero-cta hero-cta-quiet">
                <MessagesSquare size={16} /> Discord
              </a>
            </div>
          </div>

          <div className="mt-8 flex animate-fade-up justify-center" style={{ animationDelay: "300ms" }}>
            <span className="telemetry text-[10px] uppercase tracking-[0.32em] text-white/35">Java + Bedrock · Season live now</span>
          </div>
        </div>

        <div className="hero-theme-transition pointer-events-none absolute inset-x-0 bottom-0 z-10" />
      </section>

      <div className="home-world">
      {/* NEWS — featured story + card grid */}
      <section className="home-section home-section-base home-news-band section shell pt-14 sm:pt-16">
        <Reveal className="home-section-heading">
          <SectionHeader eyebrow="From the network" title="Latest news & updates." href="/news" action="All news" />
        </Reveal>
        <Reveal className="mt-8">
          <NewsBoard articles={news} />
        </Reveal>
      </section>

      {/* STATS */}
      <section className="home-stats shell relative z-20 -mt-5 pb-8">
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
      <section className="home-section home-section-alt home-about-band section shell">
        <Reveal>
          <div className="home-about glass grid gap-8 p-8 md:grid-cols-2 md:p-12">
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
      <section className="home-section home-section-base home-modes-band section shell">
        <Reveal className="home-section-heading">
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
      <section className="home-section home-section-alt home-features-band section shell">
        <Reveal className="home-section-heading">
          <SectionHeader eyebrow="The Mazora difference" title="Built around players, not purchases." center />
        </Reveal>
        <div className="home-feature-grid mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
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
      <section className="home-section home-section-base home-events-band section shell">
        <Reveal className="home-section-heading">
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
      <section className="home-section home-section-alt home-gallery-band section shell">
        <Reveal className="home-section-heading">
          <SectionHeader eyebrow="Screenshots" title="Worlds worth showing off." href="/gallery" action="Open gallery" />
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {gallery.slice(0, 6).map((g) => (
            <Link
              key={g.id}
              href="/gallery"
              className="home-gallery-tile group relative aspect-square overflow-hidden rounded-xl border border-line"
              style={{ backgroundImage: coverGradient(g.accent) }}
            >
              <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/65 via-transparent to-transparent p-3">
                <span className="translate-y-1 text-left transition-transform group-hover:translate-y-0">
                  <span className="block text-xs font-semibold text-white/90">{g.title}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/55">{g.category}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* DISCORD CTA */}
      <section className="home-section home-section-base home-discord-band section shell">
        <Reveal>
          <div className="home-cta glass relative overflow-hidden p-8 text-center sm:p-14">
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
      <section className="home-section home-section-alt home-final-band section shell">
        <Reveal>
          <div className="home-final-card flex flex-col items-center gap-6 rounded-2xl border border-line bg-gradient-to-b from-card to-surface p-10 text-center sm:p-16">
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
      </div>
    </>
  );
}
