import { publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Blocks, CalendarDays, Lightbulb, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "@/components/shared";

export const metadata = publicPageMetadata({
  title: "Community Forums",
  description: "Discuss Mazora updates, game modes, builds and community ideas.",
  path: "/forums",
});

const categories = [
  { icon: Sparkles, title: "Announcements", copy: "Network news, releases and maintenance updates from the Mazora team.", topics: 18 },
  { icon: Blocks, title: "Game mode discussion", copy: "Talk Survival, Skyblock, Lifesteal, OneBlock, KitPvP and Creative.", topics: 126 },
  { icon: CalendarDays, title: "Events & creations", copy: "Share builds, recruit teammates and plan for upcoming community events.", topics: 74 },
  { icon: MessageSquareText, title: "General discussion", copy: "Meet the community and talk about everything happening around Mazora.", topics: 203 },
];

const recent = [
  { title: "Frontiers Season II feedback thread", category: "Announcements", replies: 42, author: "Kade" },
  { title: "Looking for two builders for our town", category: "Events & creations", replies: 16, author: "Aria" },
  { title: "What should the next Skyblock challenge be?", category: "Game mode discussion", replies: 29, author: "Nova" },
];

export default function ForumsPage() {
  return (
    <>
      <PageHero
        eyebrow="Mazora community"
        title="The conversation continues here."
        lead="Ask questions, share builds, find teammates and help shape what comes next across the network."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/support/suggestions" className="btn btn-primary"><Lightbulb size={16} /> Share a suggestion</Link>
          <Link href="/support/staff-application" className="btn btn-ghost"><ShieldCheck size={16} /> Join the team</Link>
        </div>
      </PageHero>

      <section className="section shell">
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <article key={category.title} className="panel panel-hover group flex gap-4 p-6">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent-bright">
                <category.icon size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">{category.title}</h2>
                  <span className="telemetry text-xs text-muted">{category.topics} topics</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{category.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recently active</p>
            <h2 className="mt-3 text-3xl font-bold">Community conversations</h2>
          </div>
          <Link href="/login" className="hidden text-sm font-semibold text-accent-bright sm:inline-flex">Log in to post <ArrowRight size={15} className="ml-1" /></Link>
        </div>
        <div className="panel mt-6 divide-y divide-line overflow-hidden">
          {recent.map((thread) => (
            <div key={thread.title} className="flex items-center gap-4 p-5 transition-colors hover:bg-ink/[0.025]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 font-display text-sm font-bold text-accent-bright">
                {thread.author.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{thread.title}</h3>
                <p className="mt-1 text-xs text-muted">{thread.category} · started by {thread.author}</p>
              </div>
              <span className="telemetry shrink-0 text-xs text-muted">{thread.replies} replies</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
