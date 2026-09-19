import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound } from "next/navigation";
import { Lock, LogIn, Pin } from "lucide-react";
import { getForumBySlug, getTopics, getViewerActor } from "@/lib/data/forums";
import { canCreateTopic, TOPICS_PER_PAGE } from "@/lib/forums-rules";
import { StartDiscussionButton } from "@/components/forums/community-actions";
import { FloatingBrandLogo, PageHero, UserAvatar } from "@/components/shared";
import { publicPageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ forumSlug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { forumSlug } = await params;
  const forum = await getForumBySlug(forumSlug);
  if (!forum) return { title: "Forum", robots: { index: false, follow: false } };
  return publicPageMetadata({
    title: forum.name,
    description: forum.description ?? `Discussion in ${forum.name}.`,
    path: `/forums/${forum.slug}`,
  });
}

export default async function ForumTopicsPage({ params, searchParams }: PageProps) {
  const { forumSlug } = await params;
  const forum = await getForumBySlug(forumSlug);
  if (!forum) notFound();

  const page = Math.max(1, Number((await searchParams).page ?? "1") || 1);
  const { topics, total } = await getTopics(forum.id, page);
  const actor = await getViewerActor();
  const pages = Math.max(1, Math.ceil(total / TOPICS_PER_PAGE));

  return (
    <>
      {/* Same hero as the board, so stepping from /forums into a forum feels like one place. */}
      <PageHero
        backLink={{ href: "/forums", label: "Back to Forums" }}
        eyebrow={forum.categoryName}
        title={forum.name}
        lead={forum.description ?? `Discussions in ${forum.name} on Mazora Network.`}
        illustration={<FloatingBrandLogo />}
      />

      <section className="shell max-w-6xl space-y-5 pb-24 pt-5">
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          {forum.locked ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock size={15} /> This forum is locked. Existing topics can still be read.
            </p>
          ) : canCreateTopic({ locked: forum.locked }, actor) ? (
            <>
              <div className="min-w-0">
                <p className="font-display text-base font-bold">Start a topic</p>
                <p className="text-sm text-muted">Ask a question or kick off a conversation in {forum.name}.</p>
              </div>
              <StartDiscussionButton
                forums={[{ id: forum.id, name: forum.name, category: forum.categoryName }]}
                label="New topic"
              />
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Sign in to start a topic or reply in {forum.name}.</p>
              <Link href={`/login?next=/forums/${forum.slug}`} className="btn btn-primary btn-sm">
                <LogIn size={15} /> Sign in to join
              </Link>
            </>
          )}
        </div>

        <div className="panel divide-y divide-line overflow-hidden">
          {topics.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No topics yet. Be the first to start one.</p>}
          {topics.map((topic) => (
            /*
              The whole row is the link, not just the title: a list of topics is
              a list of destinations, and a card that only reacts on its heading
              reads as broken. The reply count and avatar sit inside it.
            */
            <Link
              key={topic.id}
              href={`/forums/topic/${topic.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-5 transition hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04] focus-visible:outline-none"
            >
              <span className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  username={topic.authorUsername}
                  avatarUrl={topic.authorAvatar ?? undefined}
                  size={38}
                  rounded="rounded-xl"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {topic.pinned && <Pin size={14} className="mr-1 inline text-accent-bright" aria-label="Pinned" />}
                    {topic.locked && <Lock size={14} className="mr-1 inline text-muted" aria-label="Locked" />}
                    {topic.title}
                  </span>
                  <small className="block text-muted">by {topic.author}</small>
                </span>
              </span>
              <span className="text-sm text-muted">{topic.replyCount} replies</span>
            </Link>
          ))}
        </div>

        {pages > 1 && (
          <nav className="flex justify-center gap-2" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={`/forums/${forum.slug}?page=${n}`}
                aria-current={n === page ? "page" : undefined}
                className={n === page ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                {n}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </>
  );
}
