import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MonitorSmartphone, Newspaper, Play, ShieldCheck, UsersRound } from "lucide-react";
import { CopyIpButton, EmptyState, Reveal, SectionHeader } from "@/components/shared";
import { DiscordIcon } from "@/components/shared/icon";
import { NewsBoard } from "@/components/shared/news-board";
import { getNews } from "@/lib/data/content";
import { getDiscordStats } from "@/lib/data/discord";
import { getServerStatus } from "@/lib/data/status";
import { site } from "@/lib/site";
import { withCommas } from "@/lib/utils";
import { headers } from "next/headers";
import { getPreviewNews } from "@/lib/news/preview-fixtures";
import { jsonLdGraph, organizationSchema, websiteSchema } from "@/lib/seo";

/**
 * The homepage carries the only title on the site that is not templated, so it
 * has to do the work the template does elsewhere: name the brand and the modes
 * people actually search for. The root layout's `%s · Mazora Network` template
 * is bypassed by `title.absolute`, which keeps this from reading
 * "Mazora Network · Mazora Network".
 */
export const metadata: Metadata = {
  title: {
    absolute: `${site.name} | Minecraft Survival, Skyblock, Lifesteal & More`,
  },
  description:
    "Join Mazora Network — a Java and Bedrock Minecraft community with Survival, Skyblock, Lifesteal, OneBlock, KitPvP and Creative worlds, one account across every mode.",
};

async function HomeContent({ previewNews, previewEmpty }: { previewNews: boolean; previewEmpty: boolean }) {
  const [status, discord, publishedNews] = await Promise.all([
    getServerStatus(),
    getDiscordStats(),
    getNews(),
  ]);
  const news = previewEmpty ? [] : previewNews ? getPreviewNews() : publishedNews;

  return (
    <>
      <section className="hero-stage relative z-[3] -mt-[4.75rem] isolate flex min-h-[660px] overflow-hidden pt-[4.75rem] sm:min-h-[710px] lg:min-h-[100svh]">
        {/*
          The hero presents the brand as artwork rather than type, so the page's
          only heading is visually hidden. Without it the homepage shipped no
          <h1> at all — previously masked by the loading splash, which rendered
          one before the real content on every route.
        */}
        <h1 className="sr-only">
          {site.name} — {site.tagline}
        </h1>
        <div className="hero-art pointer-events-none absolute inset-0">
          {/*
            This image is the page's LCP element on both mobile and desktop.

            fetchPriority is set explicitly even though `priority` is already
            here: `priority` emits the <link rel=preload> into <head>, but Next
            does not put fetchpriority="high" on the <img> itself, and that
            attribute is what Lighthouse's "LCP request discovery" audit checks
            for. Without it the request competes at default priority with the
            other images the browser has discovered by then.
          */}
          <Image
            src="/images/mazora-community-hero.webp"
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={60}
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
                  src="/images/mazora-logo.webp"
                  alt="Mazora Network"
                  width={390}
                  height={260}
                  sizes="(max-width: 640px) 82vw, 390px"
                  className="relative w-[min(82vw,390px)] max-w-none animate-float object-contain drop-shadow-[0_18px_45px_rgba(12,5,28,0.75)] transition-[filter,transform] duration-500 ease-out group-hover:scale-[1.035] group-hover:drop-shadow-[0_18px_55px_rgba(167,110,255,0.55)]"
                />
              </div>
            </div>

            <div className="order-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <a href={site.discord} target="_blank" rel="noreferrer" className="hero-stat hero-stat-right group mx-auto max-w-[360px] lg:ml-0 lg:mr-auto">
                <div className="hero-stat-icon">
                  <DiscordIcon size={18} />
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
              {/*
                aria-label because the nav and footer both link to the internal
                /discord page under the same "Discord" name; two links reading
                identically but going to different places is the
                "identical-links-same-purpose" finding.
              */}
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                aria-label="Join the Mazora Discord server"
                className="hero-cta hero-cta-quiet"
              >
                <DiscordIcon size={16} /> Discord
              </a>
            </div>
          </div>
        </div>


      </section>

      <div className="home-world">
        <section className="home-section home-section-base home-news-band section shell pt-14 sm:pt-16">
          <Reveal className="home-section-heading">
            <SectionHeader eyebrow="From the network" title="Latest news & updates." />
          </Reveal>
          <Reveal className="mt-8">
            {news.length > 0 ? (
              <NewsBoard articles={news} />
            ) : (
              <EmptyState
                className="news-empty-state"
                icon={<Newspaper size={24} />}
                title="No articles published yet"
                message="Updates, patch notes and announcements from the team will show up here."
                cta={{ label: "Join the Discord", href: "/discord" }}
              />
            )}
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
                  <a
                    href={site.discord}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Join the Mazora Discord server"
                    className="btn btn-ghost col-span-2 sm:col-auto"
                  >
                    <DiscordIcon size={16} /> Discord
                  </a>
                </div>
              </div>

              <dl className="home-network-facts grid grid-cols-2 overflow-hidden border border-white/15 bg-black/10">
                {/*
                  The caption sits inside its own <dd> rather than a bare
                  <span>: a <div> inside a <dl> may only contain dt/dd groups,
                  so a stray span made this an invalid definition list (axe
                  "definition-list"). Two <dd>s per <dt> is valid and is the
                  correct reading anyway — the number and its unit are both
                  descriptions of the same term.
                */}
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Live now</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{status.live ? withCommas(status.players) : "—"}</dd>
                  <dd className="mt-1 text-xs text-white/45">players online</dd>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Community</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{discord.live ? withCommas(discord.members) : "—"}</dd>
                  <dd className="mt-1 text-xs text-white/45">Discord members</dd>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Platforms</dt>
                  <dd className="telemetry mt-1 text-lg font-bold sm:text-xl">Java + Bedrock</dd>
                  <dd className="mt-1 text-xs text-white/45">cross-play ready</dd>
                </div>
                <div className="p-5 sm:p-6">
                  <dt className="text-xs uppercase tracking-widest text-muted">Version</dt>
                  <dd className="telemetry mt-1 text-2xl font-bold">{site.version}</dd>
                  <dd className="mt-1 text-xs text-white/45">latest supported</dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ previewNews?: string }>;
}) {
  const previewValue = (await searchParams).previewNews;
  const previewNews = process.env.NODE_ENV === "development" && previewValue === "15";
  const previewEmpty = process.env.NODE_ENV === "development" && previewValue === "0";
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(jsonLdGraph(organizationSchema(), websiteSchema())).replace(/</g, "\\u003c");

  return (
    <>
      {/* Outside Suspense so the graph is in the initial HTML rather than a
          streamed chunk — crawlers that do not wait for the stream still see it.
          Inlined rather than via the JsonLd component: see json-ld.tsx for why. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: json }}
      />
      {/*
        Deliberately NOT wrapped in <Suspense>. The fallback (RouteLoading)
        reserves ~26-50rem, while the real page is several thousand pixels
        tall, so swapping one for the other pushed the footer down and was the
        entire source of this page's CLS (measured 0.156 — over the 0.1 budget
        — with the footer named as the only culprit). Every fetch behind
        HomeContent is cached and fast, so rendering it server-side before the
        first flush costs little; see the numbers in the audit notes.
      */}
      <HomeContent previewNews={previewNews} previewEmpty={previewEmpty} />
    </>
  );
}
