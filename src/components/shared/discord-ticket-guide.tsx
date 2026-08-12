import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, MessageSquarePlus, ShieldCheck, UserPlus } from "lucide-react";
import { site } from "@/lib/site";
import { DiscordIcon } from "./icon";
import { FloatingBrandLogo } from "./floating-brand-logo";
import { PageHero } from "./page-hero";

type DiscordTicketGuideProps = {
  eyebrow: string;
  title: string;
  lead: string;
  ticketType: string;
  details: string[];
  privacyNote: string;
};

export function DiscordTicketGuide({
  eyebrow,
  title,
  lead,
  ticketType,
  details,
  privacyNote,
}: DiscordTicketGuideProps) {
  return (
    <>
      <PageHero
        backLink={{ href: "/support", label: "Back to Support" }}
        eyebrow={eyebrow}
        title={title}
        lead={lead}
        illustration={<FloatingBrandLogo />}
      />

      <section className="shell pb-24 pt-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-start">
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/15 text-accent-bright">
                <CheckCircle2 size={22} />
              </span>
              <div>
                <p className="eyebrow">Before you create the ticket</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">Have these details ready</h2>
              </div>
            </div>

            <ul className="mt-7 space-y-3">
              {details.map((detail) => (
                <li key={detail} className="flex gap-3 rounded-xl border border-line/70 bg-surface/45 px-4 py-3 text-sm font-medium leading-relaxed text-muted">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent-bright" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
              <p className="text-sm font-medium leading-relaxed text-muted">{privacyNote}</p>
            </div>
          </div>

          <aside className="panel overflow-hidden rounded-2xl border border-accent/30 bg-card/95 shadow-xl backdrop-blur-xl">
            <div className="border-b border-line bg-accent/10 p-6 sm:p-7">
              <p className="eyebrow">Discord ticket desk</p>
              <h2 className="mt-2 font-display text-xl font-extrabold text-ink">Create a {ticketType} ticket</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
                Tickets are handled in the official Mazora Discord so you can speak privately with staff and share evidence safely.
              </p>
            </div>

            <div className="space-y-5 p-6 sm:p-7">
              <ol className="space-y-4 text-sm font-medium text-muted">
                <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-white">1</span><span>Log in to Discord or create a free Discord account.</span></li>
                <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-white">2</span><span>Join the Mazora Network Discord server if you have not joined yet.</span></li>
                <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-white">3</span><span>Open the ticket channel, click <strong className="text-ink">Create ticket</strong>, and send the details listed here.</span></li>
              </ol>

              <a href={site.discordSupportTickets} target="_blank" rel="noreferrer" className="btn btn-primary w-full">
                <MessageSquarePlus size={17} /> Open ticket channel <ExternalLink size={15} />
              </a>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <a href="https://discord.com/register" target="_blank" rel="noreferrer" className="btn btn-ghost justify-center text-center">
                  <UserPlus size={16} /> Create Discord
                </a>
                <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-ghost justify-center text-center">
                  <DiscordIcon size={16} /> Join server
                </a>
              </div>

              <p className="text-center text-xs leading-relaxed text-muted">
                Already joined? Go straight to the ticket channel. Discord may ask you to log in before it opens.
              </p>
              <Link href="/support" className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-accent-bright hover:underline">
                Choose another support option <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
