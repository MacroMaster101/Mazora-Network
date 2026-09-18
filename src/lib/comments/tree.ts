/**
 * Comment threads as trees: shared by forum topics and suggestion threads.
 *
 * Pure and import-free so it can be tested. The loaders fetch a thread's
 * comments flat, with vote totals, and hand them here; everything about shape
 * — nesting, which removed comments still show, ordering — is decided in one
 * place so the two features cannot drift apart.
 */

export interface FlatComment {
  id: string;
  parentId: string | null;
  /** ISO timestamp. */
  createdAt: string;
  deletedAt: string | null;
  up: number;
  down: number;
}

export type CommentSort = "best" | "new" | "old";
export const COMMENT_SORTS: readonly CommentSort[] = ["best", "new", "old"];

/**
 * Levels indented on the page. A comment at this depth that has replies shows
 * "Continue this thread" instead of them, so a long back-and-forth never
 * squeezes the text column to nothing on a phone.
 */
export const MAX_VISIBLE_DEPTH = 6;

export interface CommentNode<T extends FlatComment> {
  comment: T;
  /** 0 for a top-level comment. */
  depth: number;
  children: CommentNode<T>[];
  /** Visible comments below this one, for "N replies" on a collapsed comment. */
  descendantCount: number;
}

export function parseCommentSort(value: unknown): CommentSort {
  return value === "new" || value === "old" ? value : "best";
}

/**
 * Lower bound of the Wilson score interval at 95% confidence.
 *
 * "Best" ranks by how sure we can be that a comment is liked, not by its raw
 * score: 5 up and 0 down beats 50 up and 45 down. Zero votes scores zero.
 */
