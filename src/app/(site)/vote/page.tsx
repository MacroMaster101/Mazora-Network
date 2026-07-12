import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Flame, Gift } from "lucide-react";
import { getVoteSites } from "@/lib/data/content";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";
import { PageHero, Reveal } from "@/components/shared";

export const metadata: Metadata = {
  title: "Vote",
  description: `Vote for ${site.name} every day to earn coins, crate keys and rewards — and help more players find us.`,
};

export default async function VotePage() {
  const [sites, session] = await Promise.all([getVoteSites(), getSession()]);

  return (
    <>
      <PageHero eyebrow="Support the server" title="Vote daily. Earn rewards." lead="Voting takes seconds, costs nothing, and helps new players discover the network. Each site rewards you every day." />
      <section className="section shell">
        {session ? (
          <Reveal className="glass mb-8 grid gap-4 p-6 sm:grid-cols-4">
            {[
              ["Total votes", "128"],
              ["This month", "14"],
              ["Current streak", "6 days"],
              ["Rewards earned", "32 keys"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
                <div className="telemetry mt-1 text-2xl font-bold">{value}</div>
              </div>
            ))}
            <p className="col-span-full text-xs text-muted">
              Voting history is illustrative until a vote-listing callback is connected to your linked Minecraft account.
            </p>
          </Reveal>
        ) : (
          <Reveal className="glass mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="text-sm text-muted">Log in and link your Minecraft account to track streaks and collect rewards automatically.</p>
            <Link href="/login" className="btn btn-ghost btn-sm">
              Log in to track votes
            </Link>
          </Reveal>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((v, i) => (
            <Reveal key={v.id} delay={i * 0.04} className="panel panel-hover flex flex-col p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
                  <Flame size={20} />
                </span>
                <div>
                  <h3 className="font-display font-bold">{v.name}</h3>
                  <p className="telemetry text-xs text-muted">every {v.cooldownHours}h</p>
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-gold">
                <Gift size={15} /> {v.reward}
              </p>
              <a href={v.url} target="_blank" rel="noreferrer" className="btn btn-primary mt-5 w-full">
                Vote now <ExternalLink size={15} />
              </a>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
