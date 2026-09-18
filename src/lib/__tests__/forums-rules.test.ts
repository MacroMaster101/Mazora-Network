import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateTopic, canReply, canEditPost, canDeletePost, postBody, isValidSlug, slugify, POST_TOMBSTONE, TITLE_MAX, BODY_MAX, isValidTitle, isValidBody, canEditTopicTitle, moveInOrder, canReportPost, purgeableImagePosts,
  openingDeleteRemovesTopic,
} from "@/lib/forums-rules";

const guest = { userId: null, role: null, accountStatus: null, canModerate: false };
const member = { userId: "u1", role: "member" as const, accountStatus: "active", canModerate: false };
const other = { userId: "u2", role: "member" as const, accountStatus: "active", canModerate: false };
const banned = { userId: "u3", role: "member" as const, accountStatus: "suspended", canModerate: false };
const mod = { userId: "u4", role: "moderator" as const, accountStatus: "active", canModerate: true };

const openForum = { locked: false };
const lockedForum = { locked: true };
const openTopic = { locked: false, deletedAt: null };
const lockedTopic = { locked: true, deletedAt: null };
const post = { authorId: "u1", deletedAt: null, body: "hello" };
const removed = { authorId: "u1", deletedAt: "2026-09-15T00:00:00Z", body: "hello" };

test("guests read but never write", () => {
  assert.equal(canCreateTopic(openForum, guest), false);
  assert.equal(canReply(openForum, openTopic, guest), false);
});

test("a suspended account cannot post even though it has a session", () => {
  assert.equal(canCreateTopic(openForum, banned), false);
  assert.equal(canReply(openForum, openTopic, banned), false);
});

test("an active member posts in an open forum", () => {
  assert.equal(canCreateTopic(openForum, member), true);
  assert.equal(canReply(openForum, openTopic, member), true);
});

test("locking a forum stops new topics and new replies inside it", () => {
  assert.equal(canCreateTopic(lockedForum, member), false);
  assert.equal(canReply(lockedForum, openTopic, member), false);
});

test("locking a topic stops replies but not other topics in the forum", () => {
  assert.equal(canReply(openForum, lockedTopic, member), false);
  assert.equal(canCreateTopic(openForum, member), true);
});

test("authors edit their own posts; nobody edits someone else's", () => {
  assert.equal(canEditPost(openForum, openTopic, post, member), true);
  assert.equal(canEditPost(openForum, openTopic, post, other), false);
  // Moderators remove posts; they never rewrite someone else's words.
  assert.equal(canEditPost(openForum, openTopic, post, mod), false);
});

test("a post inside a removed topic cannot be edited even if unlocked", () => {
  const deletedTopic = { locked: false, deletedAt: "2026-09-15T00:00:00Z" };
  assert.equal(canEditPost(openForum, deletedTopic, post, member), false);
  assert.equal(canReply(openForum, deletedTopic, member), false);
});

test("a removed post can no longer be edited or removed again", () => {
  assert.equal(canEditPost(openForum, openTopic, removed, member), false);
  assert.equal(canDeletePost(removed, mod), false);
});

test("moderators delete any post, members only their own", () => {
  assert.equal(canDeletePost(post, mod), true);
  assert.equal(canDeletePost(post, member), true);
  assert.equal(canDeletePost(post, other), false);
});

test("a suspended moderator cannot delete posts", () => {
  const suspendedMod = { userId: "u5", role: "moderator" as const, accountStatus: "suspended", canModerate: true };
  assert.equal(canDeletePost(post, suspendedMod), false);
});

test("a removed post renders a tombstone instead of its text", () => {
  assert.equal(postBody(post), "hello");
  assert.equal(postBody(removed), POST_TOMBSTONE);
});

test("slugs are lowercase, hyphenated, and reject anything else", () => {
  assert.equal(isValidSlug("general-discussion"), true);
  assert.equal(isValidSlug("General"), false);
  assert.equal(isValidSlug("has space"), false);
  assert.equal(isValidSlug("trailing-"), false);
  assert.equal(isValidSlug(""), false);
});

test("slugify produces a valid slug from a display name", () => {
  assert.equal(slugify("General Discussion"), "general-discussion");
  assert.equal(slugify("  Game Modes!  "), "game-modes");
  assert.equal(isValidSlug(slugify("Events & Creations")), true);
});

test("titles and bodies are bounded", () => {
  assert.equal(isValidTitle("Hi"), false, "two characters is too short");
  assert.equal(isValidTitle("A real topic title"), true);
  assert.equal(isValidTitle("x".repeat(TITLE_MAX + 1)), false);
  assert.equal(isValidTitle("   "), false, "whitespace is not a title");

  assert.equal(isValidBody(""), false);
  assert.equal(isValidBody("   \n  "), false, "whitespace is not a body");
  assert.equal(isValidBody("Something worth saying."), true);
  assert.equal(isValidBody("x".repeat(BODY_MAX + 1)), false);
});

