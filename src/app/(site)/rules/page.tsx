import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getRules } from "@/lib/data/content";
import { EmptyState, PageHero, Reveal } from "@/components/shared";
import { RuleBook } from "@/components/shared/rule-book";

export const metadata: Metadata = {
  title: "Rules",
  description: "The community rules that keep the network fair, friendly and fun for everyone.",
};

export default async function RulesPage() {
  const categories = await getRules();
  const latest = categories.reduce((acc, c) => (c.updated > acc ? c.updated : acc), categories[0]?.updated ?? "");
  // Only claim an update date when there is actually a rule to date.
  const updatedLabel =
    latest && !Number.isNaN(new Date(latest).getTime())
      ? `Last updated ${new Date(latest).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}`
      : "Community rules";

  return (
    <>
      <PageHero
        eyebrow={updatedLabel}
        title="Play fair. Have fun."
        lead="Our rules exist to keep the network welcoming and competitive. Read them once — they take five minutes and save a lot of headaches."
      />
      <section className="section shell">
        <Reveal>
          {categories.length > 0 ? (
            <RuleBook categories={categories} />
          ) : (
            <EmptyState
              icon={<ScrollText size={24} />}
              title="Rules are being written"
              message="The community rulebook will be published here. Until then, ask staff in Discord if you are unsure about anything."
              cta={{ label: "Ask in Discord", href: "/discord" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
