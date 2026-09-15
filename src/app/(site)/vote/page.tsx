import { WorldBackdrop } from "@/components/theme/world-backdrop";
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
import { getPageContent } from "@/lib/data/page-content";
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
  const [sites, voters, generalSettings, copy] = await Promise.all([
    getVoteSites(),
    getTopVoters(),
    getSiteGeneralSettings(),
    getPageContent("vote"),
  ]);

  return (
    <>
      <section className="vote-mission-hero vote-redesign-hero">
        <div className="vote-redesign-art" aria-hidden="true">
          <WorldBackdrop scene="vote" className="vote-redesign-image" />
          <div className="vote-redesign-vignette" />
          <div className="vote-redesign-grid" />
        </div>

        <div className="shell vote-redesign-stage">
          <div className="vote-redesign-status" aria-label="Vote reward status">
            <span>
              <i aria-hidden="true" className={generalSettings.votingEnabled ? "" : "bg-amber-400"} />
              <span data-page-field={generalSettings.votingEnabled ? "openLabel" : "pausedLabel"}>{generalSettings.votingEnabled ? copy.openLabel : copy.pausedLabel}</span>
            </span>
            <span data-page-field="cycleLabel">{copy.cycleLabel}</span>
          </div>

          <div className="vote-redesign-mast" aria-label="Mazora voting overview">
            <div className="vote-redesign-stat">
              <span><Vote size={17} aria-hidden="true" /><small data-page-field="partnerStat">{copy.partnerStat}</small></span>
              <strong>{sites.length}</strong>
            </div>

            <div className="vote-redesign-brand">
              <span aria-hidden="true" />
              <Image
                src="/images/mazora-logo.webp"
                alt="Mazora Network"
                width={300}
                height={200}
                sizes="(max-width: 640px) 190px, 270px"
                className="animate-float"
              />
            </div>

            <div className="vote-redesign-stat vote-redesign-stat-right">
              <span><Trophy size={17} aria-hidden="true" /><small data-page-field="supporterStat">{copy.supporterStat}</small></span>
              <strong>{voters.length}</strong>
            </div>
          </div>

          <div className="vote-redesign-copy">
            <p><Sparkles size={14} aria-hidden="true" /> <span data-page-field="heroEyebrow">{copy.heroEyebrow}</span></p>
            <h1><span data-page-field="heroTitle">{copy.heroTitle}</span> <span data-page-field="heroAccent">{copy.heroAccent}</span></h1>
            <div data-page-field="heroLead">{copy.heroLead}</div>

            {!generalSettings.votingEnabled && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle size={14} className="text-amber-400" />
                <span data-page-field="pausedMessage">{copy.pausedMessage}</span>
              </div>
            )}
          </div>

          <div className="vote-redesign-actions">
            <a href="#vote-sites" className="vote-redesign-primary">
              <span data-page-field="primaryCta">{copy.primaryCta}</span> <ArrowDown size={17} />
            </a>
            <a href="#top-voters" className="vote-redesign-secondary">
              <Trophy size={16} /> <span data-page-field="secondaryCta">{copy.secondaryCta}</span>
            </a>
          </div>

          <div className="vote-redesign-journey" aria-label="How voting works">
            <span><b>01</b><Vote size={15} /> <span data-page-field="journeyOne">{copy.journeyOne}</span></span>
            <i aria-hidden="true" />
            <span><b>02</b><Check size={15} /> <span data-page-field="journeyTwo">{copy.journeyTwo}</span></span>
            <i aria-hidden="true" />
            <span><b>03</b><Gift size={15} /> <span data-page-field="journeyThree">{copy.journeyThree}</span></span>
          </div>
        </div>
      </section>

      <div className="vote-realm-world vote-realm-world-minimal">
        <div className="vote-realm-atmosphere" aria-hidden="true" />

        <section className="shell vote-realm-content vote-hub-content">
          <Reveal className="vote-hub-heading">
            <p className="eyebrow"><Sparkles size={13} /> <span data-page-field="centerEyebrow">{copy.centerEyebrow}</span></p>
            <h2 data-page-field="centerTitle">{copy.centerTitle}</h2>
            <p data-page-field="centerLead">{copy.centerLead}</p>
          </Reveal>

          <div className="vote-hub-side-layout">
            <section id="top-voters" className="vote-realm-leaderboard vote-hub-leaderboard" aria-label="Top voters">
              <Reveal className="vote-realm-leaderboard-card vote-hub-leaderboard-card">
                <div className="vote-realm-leader-head">
                  <div className="vote-realm-leader-title">
                    <span><Trophy size={20} /></span>
                    <div>
                      <p className="eyebrow" data-page-field="leaderEyebrow">{copy.leaderEyebrow}</p>
                      <h2 data-page-field="leaderTitle">{copy.leaderTitle}</h2>
                      <p data-page-field="leaderLead">{copy.leaderLead}</p>
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
                    <div><p className="eyebrow" data-page-field="sitesEyebrow">{copy.sitesEyebrow}</p><h2 data-page-field="sitesTitle">{copy.sitesTitle}</h2></div>
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
                        <span><strong>{voteSite.name}</strong><small data-page-field={!voteSite.reward ? "siteFallback" : undefined}>{voteSite.reward || copy.siteFallback}</small></span>
                        <span className="vote-hub-site-action">Vote <ArrowUpRight size={15} /></span>
                      </a>
                    ))}
                  </div>
                  <div className="vote-hub-cooldown"><Clock3 size={14} /><span data-page-field="cooldown">{copy.cooldown}</span></div>
                </Reveal>
              </section>

              <Reveal className="vote-hub-guide">
                <div className="vote-hub-guide-head"><p className="eyebrow" data-page-field="guideEyebrow">{copy.guideEyebrow}</p><h2 data-page-field="guideTitle">{copy.guideTitle}</h2></div>
                <div className="vote-hub-guide-list">
                  <div><span>01</span><i><Vote size={17} /></i><div><strong data-page-field="step1Title">{copy.step1Title}</strong><small data-page-field="step1Copy">{copy.step1Copy}</small></div></div>
                  <div><span>02</span><i><Check size={17} /></i><div><strong data-page-field="step2Title">{copy.step2Title}</strong><small data-page-field="step2Copy">{copy.step2Copy}</small></div></div>
                  <div><span>03</span><i><Gift size={17} /></i><div><strong data-page-field="step3Title">{copy.step3Title}</strong><small data-page-field="step3Copy">{copy.step3Copy}</small></div></div>
                </div>
                <div className="vote-hub-reward-note"><Gift size={18} /><div><strong data-page-field="rewardTitle">{copy.rewardTitle}</strong><span data-page-field="rewardCopy">{copy.rewardCopy}</span></div></div>
              </Reveal>
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}
