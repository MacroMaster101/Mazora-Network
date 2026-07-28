import type { Metadata } from "next";
import { Bell, Gift, LifeBuoy, MessagesSquare, Users2, Swords } from "lucide-react";
import { site } from "@/lib/site";
import { getDiscordStats } from "@/lib/data/discord";
import { withCommas } from "@/lib/utils";
import { PageHero, Reveal } from "@/components/shared";
import { DiscordIcon } from "@/components/shared/icon";

export const metadata: Metadata = {
  title: "Discord",
  description: `Join the ${site.name} Discord — announcements, giveaways, event info, support and a great community.`,
};

const benefits = [
  { icon: Bell, title: "Announcements first", copy: "Updates, patch notes and maintenance windows land here before anywhere else." },
  { icon: Gift, title: "Giveaways", copy: "Regular drops of ranks, coins, cosmetics and crate keys for active members." },
  { icon: Swords, title: "Event info", copy: "Sign-ups, brackets and live results for every tournament and build contest." },
  { icon: LifeBuoy, title: "Support", copy: "Quick help from the community and a direct line to staff when you need it." },
  { icon: Users2, title: "Find teammates", copy: "LFG channels for every mode — never raid, build or compete alone." },
  { icon: MessagesSquare, title: "Community", copy: "Share builds, swap tips, and hang out with other Mazora players." },
];

export default async function DiscordPage() {
  const discord = await getDiscordStats();
  const eyebrow = discord.live
    ? `${withCommas(discord.members)} members · ${withCommas(discord.online)} online`
    : "Mazora community";

  return (
    <>
      <PageHero eyebrow={eyebrow} title="The community lives on Discord." lead="It's where the network really comes alive. Announcements, giveaways, teammates and support — all in one place." />
      <section className="section shell">
        <Reveal className="glass relative overflow-hidden p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(40rem_20rem_at_50%_0%,rgba(88,101,242,0.18),transparent_60%)]" />
          <div className="relative">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#5865F2]/15 text-[#8b94f5]">
              <DiscordIcon size={30} />
            </span>
            <h2 className="mx-auto mt-4 max-w-xl text-3xl font-bold">Join {site.name} on Discord</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">Free, instant, and the fastest way to plug into everything happening on the network.</p>
            <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-primary mt-6">
              <DiscordIcon size={16} /> Join the Discord
            </a>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.04} className="panel p-6">
              <b.icon size={22} className="text-accent-bright" />
              <h3 className="mt-4 font-display text-lg font-bold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{b.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
