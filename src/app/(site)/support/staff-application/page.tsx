import { publicPageMetadata } from "@/lib/seo";
import { Shield, Sparkles, UsersRound } from "lucide-react";
import { FloatingBrandLogo, GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Staff Application",
  description: "Apply to join the Mazora Network staff team.",
  path: "/support/staff-application",
});

export default async function StaffApplicationPage() {
  const [config, supportCard] = await Promise.all([getFormsConfig(), getSupportCard("staff")]);
  const form = config.staff;
  const page = supportCard.page!;

  return (
    <>
      <PageHero
        backLink={{ href: "/support", label: "Back to Support" }}
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
        illustration={<FloatingBrandLogo />}
      />
      <section className="shell pt-4 pb-20 space-y-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                <Shield size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Role Selection</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">Apply for Helper, Moderator, Builder, or Developer depending on your skills and interest.</p>
          </div>
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                <UsersRound size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Availability & Timezone</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">State your timezone and weekly active hours so staff management can coordinate coverage.</p>
          </div>
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                <Sparkles size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Experience & Motivation</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">Detail past moderation or community experience and explain why you want to join Mazora.</p>
          </div>
        </div>

        <GoogleFormEmbed
          formUrl={form.publicUrl}
          title="Staff Application Form"
          subtitle="Official Staff Recruitment"
          description={form.enabled ? "Click below to open the official Google Form and apply for a staff position on Mazora Network." : "Staff applications are currently closed. Please check back later."}
          buttonText={form.enabled ? "Open Staff Application" : "Recruitment Closed"}
          disabled={!form.enabled}
          bulletPoints={page.details}
        />
      </section>
    </>
  );
}
