import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("forum comments", () => {
  const actions = read("../actions/forums.ts");
  const rules = read("../forums-rules.ts");

  test("replies attach directly to the post answered; the depth-one rule is gone", () => {
    assert.doesNotMatch(rules, /replyParentId/);
    assert.doesNotMatch(actions, /replyParentId/);
    assert.match(actions, /target\.topicId !== topic\.id/);
  });

  test("voting checks the session and account status before writing", () => {
    const start = actions.indexOf("export async function voteOnForumPostAction");
    assert.ok(start > -1);
    const body = actions.slice(start);
    const guard = body.indexOf("canVoteOnComment(");
    const write = body.indexOf("insert(schema.forumPostVotes)");
    assert.ok(body.indexOf("currentActor()") > -1 && guard > -1 && write > guard);
  });
});

describe("suggestion comments", () => {
  const actions = read("../actions/suggestions.ts");
  const rules = read("../suggestions-rules.ts");

  test("replies attach directly to the reply answered; the depth-one rule is gone", () => {
    assert.doesNotMatch(rules, /effectiveParentId/);
    assert.doesNotMatch(actions, /effectiveParentId/);
    assert.match(actions, /parent\.suggestionId !== suggestionId/);
  });

  test("voting checks the session and account status before writing", () => {
    const start = actions.indexOf("export async function voteOnSuggestionReplyAction");
    assert.ok(start > -1);
    const body = actions.slice(start);
    const status = body.indexOf("accountStatus");
    const guard = body.indexOf("canVoteOnComment(");
    const write = body.indexOf("insert(schema.suggestionReplyVotes)");
    assert.ok(body.indexOf("getSession()") > -1 && status > -1 && guard > status && write > guard);
  });
});
