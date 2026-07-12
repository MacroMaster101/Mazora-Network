import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitSuggestion } from "@/lib/actions/support";

export const metadata: Metadata = {
  title: "Suggest a Feature",
  description: "Share an idea to make the network better. The community can vote on suggestions.",
};

const fields: FieldConfig[] = [
  { name: "title", label: "Title", required: true, placeholder: "Your idea in one line" },
  { name: "category", label: "Category", type: "select", required: true, options: ["Gameplay", "Website", "Discord", "Events", "Store", "Other"] },
  { name: "description", label: "Describe your idea", type: "textarea", required: true, placeholder: "What should we add or change, and why?" },
];

export default function SuggestionsPage() {
  return (
    <>
      <PageHero eyebrow="Shape the network" title="Suggest a feature" lead="The best ideas come from players. Share yours — the community can upvote suggestions and staff review the favourites." />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/suggestions">
          <SupportForm action={submitSuggestion} fields={fields} submitLabel="Submit suggestion" />
        </RequireLogin>
      </section>
    </>
  );
}
