import type { Metadata } from "next";
import { getRules } from "@/lib/data/content";
import { PageHero, Reveal } from "@/components/shared";
import { RuleBook } from "@/components/shared/rule-book";

export const metadata: Metadata = {
  title: "Rules",
  description: "The community rules that keep the network fair, friendly and fun for everyone.",
};

export default async function RulesPage() {
  const categories = await getRules();
  const latest = categories.reduce((acc, c) => (c.updated > acc ? c.updated : acc), categories[0]?.updated ?? "");

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${new Date(latest).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}`}
        title="Play fair. Have fun."
        lead="Our rules exist to keep the network welcoming and competitive. Read them once — they take five minutes and save a lot of headaches."
      />
      <section className="section shell">
        <Reveal>
          <RuleBook categories={categories} />
        </Reveal>
      </section>
    </>
  );
}
