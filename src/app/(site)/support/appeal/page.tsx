import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";

export const metadata: Metadata = {
  title: "Ban & Mute Appeal",
  description: "Appeal a punishment on the Mazora Network.",
};

export default async function AppealPage() {
  const config = await getFormsConfig();
  const form = config.appeals;

  return (
    <>
      <PageHero
        eyebrow="Support & Moderation"
        title="Ban & Mute Appeal"
        lead="Made a mistake, or think a punishment was issued in error? Submit an official appeal form below for moderator review."
        illustration={
          <div className="relative group">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={240}
              height={180}
              priority
              className="w-32 h-auto md:w-[240px] md:h-[180px] animate-float object-contain drop-shadow-[0_15px_35px_rgba(139,92,246,0.35)] transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        }
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
          bulletPoints={[
            "State your exact Minecraft username and punishment type (Ban, Temp-ban, Mute, or Warning).",
            "Provide the exact punishment reason shown on your disconnect or mute screen.",
            "Write a detailed explanation describing why the punishment should be lifted or reduced.",
            "Include unedited screenshot or video proof links (Imgur, Streamable, YouTube) if available.",
          ]}
        />
      </section>
    </>
  );
}
