import type { Metadata } from "next";
import { FloatingBrandLogo, PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitSuggestion } from "@/lib/actions/support";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata: Metadata = {
  title: "Suggest a Feature",
  description: "Share an idea to make the network better. The community can vote on suggestions.",
};

const fields: FieldConfig[] = [
  { name: "title", label: "Title", required: true, placeholder: "Your idea in one line" },
  { name: "category", label: "Category", type: "select", required: true, options: ["Gameplay", "Website", "Discord", "Events", "Store", "Other"] },
  { name: "description", label: "Describe your idea", type: "textarea", required: true, placeholder: "What should we add or change, and why?" },
];

export default async function SuggestionsPage() {
  const page = (await getSupportCard("suggestions")).page!;
  return (
    <>
      <PageHero backLink={{ href: "/support", label: "Back to Support" }} eyebrow={page.eyebrow} title={page.title} lead={page.lead} illustration={<FloatingBrandLogo />} />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/suggestions">
          <SupportForm action={submitSuggestion} fields={fields} submitLabel="Submit suggestion" />
        </RequireLogin>
      </section>
    </>
  );
}
