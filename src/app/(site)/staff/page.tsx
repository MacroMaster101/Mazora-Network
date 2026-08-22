import { breadcrumbSchema, faqPageSchema, jsonLdGraph, publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Crown, Gavel, Handshake, Shield, Sparkles, UsersRound } from "lucide-react";
import { FloatingBrandLogo, MinecraftAvatar, RanksHelpPopover, Reveal } from "@/components/shared";
import { JsonLd } from "@/components/shared/json-ld";
import { roleLabel, STAFF_ROLES } from "@/lib/auth";
import { listPublicStaffAccounts, type PublicStaffMember } from "@/lib/data/accounts";
import type { Role } from "@/lib/types";

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

/**
 * Rendered as visible <details> below *and* emitted as FAQPage markup. Google
 * drops FAQ rich results whose answers are not present on the page, so these
 * two must come from this one array — never from two hand-kept copies.
 *
 * Deliberately scoped to the team itself. /support already ships its own FAQ
 * (support.main settings) covering appeal timing, ticket privacy and store
 * problems; repeating those questions here would put the site in competition
 * with itself for the same queries.
 */
const TEAM_FAQS = [
  {
    question: "Do Mazora Network staff members get paid?",
    answer:
      "No. Mazora is community-run, and every member of the team is a volunteer from the player community.",
  },
  {
    question: "How do I become a staff member on Mazora Network?",
    answer:
      "Through the official staff application form, linked from this page and the Support Center. It asks for your Minecraft username, age, timezone and weekly availability, the role you are applying for, any relevant moderation, building, development or community experience, and why you want to join Mazora. Applications are reviewed by staff management, and the form shows as closed when recruitment is paused.",
  },
  {
    question: "Will Mazora staff ever ask for my password?",
    answer:
      "No. Staff will never ask for your password, recovery codes, or full payment details, and you should never share them in a ticket or anywhere else — even with someone claiming to be staff.",
  },
];

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
  const members = await listPublicStaffAccounts();
  const groups = LADDER.map((role) => ({
    role,
    members: (members ?? []).filter((member) => member.role === role),
  })).filter((group) => group.members.length > 0);
  const teamCount = members?.length ?? 0;

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbSchema([{ name: "Our Team", path: "/staff" }]),
          faqPageSchema("/staff", TEAM_FAQS),
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
            <p className="eyebrow mb-2 mt-1">Our Team</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">Meet the Mazora Team</h1>
            <p className="team-hero-lead mt-4 max-w-2xl text-sm font-medium leading-relaxed sm:text-base">
              The people behind every update, event, support request, and safe adventure across the Mazora Network.
              Mazora is community-run — every member of the team is a volunteer from the player community, and each
              public rank has a defined scope, so you always know who handles what.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Sparkles size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">Our Mission</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">
                  Build memorable experiences, improve the network, and make every player&apos;s journey worth returning to.
                </p>
              </div>

              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Shield size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">Safe &amp; Fair</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">
                  Protect the community, apply the rules consistently, and give every report the attention it deserves.
                </p>
              </div>

              <div className="panel rounded-2xl border border-line bg-card/95 p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-accent/40">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <UsersRound size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">Community First</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">
                  Listen to player feedback, offer clear support, and create a welcoming place for everyone to play.
                </p>
              </div>
          </div>
        </div>
      </section>

      <section className="team-org-section shell pb-20 pt-4">
        <Reveal>
          <div className="team-org-heading">
            <div>
              <p className="eyebrow">Network hierarchy</p>
              <h2>Meet the team, from leadership to community.</h2>
            </div>
            <span className="team-count-chip"><UsersRound size={15} /> {teamCount} team members</span>
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
                <h3>Team directory is temporarily unavailable</h3>
                <p>Please check back shortly.</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="team-empty-state">
                <UsersRound size={26} />
                <h3>Our team profiles are being prepared</h3>
                <p>Staff members will appear here as their public profiles are enabled.</p>
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
              <p className="eyebrow">How we operate</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                Five ranks, one escalation path
              </h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p>
                  Every issue on Mazora enters the team the same way and moves up only as far as it needs to. Helpers
                  handle the everyday questions — how a game mode works, where to find a rule, why a command is not
                  behaving. Anything involving player conduct goes to a Moderator, who reviews the evidence against the
                  network rules.
                </p>
                <p>
                  Senior Moderators take the cases a single moderator should not decide alone: disputes between
                  long-standing players, and anything where the right outcome is not obvious from the rules text.
                  Administrators own the operational side — staff coordination, server configuration, and decisions that
                  affect the network rather than an individual player. Ownership sets direction and has the final say on
                  policy.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="team-copy mt-12 max-w-3xl">
              <p className="eyebrow">Getting help</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">How to reach us</h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p>
                  Whichever rank ends up handling your issue, how you reach us depends on what you need. Player reports,
                  bug reports, and store or payment problems go to a <Link href="/support/ticket" className="team-copy-link">private Discord ticket</Link>,
                  so you can share evidence confidentially. <Link href="/support/appeal" className="team-copy-link">Appeals</Link> and
                  {" "}<Link href="/support/staff-application" className="team-copy-link">applications</Link> go through official forms.
                  {" "}<Link href="/support/suggestions" className="team-copy-link">Feature suggestions</Link> are submitted on the site
                  so the community can vote on them.
                </p>
                <p>
                  Please do not confront a reported player directly, and do not post evidence publicly — use a ticket so
                  the moderation team can handle it privately. The{" "}
                  <Link href="/support" className="team-copy-link">Support Center</Link> lists every option in one place, and the{" "}
                  <Link href="/rules" className="team-copy-link">network rules</Link> explain what we act on.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="team-copy mt-12 max-w-3xl">
              <p className="eyebrow">Grow with us</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                How staff applications work
              </h2>
              <div className="mt-5 space-y-4 text-sm font-medium leading-relaxed text-muted sm:text-base">
                <p>
                  Mazora is community-run. If you are patient, dependable, and excited to help players, we would like to
                  hear from you. Applications go through our official staff application form, which opens and closes as
                  the team needs people — when recruitment is paused the form shows as closed rather than disappearing,
                  so it is worth checking back.
                </p>
                <p>
                  <strong className="text-ink">What the application asks for:</strong> your exact Minecraft username,
                  age, timezone, and weekly availability; the role you are applying for; any relevant moderation,
                  building, development, or community experience; and why you want to join Mazora and how you will help
                  players.
                </p>
                <p>
                  <strong className="text-ink">What we look for:</strong> consistent activity, a clean record, and the
                  patience to answer the same question for the twentieth time without losing your tone. Prior staff
                  experience elsewhere is useful context, not a shortcut. Keep everything you submit accurate —
                  applications are reviewed by staff management.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <div className="team-copy team-faq-block mt-12 max-w-3xl">
            <p className="eyebrow">Common questions</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              About the team
            </h2>
            <div className="team-faq-list mt-6">
              {TEAM_FAQS.map(({ question, answer }) => (
                <details
                  key={question}
                  className="team-faq-item panel rounded-2xl border border-line bg-card/95 px-5 py-4 shadow-lg transition-all hover:border-accent/40"
                >
                  <summary className="cursor-pointer list-none font-display text-sm font-bold text-ink marker:content-none sm:text-base">
                    {question}
                  </summary>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="team-join-card">
            <div>
              <p className="eyebrow">Grow with us</p>
              <h2>Want to help shape the next chapter?</h2>
              <p>Join the community, get involved, and watch for future staff opportunities.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/discord" className="btn btn-primary">Join Discord</Link>
              <Link href="/support/staff-application" className="btn btn-ghost">Staff applications</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
