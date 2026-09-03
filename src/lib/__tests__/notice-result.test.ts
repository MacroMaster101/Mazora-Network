import assert from "node:assert/strict";
import test from "node:test";
import { composeNoticeResult } from "../notice-result.js";

test("a plain delivered notice with no rank change reads as before", () => {
  assert.deepEqual(composeNoticeResult({ delivered: true, rank: null }), {
    ok: true,
    message: "Notice sent.",
  });
});

test("a refused DM with no rank change fails", () => {
  const out = composeNoticeResult({ delivered: false, rank: null });
  assert.equal(out.ok, false);
  assert.match(out.message, /Discord refused the DM/);
});

test("both succeeding names the new rank", () => {
  assert.deepEqual(composeNoticeResult({ delivered: true, rank: { ok: true, to: "helper" } }), {
    ok: true,
    message: "Notice sent and rank set to helper.",
  });
});

test("a delivered DM with a refused rank change is NOT reported as success", () => {
  // The whole point: the operator must not read "Notice sent." and believe the
  // promotion happened. Half the job done is not ok:true.
  const out = composeNoticeResult({
    delivered: true,
    rank: { ok: false, to: "owner", reason: "You cannot grant a rank at or above your own." },
  });
  assert.equal(out.ok, false);
  assert.match(out.message, /Notice sent/);
  assert.match(out.message, /rank was not changed/i);
  assert.match(out.message, /at or above your own/);
});

test("a rank change that worked is reported even when the DM failed", () => {
  // The rank really did change. Saying only "the DM failed" would leave the
  // operator thinking nothing happened, and they might apply it twice.
  const out = composeNoticeResult({ delivered: false, rank: { ok: true, to: "member" } });
  assert.equal(out.ok, false);
  assert.match(out.message, /Rank set to member/);
  assert.match(out.message, /DM/);
});

test("both failing says so without claiming either worked", () => {
  const out = composeNoticeResult({
    delivered: false,
    rank: { ok: false, to: "helper", reason: "That account no longer exists." },
  });
  assert.equal(out.ok, false);
  assert.doesNotMatch(out.message, /Notice sent/);
  assert.match(out.message, /no longer exists/);
});
