import { publicPageMetadata } from "@/lib/seo";
import { ScrollText } from "lucide-react";
import { getRules } from "@/lib/data/content";
import { EmptyState, PageHero, Reveal, LegalHeroIllustration } from "@/components/shared";
import { RuleBook } from "@/components/shared/rule-book";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Rules",
  description: "The community rules that keep the network fair, friendly and fun for everyone.",
  path: "/rules",
});

export default async function RulesPage() {
  const [categories, copy] = await Promise.all([getRules(), getPageContent("rules")]);
  const latest = categories.reduce((acc, c) => (c.updated > acc ? c.updated : acc), categories[0]?.updated ?? "");
  const updatedLabel =
    latest && !Number.isNaN(new Date(latest).getTime())
      ? `Last updated ${new Date(latest).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : copy.fallbackEyebrow;

  return (
    <>
      <PageHero
        eyebrow={updatedLabel}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ eyebrow: latest ? undefined : "fallbackEyebrow", title: "heroTitle", lead: "heroLead" }}
        illustration={<LegalHeroIllustration />}
      />
      <section className="section shell">
        <Reveal>
          {categories.length > 0 ? (
            <RuleBook categories={categories} />
          ) : (
            <EmptyState
              icon={<ScrollText size={24} />}
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/discord" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
