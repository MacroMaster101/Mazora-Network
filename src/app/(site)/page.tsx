import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessagesSquare, MonitorSmartphone, Play, ShieldCheck, UsersRound } from "lucide-react";
import { CopyIpButton, Reveal, SectionHeader } from "@/components/shared";
import { NewsBoard } from "@/components/shared/news-board";
import { getNews } from "@/lib/data/content";
import { getDiscordStats } from "@/lib/data/discord";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { withCommas } from "@/lib/utils";
import { LoadingScreen } from "@/components/shared/loading-screen";

async function HomeContent() {
  const [status, discord, news] = await Promise.all([
    getServerStatus(),
    getDiscordStats(),
    getNews(),
  ]);

  return (
    <>
      <section className="hero-stage relative z-[3] -mt-[4.75rem] isolate flex min-h-[660px] overflow-hidden pt-[4.75rem] sm:min-h-[710px] lg:min-h-[100svh]">
        <div className="hero-art pointer-events-none absolute inset-0">
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

        <div className="shell relative z-10 flex flex-1 flex-col justify-center pb-10 pt-5 sm:pb-14 sm:pt-8 lg:pb-16 lg:pt-10">
          <div className="grid items-center gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,390px)_minmax(0,1fr)] lg:gap-6 xl:gap-10">
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
                  <span className="telemetry mt-1 block text-xs text-white/55">{site.javaIp}</span>
                </div>
                <Link href="/play" aria-label="How to play" className="absolute inset-0 z-30 cursor-pointer rounded-[inherit]" />
              </div>
            </div>

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

            <div className="order-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <a href={site.discord} target="_blank" rel="noreferrer" className="hero-stat hero-stat-right group mx-auto max-w-[360px] lg:ml-0 lg:mr-auto">
                <div className="hero-stat-icon">
                  <MessagesSquare size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-display text-base font-extrabold sm:text-lg xl:text-xl">
                    <span className="text-white">{discord.live ? withCommas(discord.online) : "Join"}</span>{" "}
                    <span className="uppercase tracking-[0.08em] text-white/80">
                      {discord.live ? "Discord Online" : "Our Discord"}
                    </span>
                  </p>
                  <span className="telemetry mt-1 block text-xs text-white/45 transition-colors group-hover:text-violet-200">
                    {discord.live ? `${withCommas(discord.members)} members` : "discord.gg/ZPrzyGpMyt"}
                  </span>
                </div>
              </a>
            </div>
          </div>

          <div className="mt-6 flex animate-fade-up justify-center sm:mt-9" style={{ animationDelay: "180ms" }}>
            <div className="hero-actions grid w-full max-w-[560px] grid-cols-2 gap-2 p-2 sm:w-auto sm:flex sm:flex-row">
              <Link href="/play" className="hero-cta hero-cta-primary col-span-2 sm:col-auto">
                <Play size={16} className="fill-current" /> Enter the world <ArrowRight size={16} />
              </Link>
              <CopyIpButton ip={site.javaIp} label="Copy IP" className="hero-action-secondary" />
              <a href={site.discord} target="_blank" rel="noreferrer" className="hero-cta hero-cta-quiet">
                <MessagesSquare size={16} /> Discord
              </a>
            </div>
          </div>
        </div>


      </section>

      <div className="home-world">
        <section className="home-section home-section-base home-news-band section shell pt-14 sm:pt-16">
          <Reveal className="home-section-heading">
            <SectionHeader eyebrow="From the network" title="Latest news & updates." href="/news" action="All news" />
          </Reveal>
          <Reveal className="mt-8">
            <NewsBoard articles={news} />
          </Reveal>
        </section>

        <section className="home-clean-join shell pb-20 pt-8 sm:pb-28 sm:pt-12">
          <Reveal>
            <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-center lg:gap-16 lg:py-16">
              <div className="max-w-2xl">
                <p className="eyebrow">Inside the network</p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Built to feel like your server.</h2>
                <p className="mt-3 max-w-xl text-muted">
                  Mazora is a player-first Minecraft community built around persistent worlds, fair progression,
                  and the people you meet along the way. Join from Java or Bedrock and keep one identity across every mode.
                </p>
                <div className="home-value-points mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/65">
                  <span><ShieldCheck size={15} /> Fair progression</span>
                  <span><MonitorSmartphone size={15} /> Java + Bedrock</span>
                  <span><UsersRound size={15} /> Active community</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                  <CopyIpButton ip={site.javaIp} label="Copy server IP" />
                  <Link href="/game-modes" className="btn btn-ghost">Explore worlds</Link>
                  <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-ghost col-span-2 sm:col-auto">
                    <MessagesSquare size={16} /> Discord
                  </a>
                </div>
              </div>

              <dl className="home-network-facts grid grid-cols-2 overflow-hidden border border-white/15 bg-black/10">
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Live now</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{status.live ? withCommas(status.players) : "—"}</dd>
                  <span className="mt-1 block text-xs text-white/45">players online</span>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Community</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{discord.live ? withCommas(discord.members) : "—"}</dd>
                  <span className="mt-1 block text-xs text-white/45">Discord members</span>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Platforms</dt>
                  <dd className="telemetry mt-1 text-lg font-bold sm:text-xl">Java + Bedrock</dd>
                  <span className="mt-1 block text-xs text-white/45">cross-play ready</span>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Version</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{site.version}</dd>
                  <span className="mt-1 block text-xs text-white/45">latest supported</span>
                </div>
              </dl>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen variant="home" />}>
      <HomeContent />
    </Suspense>
  );
}