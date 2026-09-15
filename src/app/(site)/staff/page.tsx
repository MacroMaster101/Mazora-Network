import { breadcrumbSchema, faqPageSchema, jsonLdGraph, publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Crown, Gavel, Handshake, Shield, Sparkles, UsersRound } from "lucide-react";
import { FloatingBrandLogo, MinecraftAvatar, RanksHelpPopover, Reveal } from "@/components/shared";
import { JsonLd } from "@/components/shared/json-ld";
import { roleLabel, STAFF_ROLES } from "@/lib/auth";
import { listPublicStaffAccounts, type PublicStaffMember } from "@/lib/data/accounts";
import type { Role } from "@/lib/types";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Our Team",
  description: "Meet the people leading, managing, and supporting the Mazora Network community.",
  path: "/staff",
});

/*
  Never prerender — same reason as /vote. The layout's cookie read marks this
  dynamic only after rendering has begun, so `next build` still executes
  listPublicStaffAccounts() from the build machine and can hang on a saturated
  Supabase pooler past the 60s export budget. The roster is live data besides:
  a prerendered copy would keep showing staff who have since changed rank or
  left until the next deploy.
*/
export const dynamic = "force-dynamic";

const LADDER: Role[] = STAFF_ROLES.filter((role) => role !== "it").reverse();

const rolePresentation: Partial<Record<Role, { tier: string; icon: LucideIcon }>> = {
  owner: { tier: "owner", icon: Crown },
  administrator: { tier: "admin", icon: BadgeCheck },
  senior_moderator: { tier: "senior", icon: Shield },
  moderator: { tier: "moderator", icon: Gavel },
  helper: { tier: "helper", icon: Handshake },
};

const roleSummary: Partial<Record<Role, string>> = {
  owner: "Leads the network vision, direction, and long-term growth.",
  administrator: "Manages operations, staff coordination, and major server decisions.",
  senior_moderator: "Guides the moderation team and handles complex community cases.",
  moderator: "Keeps gameplay fair, enforces rules, and protects the community.",
  helper: "Welcomes players, answers questions, and provides everyday support.",
};

function TeamMemberCard({ member }: { member: PublicStaffMember }) {
  const presentation = rolePresentation[member.role] ?? rolePresentation.helper!;
  const RankIcon = presentation.icon;
  const minecraftAvatarUrl = member.minecraftSkinUrl ?? member.minecraftAvatarUrl;
  const minecraftUsername = member.minecraftUsername ?? (minecraftAvatarUrl ? member.username : "Steve");

  return (
    <article className={`team-member-card team-member-${presentation.tier}`}>
      <div className="team-member-glow" aria-hidden />
      <div className="team-member-avatar-wrap">
        <MinecraftAvatar
          username={minecraftUsername}
          skinUrl={minecraftAvatarUrl}
          size={76}
          rounded="rounded-2xl"
        />
        <span className="team-member-rank-icon" aria-hidden>
          <RankIcon size={16} />
        </span>
      </div>
      <p className="team-member-tier">{roleLabel(member.role)}</p>
      <h3>{member.username}</h3>
      {member.minecraftUsername && member.minecraftUsername !== member.username && (
        <p className="team-member-alias">Minecraft: {member.minecraftUsername}</p>
      )}
    </article>
  );
}

function FlowConnector({ className = "" }: { className?: string }) {
  return (
    <div className={`team-flow-connector ${className}`} aria-hidden>
      <span />
    </div>
  );
}

