import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Crown, Gavel, Handshake, Shield, Sparkles, UsersRound } from "lucide-react";
import { FloatingBrandLogo, MinecraftAvatar, Reveal } from "@/components/shared";
import { roleLabel, STAFF_ROLES } from "@/lib/auth";
import { listPublicStaffAccounts, type PublicStaffMember } from "@/lib/data/accounts";
import type { Role } from "@/lib/types";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the people leading, managing, and supporting the Mazora Network community.",
};

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
            <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/75 sm:text-base">
              The people behind every update, event, support request, and safe adventure across the Mazora Network.
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
              const RankIcon = presentation.icon;

              return (
                <div key={group.role} className={`team-rank-group team-member-${presentation.tier}`}>
                  {index > 0 && <FlowConnector />}
                  <div className="team-rank-label">
                    <span className="team-rank-label-icon" aria-hidden><RankIcon size={17} /></span>
                    <div>
                      <div className="team-rank-label-title">
                        <h3>{roleLabel(group.role)}</h3>
                        <span>{group.members.length} {group.members.length === 1 ? "member" : "members"}</span>
                      </div>
                      <p>{roleSummary[group.role]}</p>
                    </div>
                  </div>
                  <div className="team-tier team-tier-dynamic">
                    {group.members.map((member) => <TeamMemberCard key={member.userId} member={member} />)}
                  </div>
                </div>
              );
            })}
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
