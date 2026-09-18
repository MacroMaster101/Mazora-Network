import assert from "node:assert/strict";
import test from "node:test";
import { canVoteOnComment, isVoteValue, nextVote, scoreAfter } from "@/lib/comments/vote-rules";

const live = { authorId: "author", deletedAt: null };
const member = { userId: "voter", accountStatus: "active" };

test("active members vote on other people's live comments", () => {
  assert.equal(canVoteOnComment(live, member), true);
});

test("guests, suspended accounts, authors and removed comments cannot be voted on", () => {
  assert.equal(canVoteOnComment(live, { userId: null, accountStatus: null }), false);
  assert.equal(canVoteOnComment(live, { userId: "voter", accountStatus: "suspended" }), false);
  assert.equal(canVoteOnComment(live, { userId: "author", accountStatus: "active" }), false);
  assert.equal(canVoteOnComment({ ...live, deletedAt: "2026-01-01T00:00:00Z" }, member), false);
});

test("clicking the same arrow again removes the vote; the other arrow switches it", () => {
  assert.equal(nextVote(0, 1), 1);
  assert.equal(nextVote(1, 1), 0);
  assert.equal(nextVote(1, -1), -1);
  assert.equal(nextVote(-1, -1), 0);
  assert.equal(nextVote(-1, 1), 1);
});

test("scoreAfter moves exactly one vote", () => {
  assert.deepEqual(scoreAfter(3, 1, 0, 1), { up: 4, down: 1 });
  assert.deepEqual(scoreAfter(3, 1, 1, 0), { up: 2, down: 1 });
  assert.deepEqual(scoreAfter(3, 1, 1, -1), { up: 2, down: 2 });
  assert.deepEqual(scoreAfter(3, 1, -1, 1), { up: 4, down: 0 });
  assert.deepEqual(scoreAfter(0, 0, 0, 0), { up: 0, down: 0 });
});

test("only -1, 0 and 1 are vote values", () => {
  assert.ok(isVoteValue(0) && isVoteValue(1) && isVoteValue(-1));
  assert.ok(!isVoteValue(2) && !isVoteValue("1") && !isVoteValue(null));
});
