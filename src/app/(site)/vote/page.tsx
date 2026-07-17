import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, Trophy, TrendingUp, Flame, Gift, Clock, ArrowUpRight } from "lucide-react";
import { getVoteSites, getTopVoters } from "@/lib/data/content";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";
import { Reveal } from "@/components/shared";
import { TopVotersTable } from "./top-voters-table";

export const metadata: Metadata = {
  title: "Vote",
  description: `Vote for ${site.name} every day to earn coins, crate keys and rewards — and help more players find us.`,
};

export default async function VotePage() {
  const [sites, voters, session] = await Promise.all([
    getVoteSites(),
    getTopVoters(),
    getSession(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden py-12 sm:py-16 md:py-20 lg:py-24 bg-[#08060e] text-white flex items-center justify-center border-b border-line/10">
        {/* Background image container */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none">
          <Image
            src="/images/vote-hero-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-90 animate-fade-in"
          />
          {/* Custom overlays to keep hero dark and text readable in all modes */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#08060e] via-[#08060e]/50 to-[#08060e]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08060e]/30 via-transparent to-[#08060e]/90" />
          {/* Subtle grid lines */}
          <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(139,92,246,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.12)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="shell relative z-10 w-full flex flex-col items-center text-center px-4">
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-950/40 px-3 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#4ade80] animate-pulse" />
            Voting callbacks are active
          </div>

          {/* Title and Tagline */}
          <div className="mt-6 max-w-3xl">
            <p className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-accent-bright">
              <Sparkles size={14} className="text-accent animate-pulse" /> Support the server
            </p>
            <h1 className="mt-3 text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-none tracking-tight text-white uppercase text-shadow-md">
              VOTE
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-white/70 animate-fade-up">
              Help new adventurers discover our world. Vote daily to unlock keys, server-wide coin multipliers, and cosmetic drops.
            </p>
          </div>

          {/* Monthly Server Goal Progress Card */}
          <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-md shadow-2xl animate-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-violet-200">
              <span className="flex items-center gap-1.5 text-accent-bright">
                <Trophy size={13} className="text-accent" /> Monthly Server Goal
              </span>
              <span className="telemetry text-white">11,240 / 15,000 Votes</span>
            </div>
            
            {/* Progress bar wrapper */}
            <div className="relative mt-3 h-2.5 w-full rounded-full bg-[#08060e]/60 overflow-hidden border border-white/5">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                style={{ width: "74.9%" }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] text-white/50 font-medium">
              <span>74.9% Completed</span>
              <span className="text-gold font-bold flex items-center gap-1">
                <Gift size={11} /> +20% Coins at 100%
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-20 -mt-8">
        {/* New Body Section Background with Top-to-Bottom Blend */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <Image
            src="/images/vote-body-bg.png"
            alt=""
            fill
            className="object-cover object-top opacity-[0.18] saturate-[0.8] mix-blend-lighten"
          />
          {/* Top blend overlay: matches the dark hero's base color */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05020a] via-[#08050f]/95 to-[#08050f] lg:via-[#08050f]/80 lg:to-[#08050f]" />
          {/* Bottom blend overlay to default dark website color */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#08050f] to-transparent" />
        </div>

        <section className="section shell relative z-10 py-16">
          {session ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {/* Card 1: Total Votes */}
              <Reveal className="panel flex items-center justify-between p-5 bg-ink/15 border-line-strong hover:border-accent/40 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">Total Votes</p>
                  <h3 className="telemetry mt-1 text-2xl font-bold">128</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent-bright">
                  <Trophy size={18} />
                </span>
              </Reveal>

              {/* Card 2: This Month */}
              <Reveal delay={0.04} className="panel flex items-center justify-between p-5 bg-ink/15 border-line-strong hover:border-accent/40 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">This Month</p>
                  <h3 className="telemetry mt-1 text-2xl font-bold">14</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <TrendingUp size={18} />
                </span>
              </Reveal>

              {/* Card 3: Current Streak */}
              <Reveal delay={0.08} className="panel flex items-center justify-between p-5 bg-ink/15 border-line-strong hover:border-accent/40 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">Current Streak</p>
                  <h3 className="telemetry mt-1 text-2xl font-bold">6 days</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-400 animate-pulse">
                  <Flame size={18} />
                </span>
              </Reveal>

              {/* Card 4: Rewards Earned */}
              <Reveal delay={0.12} className="panel flex items-center justify-between p-5 bg-ink/15 border-line-strong hover:border-accent/40 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted">Rewards Earned</p>
                  <h3 className="telemetry mt-1 text-2xl font-bold">32 keys</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Gift size={18} />
                </span>
              </Reveal>

              <p className="col-span-full text-xs text-muted/65 mt-2">
                Voting history is illustrative until a vote-listing callback is connected to your linked Minecraft account.
              </p>
            </div>
          ) : (
            <Reveal className="glass mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-sm text-muted">Log in and link your Minecraft account to track streaks and collect rewards automatically.</p>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Log in to track votes
              </Link>
            </Reveal>
          )}

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Top Voters Table */}
            <div className="lg:col-span-2">
              <Reveal className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                    <span className="inline-block w-2.5 h-6 bg-accent rounded-sm animate-pulse" />
                    Top Voters
                  </h2>
                </div>
                <TopVotersTable entries={voters} />
              </Reveal>
            </div>

            {/* Sidebar Vote Sites */}
            <div className="lg:col-span-1">
              <Reveal delay={0.1} className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                    <span className="inline-block w-2.5 h-6 bg-accent rounded-sm animate-pulse" />
                    Vote Sites
                  </h2>
                </div>
                <div className="flex flex-col gap-4">
                  {sites.map((v, i) => (
                    <Reveal
                      key={v.id}
                      delay={0.1 + i * 0.05}
                      className="panel panel-hover flex flex-col p-5 bg-ink/30 border-line-strong hover:border-accent/50 group transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-bright group-hover:scale-110 transition-transform">
                            <Flame size={18} />
                          </span>
                          <div>
                            <h3 className="font-display font-bold text-base leading-tight">{v.name}</h3>
                            <p className="text-[10px] uppercase tracking-widest text-muted mt-0.5">every {v.cooldownHours}h</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                          <Clock size={11} /> Ready
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs text-gold border-t border-line/45 pt-3">
                        <Gift size={13} />
                        <span className="font-medium">Reward:</span>
                        <span className="font-bold">{v.reward}</span>
                      </div>

                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary w-full text-center py-2.5 mt-4 font-semibold text-xs flex items-center justify-center gap-1.5 group-hover:bg-accent-bright transition-all"
                      >
                        Vote now <ArrowUpRight size={13} />
                      </a>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
