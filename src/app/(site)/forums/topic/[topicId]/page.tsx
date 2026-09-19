import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound } from "next/navigation";
import { LogIn } from "lucide-react";
import { getTopic, getTopicComments, getViewerActor, type ForumComment, type TopicHeader } from "@/lib/data/forums";
import { canDeletePost, canEditPost, canReply, canReportPost, type ForumActor, postBody } from "@/lib/forums-rules";
import { canVoteOnComment } from "@/lib/comments/vote-rules";
import { commentHref, MAX_VISIBLE_DEPTH, parseCommentSort, type CommentNode } from "@/lib/comments/tree";
import { renderPostBody } from "@/lib/forums/render-post";
import type { CommentView } from "@/components/comments/types";
import { ForumComments } from "@/components/forums/forum-comments";
import { PostImages } from "@/components/forums/post-images";
import { ReplyForm } from "@/components/forums/reply-form";
import { FloatingBrandLogo, PageHero } from "@/components/shared";
import { publicPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ page?: string; sort?: string; focus?: string; comment?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topicId } = await params;
  const topic = await getTopic(topicId);
  if (!topic) return { title: "Topic", robots: { index: false, follow: false } };
  return publicPageMetadata({
    title: topic.title,
    description: `Discussion in ${topic.forumName} on Mazora Network.`,
    path: `/forums/topic/${topic.id}`,
  });
}

/**
 * One post as the shared components see it. Permissions are decided here, on
 * the server, and only the raw text an editor needs is included — a removed
 * post's words never reach the page payload.
 */
function toView(topic: TopicHeader, post: ForumComment, actor: ForumActor, isOpening: boolean): CommentView {
  const subject = { authorId: post.authorId, deletedAt: post.deletedAt };
  const forum = { locked: topic.forumLocked };
  const topicState = { locked: topic.locked, deletedAt: null };
  const canEdit = canEditPost(forum, topicState, subject, actor);
  // Permissions above are computed from the real row. A removed post's author
  // must never reach the page payload, so everything below is neutralised.
  const removed = Boolean(post.deletedAt);
  return {
    id: post.id,
    parentId: post.parentId,
    createdAt: post.createdAt,
    deletedAt: post.deletedAt,
    up: post.up,
    down: post.down,
    authorId: removed ? "" : post.authorId,
    authorName: removed ? "" : post.author,
    authorUsername: removed ? "removed" : post.author,
    authorAvatar: removed ? null : post.authorAvatar,
    authorRole: removed ? "member" : post.authorRole,
    // Once the author has deleted their opening post, the topic reads "[deleted]";
    // an OP badge on their later replies would say who that was.
    isOp: removed || topic.openingRemoved ? false : post.authorId === topic.authorId,
    authorStatus: removed ? null : post.authorStatus,
    editedAt: post.editedAt,
    myVote: post.myVote,
    body: renderPostBody(postBody(post)),
    editBody: canEdit ? post.body : null,
    images: post.images.length ? <PostImages images={post.images} /> : null,
    canVote: canVoteOnComment(subject, actor),
    canReply: !isOpening && !post.deletedAt && canReply(forum, topicState, actor),
    canEdit,
    canDelete: canDeletePost(subject, actor),
    canReport: canReportPost(subject, actor),
  };
}

/**
 * Below MAX_VISIBLE_DEPTH, children are not serialised into the page payload
 * at all — the page links to a focused view instead — but `descendantCount`
 * stays real so "Continue this thread (N)" still shows a true count.
 */
function toViewTree(topic: TopicHeader, nodes: CommentNode<ForumComment>[], actor: ForumActor): CommentNode<CommentView>[] {
  return nodes.map((node) => {
    const comment = toView(topic, node.comment, actor, false);
    if (node.depth >= MAX_VISIBLE_DEPTH) return { ...node, comment, children: [] };
    return { ...node, comment, children: toViewTree(topic, node.children, actor) };
  });
}

export default async function TopicPage({ params, searchParams }: PageProps) {
  const { topicId } = await params;
  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const query = await searchParams;
  const sort = parseCommentSort(query.sort);
  const actor = await getViewerActor();
  const data = await getTopicComments(topic.id, {
    sort,
    page: Number(query.page ?? "1") || 1,
    focus: query.focus ?? null,
    comment: query.comment ?? null,
    viewerId: actor.userId,
  });

  const basePath = `/forums/topic/${topic.id}`;
  const canReplyHere = canReply({ locked: topic.forumLocked }, { locked: topic.locked, deletedAt: null }, actor);
  const started = new Date(topic.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <PageHero
        backLink={{ href: `/forums/${topic.forumSlug}`, label: `Back to ${topic.forumName}` }}
        eyebrow={`${topic.categoryName} · ${topic.forumName}`}
        title={topic.title}
        lead={`Started by ${topic.author} on ${started}.${topic.locked ? " This topic is locked." : ""}`}
        illustration={<FloatingBrandLogo />}
      />

      <section className="shell max-w-5xl space-y-5 pb-24 pt-5">
        <ForumComments
          topicId={topic.id}
          basePath={basePath}
          loginHref={actor.userId ? null : `/login?next=${encodeURIComponent(basePath)}`}
          sort={sort}
          opening={data.opening ? toView(topic, data.opening, actor, true) : null}
          nodes={toViewTree(topic, data.nodes, actor)}
          totalComments={data.totalComments}
          focusBackHref={data.focusId ? commentHref(basePath, sort, {}) : null}
        />

        {canReplyHere && !data.focusId && <ReplyForm topicId={topic.id} />}
        {!actor.userId && !topic.locked && !topic.forumLocked && (
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted">Sign in to reply to this topic or vote on comments.</p>
            <Link href={`/login?next=${encodeURIComponent(basePath)}`} className="btn btn-primary btn-sm">
              <LogIn size={15} aria-hidden="true" /> Sign in to reply
            </Link>
          </div>
        )}

        {data.pages > 1 && !data.focusId && (
          <nav className="flex justify-center gap-2" aria-label="Pagination">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={commentHref(basePath, sort, n > 1 ? { page: String(n) } : {})}
                aria-current={n === data.page ? "page" : undefined}
                className={n === data.page ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
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
