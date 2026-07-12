import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitAppeal } from "@/lib/actions/support";

export const metadata: Metadata = {
  title: "Ban Appeal",
  description: "Appeal a punishment on the network.",
};

const fields: FieldConfig[] = [
  { name: "minecraftUsername", label: "Minecraft username", required: true, placeholder: "Your in-game name" },
  { name: "punishmentType", label: "Punishment type", type: "select", required: true, options: ["Ban", "Temp-ban", "Mute", "Warning", "Other"] },
  { name: "punishmentReason", label: "Reason shown for the punishment", placeholder: "What did the message say?" },
  { name: "appealText", label: "Why should it be removed?", type: "textarea", required: true, hint: "Be honest and specific", placeholder: "Explain your side…" },
  { name: "evidenceUrl", label: "Evidence link (optional)", type: "url", placeholder: "https://…" },
];

export default function AppealPage() {
  return (
    <>
      <PageHero eyebrow="Support" title="Ban appeal" lead="Made a mistake, or think we did? Appeal here and a moderator will review it — usually within 48 hours." />
      <section className="section shell max-w-2xl">
        <RequireLogin next="/support/appeal">
          <SupportForm action={submitAppeal} fields={fields} submitLabel="Submit appeal" />
        </RequireLogin>
      </section>
    </>
  );
}
