import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, Radio, Sparkles, Video } from "lucide-react";
import { PageHero } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Content Creator Program",
  description: "Create videos, streams, guides, and community media with the Mazora Network.",
};

const paths = [
  { icon: Video, title: "Video creators", copy: "Server showcases, progression series, tutorials, challenges, and polished short-form edits." },
  { icon: Radio, title: "Streamers", copy: "Live events, community sessions, season launches, and regular gameplay with your audience." },
  { icon: Camera, title: "Community media", copy: "Screenshots, builds, cinematic projects, artwork, guides, and social content that tells Mazora stories." },
];

export default function ContentCreatorPage() {
  return (
    <>
      <PageHero eyebrow="Creator program" title="Tell stories from inside Mazora." lead="We work with thoughtful creators who make useful, entertaining, and original Minecraft content for the community." />
      <section className="section shell creator-program-page">
        <div className="creator-program-grid">
          {paths.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="panel creator-program-card">
              <span><Icon size={22} /></span>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>

        <div className="creator-program-cta panel">
          <div>
            <p className="eyebrow"><Sparkles size={13} /> Applications and partnerships</p>
            <h2>Start the conversation on Discord.</h2>
            <p>Share your channel, the type of content you make, your usual audience, and what you would like to create with Mazora. The team reviews creator requests manually.</p>
          </div>
          <div>
            <a href={site.discord} target="_blank" rel="noreferrer" className="btn btn-primary">Open Discord <ArrowRight size={15} /></a>
            <Link href="/support/staff-application" className="btn btn-ghost">Team applications</Link>
          </div>
        </div>
      </section>
    </>
  );
}