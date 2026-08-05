import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitPlayerReport } from "@/lib/actions/support";

export const metadata: Metadata = {
  title: "Report a Player",
  description: "Report a player for cheating, harassment, scamming or other rule-breaking.",
};

const fields: FieldConfig[] = [
  { name: "reportedUsername", label: "Reported player's username", required: true, placeholder: "Who are you reporting?" },
  { name: "category", label: "Category", type: "select", required: true, options: ["Cheating", "Hacking", "Harassment", "Chat Abuse", "Scamming", "Exploiting", "Griefing", "Other"] },
  { name: "description", label: "What happened?", type: "textarea", required: true, hint: "Include when and where", placeholder: "Describe the incident…" },
  { name: "evidenceUrl", label: "Evidence link (screenshot/clip)", type: "url", placeholder: "https://…" },
];

export default function ReportPlayerPage() {
  return (
    <>
      <PageHero backLink={{ href: "/support", label: "Back to Support" }} eyebrow="Support" title="Report a player" lead="Help us keep the network fair. Reports are private — only you and staff can see them." />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/report-player">
          <SupportForm action={submitPlayerReport} fields={fields} submitLabel="Submit report" />
        </RequireLogin>
      </section>
    </>
  );
}
