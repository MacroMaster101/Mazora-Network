"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { COMMENT_SORTS, commentHref, type CommentNode, type CommentSort } from "@/lib/comments/tree";
import { CommentItem } from "./comment-item";
import type { CommentAdapter, CommentView } from "./types";

const SORT_LABELS: Record<CommentSort, string> = { best: "Best", new: "New", old: "Old" };

/**
 * The comment list with its count and sort. The sort lives in the address, so
 * a shared link keeps its order; changing it returns to the first page.
 */
export function CommentThread({
  nodes,
  totalComments,
  sort,
  basePath,
  loginHref,
  adapter,
  focusBackHref = null,
  emptyText,
}: {
  nodes: CommentNode<CommentView>[];
  totalComments: number;
  sort: CommentSort;
  basePath: string;
  loginHref: string | null;
  adapter: CommentAdapter;
  focusBackHref?: string | null;
  emptyText: string;
}) {
  const router = useRouter();

  return (
    <section aria-label="Comments" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold">
          {totalComments} {totalComments === 1 ? "comment" : "comments"}
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          Sort by
          <select
            value={sort}
            onChange={(event) => router.push(commentHref(basePath, event.target.value as CommentSort, {}), { scroll: false })}
            className="input h-8 py-0 text-xs"
          >
            {COMMENT_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {focusBackHref && (
        <Link href={focusBackHref} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-bright hover:underline">
          <ArrowLeft size={14} aria-hidden="true" /> Back to full discussion
        </Link>
      )}

      {nodes.length === 0 ? (
        <p className="py-4 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {nodes.map((node) => (
            <CommentItem key={node.comment.id} node={node} basePath={basePath} loginHref={loginHref} adapter={adapter} sort={sort} />
          ))}
        </ul>
      )}
    </section>
  );
}
