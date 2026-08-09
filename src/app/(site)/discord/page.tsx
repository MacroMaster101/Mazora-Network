import type { Metadata } from "next";
import Image from "next/image";
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
      <PageHero
        eyebrow={eyebrow}
        title="The community lives on Discord."
        lead="It's where the network really comes alive. Announcements, giveaways, teammates and support — all in one place."
        illustration={
          <div className="relative group">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={240}
              height={160}
              priority
              className="h-auto w-32 md:w-[240px] animate-float object-contain drop-shadow-[0_15px_35px_rgba(139,92,246,0.35)] transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        }
      />
      <section className="section shell">
        <Reveal className="glass relative overflow-hidden p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(40rem_20rem_at_50%_0%,rgba(88,101,242,0.18),transparent_60%)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="flex flex-col items-center">
              <div className="group relative grid h-20 w-20 place-items-center">
                <span aria-hidden className="absolute inset-0 rounded-[1.375rem] bg-[#5865F2] opacity-40 blur-xl transition-opacity duration-500 group-hover:opacity-70" />
                <span className="relative grid h-full w-full place-items-center rounded-[1.375rem] bg-gradient-to-br from-[#5865F2] to-[#4752C4] text-white ring-1 ring-white/20 transition-transform duration-500 group-hover:scale-105">
                  <DiscordIcon size={36} />
                </span>
              </div>
              <h2 className="mt-5 max-w-xl text-3xl font-bold">Join {site.name} on Discord</h2>
              <p className="mt-2 max-w-md text-muted">Free, instant, and the fastest way to plug into everything happening on the network.</p>
              <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-primary mt-6">
                <DiscordIcon size={16} /> Join the Discord
              </a>
            </div>
            <div className="mx-auto w-full max-w-[350px] overflow-hidden rounded-2xl border border-line bg-[#202225] shadow-2xl">
              <iframe
                title="Mazora Network Discord server"
                src="https://discord.com/widget?id=805453071261237286&theme=dark"
                width="350"
                height="500"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="block h-[500px] w-full"
              />
            </div>
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