export function wilsonLowerBound(up: number, down: number): number {
  const n = up + down;
  if (n === 0) return 0;
  const z = 1.96;
  const p = up / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

function compare<T extends FlatComment>(sort: CommentSort) {
  const newestFirst = (a: CommentNode<T>, b: CommentNode<T>) => b.comment.createdAt.localeCompare(a.comment.createdAt);
  if (sort === "new") return newestFirst;
  if (sort === "old") return (a: CommentNode<T>, b: CommentNode<T>) => a.comment.createdAt.localeCompare(b.comment.createdAt);
  return (a: CommentNode<T>, b: CommentNode<T>) =>
    wilsonLowerBound(b.comment.up, b.comment.down) - wilsonLowerBound(a.comment.up, a.comment.down) || newestFirst(a, b);
}

/**
 * Build the visible, sorted tree.
 *
 * A comment whose parent is not in `rows` is shown at the top level rather
 * than dropped. A removed comment stays only while something visible sits
 * beneath it — then it reads as a tombstone holding its replies in place.
 * Otherwise it disappears, and pruning runs from the leaves up, so a chain of
 * removed comments with no live reply at the end vanishes entirely.
 */
export function buildCommentTree<T extends FlatComment>(rows: readonly T[], sort: CommentSort): CommentNode<T>[] {
  const nodes = new Map<string, CommentNode<T>>();
  for (const comment of rows) nodes.set(comment.id, { comment, depth: 0, children: [], descendantCount: 0 });

  const roots: CommentNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.comment.parentId ? nodes.get(node.comment.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  const order = compare<T>(sort);
  const finish = (list: CommentNode<T>[], depth: number): CommentNode<T>[] => {
    const kept: CommentNode<T>[] = [];
    for (const node of list) {
      node.depth = depth;
      node.children = finish(node.children, depth + 1);
      node.descendantCount = node.children.reduce(
        (sum, child) => sum + child.descendantCount + (child.comment.deletedAt ? 0 : 1),
        0,
      );
      if (node.comment.deletedAt && node.children.length === 0) continue;
      kept.push(node);
    }
    return kept.sort(order);
  };
  return finish(roots, 0);
}

/** Visible, live comments in a tree — what "12 comments" counts. */
export function countComments<T extends FlatComment>(nodes: readonly CommentNode<T>[]): number {
  return nodes.reduce((sum, node) => sum + node.descendantCount + (node.comment.deletedAt ? 0 : 1), 0);
}

function rebase<T extends FlatComment>(node: CommentNode<T>, depth: number): CommentNode<T> {
  return { ...node, depth, children: node.children.map((child) => rebase(child, depth + 1)) };
}

/** One comment and everything under it, with depth starting again at 0 — the "Continue this thread" view. */
export function findSubtree<T extends FlatComment>(nodes: readonly CommentNode<T>[], id: string): CommentNode<T> | null {
  for (const node of nodes) {
    if (node.comment.id === id) return rebase(node, 0);
    const found = findSubtree(node.children, id);
    if (found) return found;
  }
  return null;
}

function pathTo<T extends FlatComment>(nodes: readonly CommentNode<T>[], id: string): string[] | null {
  for (const node of nodes) {
    if (node.comment.id === id) return [id];
    const rest = pathTo(node.children, id);
    if (rest) return [node.comment.id, ...rest];
  }
  return null;
}

/**
 * Where a shared link to a comment lands.
 *
 * `topLevelIndex` is the position of its top-level ancestor, so the caller can
 * pick the page. `focusId` is set only when the comment is deeper than
 * MAX_VISIBLE_DEPTH: it is the ancestor whose "Continue this thread" view
 * shows the comment. Focus views are themselves limited to the same depth, so
 * the focus sits at a multiple of MAX_VISIBLE_DEPTH.
 */
export function resolveCommentLink<T extends FlatComment>(
  nodes: readonly CommentNode<T>[],
  id: string,
): { topLevelIndex: number; focusId: string | null } | null {
  const path = pathTo(nodes, id);
  if (!path) return null;
  const topLevelIndex = nodes.findIndex((node) => node.comment.id === path[0]);
  const depth = path.length - 1;
  if (depth <= MAX_VISIBLE_DEPTH) return { topLevelIndex, focusId: null };
  return { topLevelIndex, focusId: path[MAX_VISIBLE_DEPTH * Math.floor((depth - 1) / MAX_VISIBLE_DEPTH)] };
}

/**
 * One page (or focused subtree) of a comment tree, for a `sort`/`page`/`focus`/
 * `comment` query — the selection logic `getTopicComments` and
 * `getSuggestionThread` both need, factored out so it can be unit tested
 * without a database and so the two loaders cannot drift apart.
 *
 * `comment` (a shared link to one comment) overrides `focus`, including
 * overriding it to `null` when the linked comment is shallow enough to sit on
 * its ordinary page. A `focus` that does not resolve to a real subtree falls
 * back to the ordinary page rather than erroring.
 */
export function selectCommentView<T extends FlatComment>(
  tree: CommentNode<T>[],
  options: { page: number; perPage: number | null; focus: string | null; comment: string | null },
): { nodes: CommentNode<T>[]; page: number; pages: number; focusId: string | null } {
  const { perPage } = options;
  const pages = perPage ? Math.max(1, Math.ceil(tree.length / perPage)) : 1;
  let page = Math.min(Math.max(1, options.page), pages);
  let focusId = options.focus;

  if (options.comment) {
    const link = resolveCommentLink(tree, options.comment);
    if (link) {
      if (perPage) page = Math.floor(link.topLevelIndex / perPage) + 1;
      focusId = link.focusId;
    }
  }

  if (focusId) {
    const subtree = findSubtree(tree, focusId);
    if (subtree) return { nodes: [subtree], page: 1, pages: 1, focusId };
  }

  const nodes = perPage ? tree.slice((page - 1) * perPage, (page - 1) * perPage + perPage) : tree;
  return { nodes, page, pages, focusId: null };
}

/**
 * A link to a view of a thread page, keeping a non-default sort. Lives here,
 * not in a component, so server pages and client components share it.
 */
export function commentHref(basePath: string, sort: CommentSort, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  if (sort !== "best") query.set("sort", sort);
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}
