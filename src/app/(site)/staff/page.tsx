import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Crown, Gavel, Handshake, Shield, Sparkles, UsersRound } from "lucide-react";
import { MinecraftAvatar, Reveal } from "@/components/shared";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the people leading, managing, and supporting the Mazora Network community.",
};

type TeamMember = {
  username: string;
  alias?: string;
  role: string;
  tier: "owner" | "admin" | "senior" | "moderator" | "helper";
};

const owner: TeamMember = { username: "LilyLuvv", alias: "Mali", role: "Owner & Founder", tier: "owner" };
const admin: TeamMember = { username: "OshSparkyy", role: "Administrator", tier: "admin" };

const seniorModerators: TeamMember[] = [
  { username: "Aizenxuc", role: "Senior Moderator", tier: "senior" },
  { username: "87VX_z", role: "Senior Moderator", tier: "senior" },
];

const moderators: TeamMember[] = [
  { username: "Sanda_10", role: "Moderator", tier: "moderator" },
  { username: "Jester_X_44", role: "Moderator", tier: "moderator" },
  { username: "Hina1015", role: "Moderator", tier: "moderator" },
];

const helpers: TeamMember[] = [
  { username: "NimA391", role: "Helper", tier: "helper" },
  { username: "RASTHA125", role: "Helper", tier: "helper" },
  { username: "Chandiya", role: "Helper", tier: "helper" },
  { username: "RUSHER", role: "Helper", tier: "helper" },
];

const teamCount = 2 + seniorModerators.length + moderators.length + helpers.length;

/* Rank badge icons; the visible rank text on each card is member.role itself. */
const tierIcons = {
  owner: Crown,
  admin: BadgeCheck,
  senior: Shield,
  moderator: Gavel,
  helper: Handshake,
};

function TeamMemberCard({ member }: { member: TeamMember }) {
  const RankIcon = tierIcons[member.tier];

  return (
    <article className={`team-member-card team-member-${member.tier}`}>
      <div className="team-member-glow" aria-hidden />
      <div className="team-member-avatar-wrap">
        <MinecraftAvatar username={member.username} size={76} rounded="rounded-2xl" />
        <span className="team-member-rank-icon" aria-hidden>
          <RankIcon size={16} />
        </span>
      </div>
      <p className="team-member-tier">{member.role}</p>
      <h3>{member.username}</h3>
      {member.alias && <p className="team-member-alias">Known as {member.alias}</p>}
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
      <section className="page-hero pb-6 pt-10 sm:pb-8 sm:pt-14">
        <div className="page-hero-atmosphere" aria-hidden="true" />
        <div className="page-hero-inner shell max-w-5xl">
          <p className="eyebrow mb-2">Our Team</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">Meet the Mazora Team</h1>
          
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel rounded-2xl border border-line bg-card/95 p-5 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Sparkles size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">Our Mission</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">
                  Behind every adventure, update, and experience on Mazora is a dedicated team working to keep the network alive. From managing the server and creating content to supporting players and maintaining a friendly community, our staff team is here to make your journey the best it can be.
                </p>
              </div>

              <div className="panel rounded-2xl border border-line bg-card/95 p-5 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-accent-bright border border-accent/30">
                    <Shield size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold text-ink">Structured Hierarchy</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">
                  Our team follows a structured hierarchy, with each role carrying unique responsibilities and helping Mazora grow. Whether it&apos;s developing new features, organizing events, assisting players, or keeping the server safe and fair, every member plays an important part.
                </p>
              </div>
            </div>

            <div className="panel rounded-2xl border border-accent/35 bg-card/95 p-4 text-center backdrop-blur-xl shadow-lg">
              <p className="font-display text-sm font-extrabold text-accent-bright flex items-center justify-center gap-2">
                <UsersRound size={16} />
                Meet the people who bring Mazora to life and help shape the future of our community!
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
            <div className="team-tier team-tier-single">
              <TeamMemberCard member={owner} />
            </div>

            <FlowConnector />

            <div className="team-tier team-tier-single">
              <TeamMemberCard member={admin} />
            </div>

            <div className="team-branch team-branch-two" aria-hidden>
              <span className="team-branch-stem" />
              <span className="team-branch-rail" />
              <span className="team-branch-drop team-branch-drop-1" />
              <span className="team-branch-drop team-branch-drop-2" />
            </div>

            <div className="team-tier team-tier-seniors">
              {seniorModerators.map((member) => <TeamMemberCard key={member.username} member={member} />)}
            </div>

            <div className="team-merge team-merge-two" aria-hidden>
              <span className="team-merge-rise team-merge-rise-1" />
              <span className="team-merge-rise team-merge-rise-2" />
              <span className="team-merge-rail" />
              <span className="team-merge-stem" />
            </div>

            <div className="team-branch team-branch-three" aria-hidden>
              <span className="team-branch-stem" />
              <span className="team-branch-rail" />
              <span className="team-branch-drop team-branch-drop-1" />
              <span className="team-branch-drop team-branch-drop-2" />
              <span className="team-branch-drop team-branch-drop-3" />
            </div>

            <div className="team-tier team-tier-mods">
              {moderators.map((member) => <TeamMemberCard key={member.username} member={member} />)}
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

            <div className="team-tier team-tier-helpers">
              {helpers.map((member) => <TeamMemberCard key={member.username} member={member} />)}
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
