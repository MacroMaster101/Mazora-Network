import type { Metadata } from "next";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { FloatingBrandLogo, GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata: Metadata = {
  title: "Ban & Mute Appeal",
  description: "Appeal a punishment on the Mazora Network.",
};

export default async function AppealPage() {
  const [config, supportCard] = await Promise.all([getFormsConfig(), getSupportCard("appeal")]);
  const form = config.appeals;
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
                <Clock size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Review Timeframe</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">Most ban and mute appeals are reviewed within 24 to 48 hours by our staff team.</p>
          </div>
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                <ShieldAlert size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Punishment Reason</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">Copy the exact kick/ban reason shown on screen when connecting to the server.</p>
          </div>
          <div className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                <CheckCircle2 size={20} />
              </span>
              <h3 className="font-display text-base font-bold text-ink">Proof & Evidence</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted font-medium">Providing unedited screenshot or video proof links speeds up the decision process.</p>
          </div>
        </div>

        <GoogleFormEmbed
          formUrl={form.publicUrl}
          title="Ban & Mute Appeal Form"
          subtitle="Official Appeals Intake"
          description={form.enabled ? "Click below to open the official Google Form and submit your punishment review request." : "Appeals intake is currently paused. Please check back later."}
          buttonText={form.enabled ? "Open Appeal Form" : "Intake Paused"}
          disabled={!form.enabled}
          bulletPoints={page.details}
        />
      </section>
    </>
  );
}
