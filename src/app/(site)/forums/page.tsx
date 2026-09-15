import { publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Blocks, CalendarDays, Lightbulb, MessageCircle, MessageSquareText, ShieldCheck, Sparkles, ThumbsUp } from "lucide-react";
import { PageHero, FloatingBrandLogo, UserAvatar } from "@/components/shared";
import { listBoardSuggestions } from "@/lib/data/suggestions-board";
import { fmtDate, relative } from "@/lib/utils";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Community Forums",
  description: "Discuss Mazora updates, game modes, builds and community ideas.",
  path: "/forums",
});

const categories = [
  { icon: Sparkles, title: "Announcements", copy: "Network news, releases and maintenance updates from the Mazora team." },
  { icon: Blocks, title: "Game mode discussion", copy: "Talk Survival, Skyblock, Lifesteal, OneBlock, KitPvP and Creative." },
  { icon: CalendarDays, title: "Events & creations", copy: "Share builds, recruit teammates and plan for upcoming community events." },
  { icon: MessageSquareText, title: "General discussion", copy: "Meet the community and talk about everything happening around Mazora." },
];

export default async function ForumsPage() {
  const [suggestions, copy] = await Promise.all([listBoardSuggestions({ sort: "newest" }), getPageContent("forums")]);
  const recent = suggestions.slice(0, 4);
  const editableCategories = categories.map((category, index) => ({
    ...category,
    title: copy[`category${index + 1}Title`],
    copy: copy[`category${index + 1}Copy`],
  }));
  return (
    <>
      <PageHero
        eyebrow={copy.heroEyebrow}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ eyebrow: "heroEyebrow", title: "heroTitle", lead: "heroLead" }}
        illustration={<FloatingBrandLogo />}
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/support/suggestions" className="btn btn-primary"><Lightbulb size={16} /> <span data-page-field="suggestionCta">{copy.suggestionCta}</span></Link>
          <Link href="/support/staff-application" className="btn btn-ghost"><ShieldCheck size={16} /> <span data-page-field="teamCta">{copy.teamCta}</span></Link>
        </div>
      </PageHero>

      <section className="section shell">
        <div className="grid gap-4 md:grid-cols-2">
          {editableCategories.map((category, index) => (
            <article key={category.title} className="panel panel-hover group flex gap-4 p-6">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent-bright">
                <category.icon size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold" data-page-field={`category${index + 1}Title`}>{category.title}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted" data-page-field={`category${index + 1}Copy`}>{category.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow" data-page-field="recentEyebrow">{copy.recentEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold" data-page-field="recentTitle">{copy.recentTitle}</h2>
          </div>
          <Link href="/login" className="hidden text-sm font-semibold text-accent-bright sm:inline-flex"><span data-page-field="loginCta">{copy.loginCta}</span> <ArrowRight size={15} className="ml-1" /></Link>
        </div>
        <div className="panel mt-6 divide-y divide-line overflow-hidden">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent-bright"><Lightbulb size={22} /></span>
              <h3 className="mt-4 font-display text-lg font-bold" data-page-field="emptyTitle">{copy.emptyTitle}</h3>
              <p className="mt-1 max-w-md text-sm text-muted" data-page-field="emptyMessage">{copy.emptyMessage}</p>
              <Link href="/support/suggestions" className="btn btn-primary btn-sm mt-5"><span data-page-field="emptyCta">{copy.emptyCta}</span> <ArrowRight size={14} /></Link>
            </div>
          ) : recent.map((thread) => (
            <Link key={thread.id} href={`/support/suggestions/${thread.id}`} className="group flex items-center gap-4 p-5 transition-colors hover:bg-ink/[0.035]">
              <UserAvatar username={thread.author.username} avatarUrl={thread.author.avatarUrl} size={44} rounded="rounded-xl" className="ring-2 ring-line" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold transition group-hover:text-accent-bright">{thread.title}</h3>
                <p className="mt-1 text-xs text-muted"><strong className="font-semibold text-ink">{thread.author.displayName || thread.author.username}</strong> · {thread.category} · <time dateTime={thread.createdAt} title={fmtDate(thread.createdAt)}>{relative(thread.createdAt)}</time></p>
              </div>
              <span className="hidden shrink-0 items-center gap-3 text-xs text-muted sm:flex">
                <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {thread.votesCount}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {thread.repliesCount}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
