import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitBugReport } from "@/lib/actions/support";

export const metadata: Metadata = {
  title: "Report a Bug",
  description: "Found a bug? Report it so we can fix it fast.",
};

const fields: FieldConfig[] = [
  { name: "title", label: "Bug title", required: true, placeholder: "Short summary of the bug" },
  { name: "gameMode", label: "Game mode", type: "select", options: ["Survival SMP", "Skyblock", "Lifesteal", "OneBlock", "KitPvP", "Creative", "Website", "Other"] },
  { name: "description", label: "Description", type: "textarea", required: true, placeholder: "What went wrong?" },
  { name: "reproductionSteps", label: "Steps to reproduce", type: "textarea", hint: "1, 2, 3…", placeholder: "1. …\n2. …" },
  { name: "minecraftVersion", label: "Minecraft version", placeholder: "e.g. 1.21.11" },
  { name: "evidenceUrl", label: "Screenshot or video URL", type: "url", placeholder: "https://…" },
];

export default function ReportBugPage() {
  return (
    <>
      <PageHero eyebrow="Support" title="Report a bug" lead="The more detail you give, the faster we can reproduce and fix it. Thank you for helping." />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/report-bug">
          <SupportForm action={submitBugReport} fields={fields} submitLabel="Submit bug report" />
        </RequireLogin>
      </section>
    </>
  );
}
