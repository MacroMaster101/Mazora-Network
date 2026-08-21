import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Clock3,
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
import { RefreshButton } from "@/components/shared/refresh-button";
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

      <div className="vote-realm-world vote-realm-world-minimal">
        <div className="vote-realm-atmosphere" aria-hidden="true" />

        <section className="shell vote-realm-content vote-hub-content">
          <Reveal className="vote-hub-heading">
            <p className="eyebrow"><Sparkles size={13} /> Mazora vote center</p>
            <h2>Choose a site. Help Mazora grow.</h2>
            <p>Use your Minecraft username on any available partner. Each completed vote supports the network and can unlock your configured in-game reward.</p>
          </Reveal>

          <div className="vote-hub-side-layout">
            <section id="top-voters" className="vote-realm-leaderboard vote-hub-leaderboard" aria-label="Top voters">
              <Reveal className="vote-realm-leaderboard-card vote-hub-leaderboard-card">
                <div className="vote-realm-leader-head">
                  <div className="vote-realm-leader-title">
                    <span><Trophy size={20} /></span>
                    <div>
                      <p className="eyebrow">Community leaderboard</p>
                      <h2>Top supporters</h2>
                      <p>Find a player or sort the board by the voting period that matters to you.</p>
                    </div>
                  </div>
                  {/* Wrapped so the head keeps its two-child layout: the count
                      and the refresh control share the right-hand side. */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="vote-realm-ranked">
                      <strong className="telemetry">{voters.length}</strong>
                      <span>{voters.length === 1 ? "voter ranked" : "voters ranked"}</span>
                    </div>
                    <RefreshButton iconOnly />
                  </div>
                </div>
                <div className="vote-ref-table vote-realm-table"><TopVotersTable entries={voters} /></div>
              </Reveal>
            </section>

            <aside className="vote-hub-sidebar" aria-label="Voting actions">
              <section id="vote-sites" aria-label="Vote sites">
                <Reveal className="vote-hub-sites">
                  <div className="vote-hub-sites-head">
                    <div><p className="eyebrow">Available now</p><h2>Vote sites</h2></div>
                    <span><i aria-hidden="true" /> {sites.length} live</span>
                  </div>
                  <div className="vote-hub-site-list">
                    {sites.map((voteSite, index) => (
                      <a
                        key={voteSite.id || `${voteSite.url}-${index}`}
                        href={generalSettings.votingEnabled ? voteSite.url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!generalSettings.votingEnabled}
                        className={`vote-hub-site-link group${generalSettings.votingEnabled ? "" : " is-disabled"}`}
                      >
                        <span className="vote-hub-site-number">{String(index + 1).padStart(2, "0")}</span>
                        <span><strong>{voteSite.name}</strong><small>{voteSite.reward || "Open partner and enter your username"}</small></span>
                        <span className="vote-hub-site-action">Vote <ArrowUpRight size={15} /></span>
                      </a>
                    ))}
                  </div>
                  <div className="vote-hub-cooldown"><Clock3 size={14} /><span>Each partner controls its own voting cooldown.</span></div>
                </Reveal>
              </section>

              <Reveal className="vote-hub-guide">
                <div className="vote-hub-guide-head"><p className="eyebrow">Quick guide</p><h2>Three steps. Done.</h2></div>
                <div className="vote-hub-guide-list">
                  <div><span>01</span><i><Vote size={17} /></i><div><strong>Open a partner</strong><small>Choose any available site from the list.</small></div></div>
                  <div><span>02</span><i><Check size={17} /></i><div><strong>Confirm your username</strong><small>Enter the Minecraft name you use on Mazora.</small></div></div>
                  <div><span>03</span><i><Gift size={17} /></i><div><strong>Return to the server</strong><small>Collect your configured reward in game.</small></div></div>
                </div>
                <div className="vote-hub-reward-note"><Gift size={18} /><div><strong>Rewards stay flexible</strong><span>Vote rewards can change as Mazora’s seasons and events evolve.</span></div></div>
              </Reveal>
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}
