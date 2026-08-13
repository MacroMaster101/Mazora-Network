import { publicPageMetadata } from "@/lib/seo";
import { Camera, Radio, Video } from "lucide-react";
import { FloatingBrandLogo, GoogleFormEmbed, PageHero } from "@/components/shared";
import { getFormsConfig } from "@/lib/data/forms-config";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Content Creator Program",
  description: "Create videos, streams, guides, and community media with the Mazora Network.",
  path: "/support/content-creator",
});

const paths = [
  { icon: Video, title: "Video creators", copy: "Server showcases, progression series, tutorials, challenges, and polished short-form edits." },
  { icon: Radio, title: "Streamers", copy: "Live events, community sessions, season launches, and regular gameplay with your audience." },
  { icon: Camera, title: "Community media", copy: "Screenshots, builds, cinematic projects, artwork, guides, and social content that tells Mazora stories." },
];

export default async function ContentCreatorPage() {
  const [config, supportCard] = await Promise.all([getFormsConfig(), getSupportCard("creator")]);
  const form = config.creator;
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
          bulletPoints={page.details}
        />
      </section>
    </>
  );
}
