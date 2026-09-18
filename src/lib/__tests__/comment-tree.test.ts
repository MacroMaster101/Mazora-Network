import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommentTree, commentHref, countComments, findSubtree, MAX_VISIBLE_DEPTH, parseCommentSort,
  resolveCommentLink, selectCommentView, wilsonLowerBound, type FlatComment,
} from "@/lib/comments/tree";

const c = (id: string, parentId: string | null, minute: number, extra: Partial<FlatComment> = {}): FlatComment => ({
  id, parentId, createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(), deletedAt: null, up: 0, down: 0, ...extra,
});
const ids = (nodes: { comment: FlatComment }[]) => nodes.map((n) => n.comment.id);

test("builds any depth and records depth", () => {
  const rows = [c("a", null, 0), c("b", "a", 1), c("c", "b", 2), c("d", "c", 3), c("e", "d", 4), c("f", "e", 5), c("g", "f", 6), c("h", "g", 7)];
  const [root] = buildCommentTree(rows, "old");
  let node = root;
  for (let depth = 0; depth < 8; depth++) {
    assert.equal(node.depth, depth);
    node = node.children[0] ?? node;
  }
  assert.equal(root.descendantCount, 7);
});

test("a comment whose parent is missing becomes top level", () => {
  assert.deepEqual(ids(buildCommentTree([c("x", "gone", 0)], "old")), ["x"]);
});

test("removed comments without live replies are hidden; with live replies they stay", () => {
  const rows = [
    c("keep", null, 0, { deletedAt: "2026-01-02T00:00:00Z" }),
    c("child", "keep", 1),
    c("leaf", null, 2, { deletedAt: "2026-01-02T00:00:00Z" }),
    c("chainTop", null, 3, { deletedAt: "2026-01-02T00:00:00Z" }),
    c("chainMid", "chainTop", 4, { deletedAt: "2026-01-02T00:00:00Z" }),
  ];
  const tree = buildCommentTree(rows, "old");
  assert.deepEqual(ids(tree), ["keep"]);
  assert.equal(tree[0].descendantCount, 1);
  assert.equal(countComments(tree), 1, "a removed comment kept for its replies is not counted");
});

test("new and old sort by time at every level", () => {
  const rows = [c("a", null, 0), c("b", null, 5), c("a1", "a", 1), c("a2", "a", 3)];
  assert.deepEqual(ids(buildCommentTree(rows, "new")), ["b", "a"]);
  assert.deepEqual(ids(buildCommentTree(rows, "new")[1].children), ["a2", "a1"]);
  assert.deepEqual(ids(buildCommentTree(rows, "old")), ["a", "b"]);
});

test("best ranks confidence, not raw score, and breaks ties newest first", () => {
  const rows = [
    c("mixed", null, 0, { up: 50, down: 45 }),
    c("clean", null, 1, { up: 5, down: 0 }),
    c("zeroOld", null, 2),
    c("zeroNew", null, 3),
  ];
  assert.deepEqual(ids(buildCommentTree(rows, "best")), ["clean", "mixed", "zeroNew", "zeroOld"]);
  assert.equal(wilsonLowerBound(0, 0), 0);
  assert.ok(wilsonLowerBound(5, 0) > wilsonLowerBound(50, 45));
});

test("parseCommentSort defaults to best", () => {
  assert.equal(parseCommentSort("new"), "new");
  assert.equal(parseCommentSort("old"), "old");
  assert.equal(parseCommentSort("top"), "best");
  assert.equal(parseCommentSort(undefined), "best");
});

test("findSubtree re-bases depth to zero", () => {
  const tree = buildCommentTree([c("a", null, 0), c("b", "a", 1), c("c", "b", 2)], "old");
  const sub = findSubtree(tree, "b");
  assert.ok(sub);
  assert.equal(sub.depth, 0);
  assert.equal(sub.children[0].depth, 1);
  assert.equal(findSubtree(tree, "nope"), null);
});

