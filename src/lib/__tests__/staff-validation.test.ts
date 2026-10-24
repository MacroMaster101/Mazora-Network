import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(`src/lib/actions/${file}`, "utf8").replace(/\r\n/g, "\n");

function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("store reorder and subcategory toggle actions write an audit row", () => {
  const cases: Array<[string, string, string]> = [
    ["store-admin.ts", "reorderStoreProductAction", "store.product.reorder"],
    ["store-settings.ts", "reorderStoreCategoriesAction", "store.category.reorder"],
    ["store-settings.ts", "toggleStoreSubcategoryAction", "store.subcategory.toggle"],
    ["store-settings.ts", "reorderStoreSubcategoriesAction", "store.subcategory.reorder"],
  ];
  for (const [file, fn, action] of cases) {
    const source = body(read(file), fn);
    assert.ok(source.includes("recordAudit("), `${fn} records an audit row`);
    assert.ok(source.includes(`"${action}"`), `${fn} uses ${action}`);
  }
});

test("the gallery submit throttle is keyed on the account id, not the username", () => {
  const fn = body(read("gallery.ts"), "submitGalleryAction");
  const throttle = fn.slice(fn.indexOf('throttleAuthAction("gallery-submit"'));
  assert.ok(throttle.slice(0, 200).includes("identity: userId"));
  assert.ok(!throttle.slice(0, 200).includes("session.username"));
});

test("staff toggles validate their primitive arguments", () => {
  assert.match(body(read("forms-admin.ts"), "toggleFormStatusAction"), /z\.boolean\(\)\.safeParse\(enabled\)/);
  const lock = body(read("forums-admin.ts"), "setForumLockedAction");
  assert.match(lock, /UUID\.test\(forumId\)/);
  assert.match(lock, /typeof locked !== "boolean"/);
  const vote = body(read("voting-admin.ts"), "toggleVoteSiteAction");
  assert.match(vote, /typeof enabled !== "boolean"/);
});

test("member edits are rate limited per account", () => {
  const post = body(read("forums.ts"), "editPostAction");
  assert.match(post, /accountKey\("forum-post-edit", me\.userId\)/);
  assert.ok(post.indexOf("rateLimitShared") < post.indexOf(".update(schema.forumPosts)"));
  const reply = body(read("suggestions.ts"), "editSuggestionReplyAction");
  assert.match(reply, /accountKey\("suggestion-reply-edit", userId\)/);
  assert.ok(reply.indexOf("rateLimitShared") < reply.indexOf(".update(schema.suggestionReplies)"));
});
