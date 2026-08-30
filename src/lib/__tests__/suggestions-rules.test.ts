import assert from "node:assert/strict";
import test from "node:test";
import { ROLES } from "@/lib/auth/roles";
import {
  canPostReply, canEditReply, canDeleteReply, canVote,
  replyBody, REPLY_TOMBSTONE, DEFAULT_SUGGESTION_SORT, SUGGESTION_SORTS,
  effectiveParentId,
} from "@/lib/suggestions-rules";

const guest = { userId: null, role: null, canModerate: false };
const author = { userId: "u1", role: "member" as const, canModerate: false };
const other = { userId: "u2", role: "member" as const, canModerate: false };
const mod = { userId: "u3", role: "moderator" as const, canModerate: true };
const open = { locked: false };
const locked = { locked: true };
const reply = { authorId: "u1", deletedAt: null, body: "hello" };
const removed = { authorId: "u1", deletedAt: "2026-08-27T00:00:00Z", body: "hello" };

test("guests can read but never write", () => {
  assert.equal(canPostReply(open, guest), false);
  assert.equal(canVote(guest), false);
  assert.equal(canEditReply(open, reply, guest), false);
  assert.equal(canDeleteReply(open, reply, guest), false);
});

test("a signed-in member can reply to an open thread and vote", () => {
  assert.equal(canPostReply(open, other), true);
  assert.equal(canVote(other), true);
});

test("a locked thread refuses new replies and author edits", () => {
  assert.equal(canPostReply(locked, other), false);
  assert.equal(canEditReply(locked, reply, author), false);
});

test("only the author edits their own reply", () => {
  assert.equal(canEditReply(open, reply, author), true);
  assert.equal(canEditReply(open, reply, other), false);
  assert.equal(canEditReply(open, reply, mod), false, "moderators remove, they do not rewrite");
});

test("authors delete their own; moderators delete any, even when locked", () => {
  assert.equal(canDeleteReply(open, reply, author), true);
  assert.equal(canDeleteReply(open, reply, other), false);
  assert.equal(canDeleteReply(locked, reply, mod), true);
  assert.equal(
    canDeleteReply(locked, reply, author),
    false,
    "a locked thread freezes the author's own delete; only moderators act",
  );
});

test("an already-removed reply cannot be edited or removed again", () => {
  assert.equal(canEditReply(open, removed, author), false);
  assert.equal(canDeleteReply(open, removed, mod), false);
});

test("a removed reply renders a tombstone, never its original body", () => {
  assert.equal(replyBody(reply), "hello");
  assert.equal(replyBody(removed), REPLY_TOMBSTONE);
});

test("the board defaults to newest so new ideas are not buried", () => {
  assert.equal(DEFAULT_SUGGESTION_SORT, "newest");
  assert.deepEqual(SUGGESTION_SORTS, ["newest", "top"]);
});

test("posting rights depend on session, not rank", () => {
  for (const role of ROLES) {
    assert.equal(canPostReply(open, { userId: "x", role, canModerate: false }), true, role);
  }
});

test("effectiveParentId: no parent means a top-level reply", () => {
  assert.equal(effectiveParentId(null), null);
});

test("effectiveParentId: replying to a top-level reply attaches to it", () => {
  assert.equal(effectiveParentId({ id: "top", parentId: null }), "top");
});

test("effectiveParentId: replying to a child re-points to its top-level ancestor", () => {
  assert.equal(effectiveParentId({ id: "child", parentId: "top" }), "top");
});
