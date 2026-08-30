import { publicPageMetadata } from "@/lib/seo";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { SuggestionsClosedNotice } from "@/components/suggestions/suggestions-closed-notice";
import { FloatingBrandLogo, PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitSuggestion } from "@/lib/actions/support";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Suggest a Feature",
  description: "Share an idea to make the network better. The community can vote on suggestions.",
  path: "/support/suggestions/new",
});

const fields: FieldConfig[] = [
  { name: "title", label: "Title", required: true, placeholder: "Your idea in one line" },
  { name: "category", label: "Category", type: "select", required: true, options: ["Gameplay", "Website", "Discord", "Events", "Store", "Other"] },
  { name: "description", label: "Describe your idea", type: "textarea", required: true, placeholder: "What should we add or change, and why?" },
];

export default async function NewSuggestionPage() {
  // Runtime switch, independent of the compiled launchGates. An admin can
  // close the board from Site Settings without a deploy; posted ideas are
  // kept, just not served.
  const { suggestionsEnabled } = await getSiteGeneralSettings();
  if (!suggestionsEnabled) return <SuggestionsClosedNotice />;
  const page = (await getSupportCard("suggestions")).page!;
  return (
    <>
      <PageHero
        backLink={{ href: "/support/suggestions", label: "Back to suggestions" }}
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
        illustration={<FloatingBrandLogo />}
      />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/suggestions/new">
          <SupportForm action={submitSuggestion} fields={fields} submitLabel="Submit suggestion" />
        </RequireLogin>
      </section>
    </>
  );
}
