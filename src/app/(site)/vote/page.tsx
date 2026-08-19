import Image from "next/image";
import {
  ArrowDown,
  Check,
  Gift,
  Sparkles,
  Trophy,
  Vote,
  AlertTriangle,
} from "lucide-react";
import { getVoteSites, getTopVoters } from "@/lib/data/content";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { site } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { Reveal } from "@/components/shared";
import { TopVotersTable } from "./top-voters-table";
// Import order mirrors the order these rules loaded in before they were split
// out of globals.css / responsive-store-vote.css. Do not reshuffle.
import "@/styles/vote-pages.css";
import "@/styles/store-vote-responsive.css";
import "@/styles/vote.css";

export const metadata = publicPageMetadata({
  title: "Vote",
  description: `Vote for ${site.name} every day to earn coins, crate keys and rewards — and help more players find us.`,
  path: "/vote",
});

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const [sites, voters, generalSettings] = await Promise.all([
    getVoteSites(),
    getTopVoters(),
    getSiteGeneralSettings(),
  ]);

  return (
    <>
      <section className="vote-mission-hero vote-redesign-hero">
        <div className="vote-redesign-art" aria-hidden="true">
          <Image
            src="/images/vote-sanctuary-hero-v6.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="vote-redesign-image"
          />
          <div className="vote-redesign-vignette" />
          <div className="vote-redesign-grid" />
        </div>

        <div className="shell vote-redesign-stage">
          <div className="vote-redesign-status" aria-label="Vote reward status">
            <span>
              <i aria-hidden="true" className={generalSettings.votingEnabled ? "" : "bg-amber-400"} />
              {generalSettings.votingEnabled ? "Voting open" : "Voting paused"}
            </span>
            <span>Daily reward cycle</span>
          </div>

          <div className="vote-redesign-mast" aria-label="Mazora voting overview">
            <div className="vote-redesign-stat">
              <span><Vote size={17} aria-hidden="true" /><small>live vote partners</small></span>
              <strong>{sites.length}</strong>
            </div>

            <div className="vote-redesign-brand">
              <span aria-hidden="true" />
              <Image
                src="/images/mazora-logo.webp"
                alt="Mazora Network"
                width={300}
                height={200}
                priority
                sizes="(max-width: 640px) 190px, 270px"
                className="animate-float"
              />
            </div>

            <div className="vote-redesign-stat vote-redesign-stat-right">
              <span><Trophy size={17} aria-hidden="true" /><small>supporters ranked</small></span>
              <strong>{voters.length}</strong>
            </div>
          </div>

          <div className="vote-redesign-copy">
            <p><Sparkles size={14} aria-hidden="true" /> Support Mazora. Earn in game.</p>
            <h1>Your vote shapes <span>what comes next.</span></h1>
            <div>Help more players discover the network and collect a configured reward for every completed partner vote.</div>

            {!generalSettings.votingEnabled && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200">
                <AlertTriangle size={14} className="text-amber-400" />
                Server voting is currently paused for scheduled updates.
              </div>
            )}
          </div>

          <div className="vote-redesign-actions">
            <a href="#vote-sites" className="vote-redesign-primary">
              Vote now <ArrowDown size={17} />
            </a>
            <a href="#top-voters" className="vote-redesign-secondary">
              <Trophy size={16} /> View rankings
            </a>
          </div>

          <div className="vote-redesign-journey" aria-label="How voting works">
            <span><b>01</b><Vote size={15} /> Choose a partner</span>
            <i aria-hidden="true" />
            <span><b>02</b><Check size={15} /> Enter your username</span>
            <i aria-hidden="true" />
            <span><b>03</b><Gift size={15} /> Return for rewards</span>
          </div>
        </div>
      </section>

      <section id="vote-sites" className="vote-redesign-sites-section shell">
        <Reveal>
          <div className="vote-section-head">
            <p className="eyebrow">Partner links</p>
            <h2>Choose a voting site</h2>
            <p className="text-muted">Click any link below, submit your in-game username, and rewards will be delivered automatically.</p>
          </div>

          <div className="vote-sites-grid mt-8">
            {sites.map((s, idx) => (
              <div key={s.id || idx} className="panel p-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold">{s.name}</h3>
                    <span className="chip text-xs">Every {s.cooldownHours}h</span>
                  </div>
                  <p className="text-xs text-muted mt-2">{s.reward || "Claim in-game keys & voting coins."}</p>
                </div>
                <a
                  href={generalSettings.votingEnabled ? s.url : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`btn w-full justify-center ${
                    generalSettings.votingEnabled
                      ? "btn-primary"
                      : "btn-ghost opacity-60 cursor-not-allowed pointer-events-none"
                  }`}
                >
                  {generalSettings.votingEnabled ? "Vote on this site" : "Voting Paused"}
                </a>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="top-voters" className="section shell">
        <Reveal>
          <div className="vote-section-head">
            <p className="eyebrow">Monthly Leaderboard</p>
            <h2>Top Community Voters</h2>
            <p className="text-muted">Top voters each month earn extra cosmetic rewards and bonus keys.</p>
          </div>
          <div className="mt-8">
            <TopVotersTable entries={voters} />
          </div>
        </Reveal>
      </section>
    </>
  );
}
