import type { Metadata } from "next";
import Image from "next/image";
import { Shield, Sparkles, UsersRound } from "lucide-react";
import { GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";

export const metadata: Metadata = {
  title: "Staff Application",
  description: "Apply to join the Mazora Network staff team.",
};

export default async function StaffApplicationPage() {
  const config = await getFormsConfig();
  const form = config.staff;

  return (
    <>
      <PageHero
        backLink={{ href: "/support", label: "Back to Support" }}
        eyebrow="Join the Crew"
        title="Staff Application"
        lead="Mazora is community-run. If you are patient, dependable, and excited to help players, we would love to hear from you."
        illustration={
          <div className="relative group">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={240}
              height={160}
              priority
              className="h-auto w-32 md:w-[240px] animate-float object-contain drop-shadow-[0_15px_35px_rgba(139,92,246,0.35)] transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        }
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
          bulletPoints={[
            "Provide your exact Minecraft username, age, timezone, and weekly available hours.",
            "Select your target role (Helper, Moderator, Builder, or Developer).",
            "Detail your past server moderation, staff, or community building experience.",
            "Explain your motivation for joining the team and how you will assist players.",
          ]}
        />
      </section>
    </>
  );
}