test("resolveCommentLink finds the page ancestor and a focus only when too deep", () => {
  const chain = [c("r0", null, 10)];
  for (let i = 1; i <= 13; i++) chain.push(c(`r${i}`, `r${i - 1}`, 10 + i));
  const tree = buildCommentTree([c("first", null, 0), ...chain], "old");
  assert.deepEqual(resolveCommentLink(tree, "r3"), { topLevelIndex: 1, focusId: null });
  assert.deepEqual(resolveCommentLink(tree, `r${MAX_VISIBLE_DEPTH}`), { topLevelIndex: 1, focusId: null });
  assert.deepEqual(resolveCommentLink(tree, "r7"), { topLevelIndex: 1, focusId: "r6" });
  assert.deepEqual(resolveCommentLink(tree, "r12"), { topLevelIndex: 1, focusId: "r6" });
  assert.deepEqual(resolveCommentLink(tree, "r13"), { topLevelIndex: 1, focusId: "r12" });
  assert.equal(resolveCommentLink(tree, "missing"), null);
});

test("commentHref keeps a non-default sort and omits the default", () => {
  assert.equal(commentHref("/t", "best", {}), "/t");
  assert.equal(commentHref("/t", "new", { page: "2" }), "/t?page=2&sort=new");
});

function sixTopLevel() {
  const rows = Array.from({ length: 6 }, (_, i) => c(`t${i}`, null, i));
  return buildCommentTree(rows, "old");
}

test("selectCommentView clamps page into [1, pages]", () => {
  const tree = sixTopLevel();
  const low = selectCommentView(tree, { page: 0, perPage: 2, focus: null, comment: null });
  assert.equal(low.page, 1);
  assert.equal(low.pages, 3);
  assert.deepEqual(ids(low.nodes), ["t0", "t1"]);

  const high = selectCommentView(tree, { page: 100, perPage: 2, focus: null, comment: null });
  assert.equal(high.page, 3);
  assert.deepEqual(ids(high.nodes), ["t4", "t5"]);
});

test("selectCommentView with perPage null returns everything on one page", () => {
  const tree = sixTopLevel();
  const result = selectCommentView(tree, { page: 5, perPage: null, focus: null, comment: null });
  assert.equal(result.pages, 1);
  assert.equal(result.page, 1);
  assert.deepEqual(ids(result.nodes), ["t0", "t1", "t2", "t3", "t4", "t5"]);
});

test("selectCommentView: a comment link selects the page holding its top-level ancestor", () => {
  const tree = sixTopLevel();
  const result = selectCommentView(tree, { page: 1, perPage: 2, focus: null, comment: "t3" });
  assert.equal(result.page, 2);
  assert.equal(result.pages, 3);
  assert.equal(result.focusId, null);
  assert.deepEqual(ids(result.nodes), ["t2", "t3"]);
});

test("selectCommentView: a comment link overrides a stale focus, including to null", () => {
  const tree = sixTopLevel();
  const result = selectCommentView(tree, { page: 1, perPage: 2, focus: "t0", comment: "t3" });
  assert.equal(result.focusId, null);
  assert.equal(result.page, 2);
  assert.deepEqual(ids(result.nodes), ["t2", "t3"]);
});

test("selectCommentView: a deep comment link returns the focused subtree", () => {
  const chain = [c("r0", null, 10)];
  for (let i = 1; i <= 13; i++) chain.push(c(`r${i}`, `r${i - 1}`, 10 + i));
  const tree = buildCommentTree([c("first", null, 0), ...chain], "old");
  const result = selectCommentView(tree, { page: 1, perPage: 2, focus: null, comment: "r7" });
  assert.equal(result.page, 1);
  assert.equal(result.pages, 1);
  assert.equal(result.focusId, "r6");
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].comment.id, "r6");
  assert.equal(result.nodes[0].depth, 0);
});

test("selectCommentView: an unknown focus id falls back to the page, focusId null", () => {
  const tree = sixTopLevel();
  const result = selectCommentView(tree, { page: 1, perPage: 2, focus: "missing", comment: null });
  assert.equal(result.focusId, null);
  assert.equal(result.page, 1);
  assert.deepEqual(ids(result.nodes), ["t0", "t1"]);
});
