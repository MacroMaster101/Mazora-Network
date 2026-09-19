import Link from "@/components/ui/app-link";
import { Folder, MessageSquare } from "lucide-react";
import type { BoardCategory } from "@/lib/data/forums";
import { SeeMoreList } from "./see-more-list";

function LastPost({ post }: { post: BoardCategory["forums"][number]["lastPost"] }) {
  if (!post) return <span className="text-sm text-muted">No topics</span>;
  return (
    <span className="min-w-0 text-sm">
      {/* Above the row's own overlay link, so the last post stays its own destination. */}
      <Link
        href={`/forums/topic/${post.topicId}`}
        className="relative z-10 block truncate font-semibold hover:text-accent-bright"
      >
        {post.topicTitle}
      </Link>
      <span className="text-muted">by {post.author}</span>
    </span>
  );
}

export function BoardCategories({ categories }: { categories: BoardCategory[] }) {
  return (
    <div className="space-y-5">
      {categories.map((category) => (
        <section key={category.id} className="panel overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg font-extrabold text-accent-bright">
            <Folder size={19} aria-hidden="true" /> {category.name}
          </h2>
          {category.forums.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No forums in this category yet.</p>
          ) : (
            <SeeMoreList className="divide-y divide-line">
              {category.forums.map((forum) => (
                /*
                  The whole row opens the forum. The name's link is stretched
                  over the row with `after:absolute after:inset-0` rather than
                  wrapping everything in one <a>, because the last-post column
                  is its own link and links cannot nest.
                */
                <div
                  key={forum.id}
                  className="relative grid gap-3 p-5 transition hover:bg-ink/[0.03] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,14rem)] sm:items-center"
                >
                  <div className="flex min-w-0 gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-bright">
                      <MessageSquare size={22} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/forums/${forum.slug}`}
                        className="font-display text-base font-bold after:absolute after:inset-0 after:content-[''] hover:text-accent-bright"
                      >
                        {forum.name}
                      </Link>
                      {forum.description && <p className="mt-1 text-sm leading-6 text-muted">{forum.description}</p>}
                    </div>
                  </div>
                  <dl className="flex gap-6 text-sm sm:flex-col sm:gap-0.5">
                    <div className="flex gap-1.5"><dt className="text-muted">Topics:</dt><dd className="font-bold">{forum.topicCount}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-muted">Posts:</dt><dd className="font-bold">{forum.postCount}</dd></div>
                  </dl>
                  <LastPost post={forum.lastPost} />
                </div>
              ))}
            </SeeMoreList>
          )}
        </section>
      ))}
    </div>
  );
}