test("only the topic author retitles, and never in a locked or removed topic", () => {
  assert.equal(canEditTopicTitle(openForum, openTopic, member, "u1"), true);
  assert.equal(canEditTopicTitle(openForum, openTopic, other, "u1"), false);
  // A moderator removes topics; retitling someone else's is rewriting them.
  assert.equal(canEditTopicTitle(openForum, openTopic, mod, "u1"), false);
  assert.equal(canEditTopicTitle(openForum, lockedTopic, member, "u1"), false);
  assert.equal(canEditTopicTitle(lockedForum, openTopic, member, "u1"), false);
  assert.equal(
    canEditTopicTitle(openForum, { locked: false, deletedAt: "2026-09-15T00:00:00Z" }, member, "u1"),
    false,
  );
});

test("a suspended account cannot retitle its own topic", () => {
  assert.equal(canEditTopicTitle(openForum, openTopic, banned, "u3"), false);
});

test("moving an item swaps it with its neighbour, not the whole list", () => {
  // The bug this replaces: with every row at the default sort_order, the last
  // item moved up jumped to the front instead of past one neighbour.
  assert.deepEqual(moveInOrder(["A", "B", "C"], 2, "up"), ["A", "C", "B"]);
  assert.deepEqual(moveInOrder(["A", "B", "C"], 0, "down"), ["B", "A", "C"]);
  assert.deepEqual(moveInOrder(["A", "B", "C", "D"], 2, "up"), ["A", "C", "B", "D"]);
});

test("moving past either end leaves the order unchanged", () => {
  assert.deepEqual(moveInOrder(["A", "B", "C"], 0, "up"), ["A", "B", "C"]);
  assert.deepEqual(moveInOrder(["A", "B", "C"], 2, "down"), ["A", "B", "C"]);
  assert.deepEqual(moveInOrder(["A"], 0, "up"), ["A"]);
  assert.deepEqual(moveInOrder([], 0, "down"), []);
});

test("moveInOrder never mutates its input", () => {
  const original = ["A", "B", "C"];
  moveInOrder(original, 1, "up");
  assert.deepEqual(original, ["A", "B", "C"]);
});

test("members report other people's live posts, never their own or removed ones", () => {
  const theirs = { authorId: "someone-else", deletedAt: null };
  assert.equal(canReportPost(theirs, member), true);
  assert.equal(canReportPost({ authorId: member.userId as string, deletedAt: null }, member), false, "own post");
  assert.equal(canReportPost({ ...theirs, deletedAt: "2026-01-01T00:00:00Z" }, member), false, "already removed");
  assert.equal(canReportPost(theirs, guest), false, "guests cannot report");
  assert.equal(canReportPost(theirs, banned), false, "suspended accounts cannot report");
});

test("deleting a post never erases another member's attachments", () => {
  const posts = [
    { id: "mine", authorId: member.userId as string, hasOpenReport: false },
    { id: "theirs", authorId: "someone-else", hasOpenReport: false },
  ];
  assert.deepEqual(purgeableImagePosts(posts, member), ["mine"]);
  assert.deepEqual(purgeableImagePosts(posts, mod), ["mine", "theirs"], "a moderator removal erases what it covers");
});

test("an attachment with an open report survives its author's delete", () => {
  const reported = [{ id: "reported", authorId: member.userId as string, hasOpenReport: true }];
  assert.deepEqual(purgeableImagePosts(reported, member), []);
  assert.deepEqual(purgeableImagePosts(reported, mod), ["reported"]);
});

test("an author deleting their opening post keeps a discussion others have joined", () => {
  assert.equal(openingDeleteRemovesTopic({ actorIsAuthor: true, othersReplied: true }), false);
  assert.equal(openingDeleteRemovesTopic({ actorIsAuthor: true, othersReplied: false }), true, "nothing to keep");
  assert.equal(openingDeleteRemovesTopic({ actorIsAuthor: false, othersReplied: true }), true, "a moderator removal takes the topic");
  assert.equal(openingDeleteRemovesTopic({ actorIsAuthor: false, othersReplied: false }), true);
});

test("deleting an opening post decides the topic's fate inside the delete transaction", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../actions/forums.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function deletePostAction"), source.indexOf("export async function reportForumPostAction"));
  const tx = body.slice(body.indexOf("db.transaction"), body.indexOf("const covered"));
  assert.match(tx, /openingDeleteRemovesTopic\(\{\s*actorIsAuthor: me\.userId === target\.authorId/);
  assert.match(tx, /ne\(schema\.forumPosts\.userId, target\.authorId\)/, "only other members' replies keep the discussion");
  assert.match(tx, /isNull\(schema\.forumPosts\.deletedAt\)/, "removed replies do not count");
  // Images: only the opening post itself is covered when the discussion stays.
  assert.match(body, /const covered = removedTopic/);
});

test("an author who deleted their opening post is not identified by an OP badge", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../../app/(site)/forums/topic/[topicId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /isOp: removed \|\| topic\.openingRemoved \? false :/);
});
