import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Clock3,
  Gift,
  RotateCcw,
  Sparkles,
  Trophy,
  Vote,
} from "lucide-react";
import { getVoteSites, getTopVoters } from "@/lib/data/content";
import { site } from "@/lib/site";
import { Reveal } from "@/components/shared";
import { TopVotersTable } from "./top-voters-table";

export const metadata: Metadata = {
  title: "Vote",
  description: `Vote for ${site.name} every day to earn coins, crate keys and rewards — and help more players find us.`,
};

export default async function VotePage() {
  const [sites, voters] = await Promise.all([getVoteSites(), getTopVoters()]);

  return (
    <>
      <section className="vote-mission-hero">
        <Image
          src="/images/vote-rewards-sanctuary-v5.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="vote-mission-image"
        />
        <div className="vote-mission-shade" aria-hidden="true" />
        <div className="vote-mission-noise" aria-hidden="true" />

        <div className="shell vote-mission-stage vote-mission-stage-simple vote-reward-stage">
          <div className="vote-reward-status" aria-label="Vote reward status">
            <span><i aria-hidden="true" /> Reward run</span>
            <span>Available daily</span>
          </div>

          <div className="vote-mission-layout vote-mission-layout-simple vote-reward-layout">
            <div className="vote-mission-copy vote-reward-copy">
              <p className="vote-reward-kicker"><Sparkles size={14} /> Support the network</p>
              <h1>
                Vote for Mazora.
                <span>Get rewarded.</span>
              </h1>
              <p className="vote-mission-lead">
                Help new players discover Mazora and earn in-game rewards along the way. Choose any available vote site below to begin.
              </p>

              <div className="vote-mission-actions">
                <a href="#vote-sites" className="btn vote-mission-primary h-12 px-6">
                  Start voting <ArrowDown size={16} />
                </a>
              </div>

              <div className="vote-reward-loop" aria-label="How voting works">
                <span><Vote size={15} /><b>Vote</b></span>
                <i aria-hidden="true" />
                <span><Gift size={15} /><b>Earn rewards</b></span>
                <i aria-hidden="true" />
                <span><RotateCcw size={15} /><b>Return later</b></span>
              </div>

              <div className="vote-mission-quick-note">
                <Clock3 size={14} /> Each vote site has its own cooldown.
              </div>
            </div>
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
                  <div className="vote-realm-leader-title"><span><Trophy size={20} /></span><div><p className="eyebrow">Community leaderboard</p><h2>Top supporters</h2><p>Find a player or sort the board by the voting period that matters to you.</p></div></div>
                  <div className="vote-realm-ranked"><strong className="telemetry">{voters.length}</strong><span>players ranked</span></div>
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
                      <a key={voteSite.id} href={voteSite.url} target="_blank" rel="noreferrer" className="vote-hub-site-link group">
                        <span className="vote-hub-site-number">{String(index + 1).padStart(2, "0")}</span>
                        <span><strong>{voteSite.name}</strong><small>Open partner and enter your username</small></span>
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
          </div>        </section>
      </div>
    </>
  );
}
