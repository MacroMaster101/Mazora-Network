import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { RequireLogin } from "@/components/shared/require-login";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitStaffApplication } from "@/lib/actions/support";

export const metadata: Metadata = {
  title: "Staff Application",
  description: "Apply to join the Mazora Network staff team.",
};

const fields: FieldConfig[] = [
  { name: "minecraftUsername", label: "Minecraft username", required: true, placeholder: "Your in-game name" },
  { name: "age", label: "Age", required: true, placeholder: "Your age" },
  { name: "role", label: "Role", type: "select", required: true, options: ["Helper", "Moderator", "Builder", "Developer", "Content creator"] },
  { name: "timezone", label: "Timezone", required: true, placeholder: "For example: GMT+5:30" },
  { name: "experience", label: "Relevant experience", type: "textarea", required: true, placeholder: "Tell us about communities, servers or teams you have helped before…" },
  { name: "motivation", label: "Why Mazora?", type: "textarea", required: true, placeholder: "Why do you want to join our team, and what would you bring?" },
  { name: "availability", label: "Weekly availability", type: "textarea", required: true, placeholder: "Which days and times are you usually available?" },
];

export default function StaffApplicationPage() {
  return (
    <>
      <PageHero
        eyebrow="Join the crew"
        title="Help build the next chapter."
        lead="Mazora is community-run. If you are patient, dependable and excited to help players, we would like to hear from you."
      />
      <section className="section shell max-w-2xl">
        <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/5 p-5 text-sm text-muted">
          Applications are reviewed manually. Please be honest and make sure your Discord account can receive messages from server members.
        </div>
        <RequireLogin next="/support/staff-application">
          <SupportForm action={submitStaffApplication} fields={fields} submitLabel="Send application" />
        </RequireLogin>
      </section>
    </>
  );
}
