import type { Metadata } from "next";
import Image from "next/image";
import { Camera, Radio, Video } from "lucide-react";
import { GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";

export const metadata: Metadata = {
  title: "Content Creator Program",
  description: "Create videos, streams, guides, and community media with the Mazora Network.",
};

const paths = [
  { icon: Video, title: "Video creators", copy: "Server showcases, progression series, tutorials, challenges, and polished short-form edits." },
  { icon: Radio, title: "Streamers", copy: "Live events, community sessions, season launches, and regular gameplay with your audience." },
  { icon: Camera, title: "Community media", copy: "Screenshots, builds, cinematic projects, artwork, guides, and social content that tells Mazora stories." },
];

export default async function ContentCreatorPage() {
  const config = await getFormsConfig();
  const form = config.creator;

  return (
    <>
      <PageHero
        eyebrow="Creator program"
        title="Tell stories from inside Mazora."
        lead="We work with thoughtful creators who make useful, entertaining, and original Minecraft content for the community."
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
          {paths.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="panel rounded-2xl border border-line bg-card/95 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-bright border border-accent/30">
                    <Icon size={20} />
                  </span>
                  <h3 className="font-display text-base font-bold text-ink">{title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted font-medium">{copy}</p>
              </div>
            </div>
          ))}
        </div>

        <GoogleFormEmbed
          formUrl={form.publicUrl}
          title="Content Creator Application Form"
          subtitle="Official Creator Program Intake"
          description={form.enabled ? "Click below to open the official Google Form and submit your channel details and creator application." : "Creator program applications are currently closed. Please check back later."}
          buttonText={form.enabled ? "Open Creator Application" : "Applications Closed"}
          disabled={!form.enabled}
          bulletPoints={[
            "Provide direct links to your active YouTube channel, Twitch stream, TikTok, or video portfolio.",
            "Select your main content format (YouTube videos, live streams, shorts, or cinematic edits).",
            "Include your average view counts, subscriber/follower stats, and streaming schedule.",
            "Share your planned Mazora video concepts, series ideas, or event stream plans.",
          ]}
        />
      </section>
    </>
  );
}