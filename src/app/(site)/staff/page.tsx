import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Crown, Handshake, Shield, UsersRound } from "lucide-react";
import { MinecraftAvatar, PageHero, Reveal } from "@/components/shared";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the people leading, managing, and supporting the Mazora Network community.",
};

type TeamMember = {
  username: string;
  alias?: string;
  role: string;
  tier: "owner" | "management" | "admin" | "community";
};

const owner: TeamMember = { username: "LilyLuvv", alias: "Maali", role: "Owner & Founder", tier: "owner" };
const manager: TeamMember = { username: "OshSparkyy", role: "Network Management", tier: "management" };

const administrators: TeamMember[] = [
  { username: "87VX_z", role: "Administrator", tier: "admin" },
  { username: "AIZENxuc", role: "Administrator", tier: "admin" },
  { username: "Hina1015", role: "Administrator", tier: "admin" },
];

const communityTeam: TeamMember[] = [
  { username: "Sanda_10", role: "Community Staff", tier: "community" },
  { username: "Chandiya", role: "Community Staff", tier: "community" },
  { username: "SHASHIYA", role: "Community Staff", tier: "community" },
  { username: "NimA391", role: "Community Staff", tier: "community" },
];

const tierMeta = {
  owner: { icon: Crown, label: "Leadership" },
  management: { icon: BadgeCheck, label: "Management" },
  admin: { icon: Shield, label: "Administration" },
  community: { icon: Handshake, label: "Community Team" },
};

function TeamMemberCard({ member }: { member: TeamMember }) {
  const meta = tierMeta[member.tier];
  const RankIcon = meta.icon;

  return (
    <article className={`team-member-card team-member-${member.tier}`}>
      <div className="team-member-glow" aria-hidden />
      <div className="team-member-avatar-wrap">
        <MinecraftAvatar username={member.username} size={76} rounded="rounded-2xl" />
        <span className="team-member-rank-icon" aria-hidden>
          <RankIcon size={16} />
        </span>
      </div>
      <p className="team-member-tier">{meta.label}</p>
      <h3>{member.username}</h3>
      {member.alias && <p className="team-member-alias">Known as {member.alias}</p>}
      <p className="team-member-role">{member.role}</p>
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

export default function StaffPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Team"
        title="The people behind Mazora."
        lead="One connected team building the worlds, systems, and community that keep the network moving forward."
      />

      <section className="team-org-section section shell">
        <Reveal>
          <div className="team-org-heading">
            <div>
              <p className="eyebrow">Network hierarchy</p>
              <h2>Meet the team, from leadership to community.</h2>
            </div>
            <span className="team-count-chip"><UsersRound size={15} /> 9 team members</span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="team-org-chart" aria-label="Mazora Network team hierarchy">
            <div className="team-tier team-tier-single">
              <TeamMemberCard member={owner} />
            </div>

            <FlowConnector />

            <div className="team-tier team-tier-single">
              <TeamMemberCard member={manager} />
            </div>

            <div className="team-branch team-branch-three" aria-hidden>
              <span className="team-branch-stem" />
              <span className="team-branch-rail" />
              <span className="team-branch-drop team-branch-drop-1" />
              <span className="team-branch-drop team-branch-drop-2" />
              <span className="team-branch-drop team-branch-drop-3" />
            </div>

            <div className="team-tier-label"><Shield size={14} /> Administration</div>
            <div className="team-tier team-tier-admins">
              {administrators.map((member) => <TeamMemberCard key={member.username} member={member} />)}
            </div>

            <div className="team-merge team-merge-three" aria-hidden>
              <span className="team-merge-rise team-merge-rise-1" />
              <span className="team-merge-rise team-merge-rise-2" />
              <span className="team-merge-rise team-merge-rise-3" />
              <span className="team-merge-rail" />
              <span className="team-merge-stem" />
            </div>

            <div className="team-branch team-branch-four" aria-hidden>
              <span className="team-branch-stem" />
              <span className="team-branch-rail" />
              <span className="team-branch-drop team-branch-drop-1" />
              <span className="team-branch-drop team-branch-drop-2" />
              <span className="team-branch-drop team-branch-drop-3" />
              <span className="team-branch-drop team-branch-drop-4" />
            </div>

            <div className="team-tier-label"><Handshake size={14} /> Community Team</div>
            <div className="team-tier team-tier-community">
              {communityTeam.map((member) => <TeamMemberCard key={member.username} member={member} />)}
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