export default async function StaffPage() {
  const [members, copy] = await Promise.all([listPublicStaffAccounts(), getPageContent("staff")]);
  const groups = LADDER.map((role) => ({
    role,
    members: (members ?? []).filter((member) => member.role === role),
  })).filter((group) => group.members.length > 0);
  const teamCount = members?.length ?? 0;
  const teamFaqs = [1, 2, 3].map((index) => ({
    question: copy[`faq${index}Question`],
    answer: copy[`faq${index}Answer`],
    index,
  }));

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbSchema([{ name: "Our Team", path: "/staff" }]),
          faqPageSchema("/staff", teamFaqs),
        )}
      />
      <section className="page-hero pb-8 pt-8 sm:pb-10 sm:pt-10">
        <div className="page-hero-atmosphere" aria-hidden="true" />
        <div className="page-hero-inner shell max-w-6xl">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="relative flex items-center justify-center">
              <div className="pointer-events-none absolute inset-0 rounded-full bg-accent/20 blur-3xl" />
              <FloatingBrandLogo />
            </div>
            <p className="eyebrow mb-2 mt-1" data-page-field="heroEyebrow">{copy.heroEyebrow}</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl" data-page-field="heroTitle">{copy.heroTitle}</h1>
            <p className="team-hero-lead mt-4 max-w-2xl text-sm font-medium leading-relaxed sm:text-base" data-page-field="heroLead">{copy.heroLead}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Sparkles size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink" data-page-field="value1Title">{copy.value1Title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium" data-page-field="value1Copy">{copy.value1Copy}</p>
              </div>

              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Shield size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink" data-page-field="value2Title">{copy.value2Title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium" data-page-field="value2Copy">{copy.value2Copy}</p>
              </div>

              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <UsersRound size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink" data-page-field="value3Title">{copy.value3Title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium" data-page-field="value3Copy">{copy.value3Copy}</p>
              </div>
          </div>
        </div>
      </section>

      <section className="team-org-section shell pb-20 pt-4">
        <Reveal>
          <div className="team-org-heading">
            <div>
              <p className="eyebrow" data-page-field="hierarchyEyebrow">{copy.hierarchyEyebrow}</p>
              <h2 data-page-field="hierarchyTitle">{copy.hierarchyTitle}</h2>
            </div>
            <span className="team-count-chip"><UsersRound size={15} /> {teamCount} <span data-page-field="countSuffix">{copy.countSuffix}</span></span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="team-org-chart" aria-label="Mazora Network team hierarchy">
            <RanksHelpPopover>
              <div className="team-ranks-popover-heading">
                <strong>Staff rank guide</strong>
                <span>Leadership to community support</span>
              </div>
              <div className="team-ranks-list">
                {LADDER.map((role) => {
                  const rank = rolePresentation[role] ?? rolePresentation.helper!;
                  const RankIcon = rank.icon;

                  return (
                    <div key={role} className={`team-rank-guide-row team-member-${rank.tier}`}>
                      <span className="team-rank-guide-icon" aria-hidden><RankIcon size={16} /></span>
                      <div>
                        <h3>{roleLabel(role)}</h3>
                        <p>{roleSummary[role]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RanksHelpPopover>
            {members === null ? (
              <div className="team-empty-state">
                <Shield size={26} />
                <h3 data-page-field="unavailableTitle">{copy.unavailableTitle}</h3>
                <p data-page-field="unavailableBody">{copy.unavailableBody}</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="team-empty-state">
                <UsersRound size={26} />
                <h3 data-page-field="emptyTitle">{copy.emptyTitle}</h3>
                <p data-page-field="emptyBody">{copy.emptyBody}</p>
              </div>
            ) : groups.map((group, index) => {
              const presentation = rolePresentation[group.role] ?? rolePresentation.helper!;

              return (
                <div key={group.role} className={`team-rank-group team-member-${presentation.tier}`}>
                  {index > 0 && <FlowConnector />}
                  <div className="team-tier team-tier-dynamic">
                    {group.members.map((member) => <TeamMemberCard key={member.userId} member={member} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        <div className="team-notes">
          <Reveal delay={0.06}>
            <div className="team-copy mt-14 max-w-3xl">
              <p className="eyebrow" data-page-field="operationsEyebrow">{copy.operationsEyebrow}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                <span data-page-field="operationsTitle">{copy.operationsTitle}</span>
              </h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p data-page-field="operationsBody">{copy.operationsBody}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="team-copy mt-12 max-w-3xl">
              <p className="eyebrow" data-page-field="helpEyebrow">{copy.helpEyebrow}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl" data-page-field="helpTitle">{copy.helpTitle}</h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p data-page-field="helpBody">{copy.helpBody}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="team-copy mt-12 max-w-3xl">
              <p className="eyebrow" data-page-field="applicationsEyebrow">{copy.applicationsEyebrow}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                <span data-page-field="applicationsTitle">{copy.applicationsTitle}</span>
              </h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p data-page-field="applicationsBody">{copy.applicationsBody}</p>
                <p data-page-field="applicationsAsk">{copy.applicationsAsk}</p>
                <p data-page-field="applicationsLook">{copy.applicationsLook}</p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <div className="team-copy team-faq-block mt-12 max-w-3xl">
            <p className="eyebrow" data-page-field="faqEyebrow">{copy.faqEyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              <span data-page-field="faqTitle">{copy.faqTitle}</span>
            </h2>
            <div className="team-faq-list mt-6">
              {teamFaqs.map(({ question, answer, index }) => (
                <details
                  key={question}
                  className="team-faq-item panel rounded-2xl border border-line bg-card/95 px-5 py-4 shadow-lg transition-all hover:border-accent/40"
                >
                  <summary className="cursor-pointer list-none font-display text-sm font-bold text-ink marker:content-none sm:text-base">
                    <span data-page-field={`faq${index}Question`}>{question}</span>
                  </summary>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-muted" data-page-field={`faq${index}Answer`}>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="team-join-card">
            <div>
              <p className="eyebrow" data-page-field="ctaEyebrow">{copy.ctaEyebrow}</p>
              <h2 data-page-field="ctaTitle">{copy.ctaTitle}</h2>
              <p data-page-field="ctaBody">{copy.ctaBody}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/discord" className="btn btn-primary" data-page-field="discordCta">{copy.discordCta}</Link>
              <Link href="/support/staff-application" className="btn btn-ghost" data-page-field="applicationsCta">{copy.applicationsCta}</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
