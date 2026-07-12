import type { Metadata } from "next";
import Link from "next/link";
import { Bug, CreditCard, Gavel, Lightbulb, LifeBuoy, ShieldAlert, Ticket, ArrowRight } from "lucide-react";
import { PageHero, Reveal } from "@/components/shared";
import { Accordion } from "@/components/ui";

export const metadata: Metadata = {
  title: "Support Center",
  description: "Open a ticket, appeal a ban, report a player, report a bug, or suggest a feature.",
};

const options = [
  { icon: Ticket, title: "Open a support ticket", copy: "Account, technical or general help from the team.", href: "/dashboard/tickets" },
  { icon: Gavel, title: "Ban appeal", copy: "Think a punishment was a mistake? Ask us to review it.", href: "/support/appeal" },
  { icon: ShieldAlert, title: "Report a player", copy: "Cheating, harassment, scamming or griefing.", href: "/support/report-player" },
  { icon: Bug, title: "Report a bug", copy: "Found something broken? Help us fix it.", href: "/support/report-bug" },
  { icon: Lightbulb, title: "Suggest a feature", copy: "Got an idea to make the network better?", href: "/support/suggestions" },
  { icon: CreditCard, title: "Payment support", copy: "Questions about a purchase or the store.", href: "/dashboard/tickets" },
];

const faqs = [
  { q: "How long do ban appeals take?", a: "Most appeals are reviewed within 48 hours. You'll get a notification the moment a decision is made." },
  { q: "Who can see my report?", a: "Only you and authorised staff can see the reports and tickets you submit. Other players never see them." },
  { q: "I bought something but didn't receive it.", a: "Open a ticket under the Payment category with your order details and we'll sort it out quickly." },
  { q: "Can I appeal more than once?", a: "You can appeal each punishment once. Spamming appeals may pause your ability to submit new ones." },
];

export default function SupportPage() {
  return (
    <>
      <PageHero eyebrow="We're here to help" title="Support center" lead="Pick the option that fits. Most requests are handled within a day by real people who play here too.">
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <LifeBuoy size={16} className="text-accent-bright" /> Average first response: under 24 hours
        </span>
      </PageHero>

      <section className="section shell">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((o, i) => (
            <Reveal key={o.title} delay={i * 0.04}>
              <Link href={o.href} className="panel panel-hover group flex h-full flex-col p-6">
                <o.icon size={22} className="text-accent-bright" />
                <h3 className="mt-4 font-display text-lg font-bold">{o.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted">{o.copy}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  Continue <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <h2 className="text-2xl font-bold">Common questions</h2>
          <Accordion className="mt-6" items={faqs} />
        </Reveal>
      </section>
    </>
  );
}
