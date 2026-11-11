import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { profileName } from "@/lib/member-name";

/*
  Names other members read (reply notifications, gallery credits) come from the
  member's profile row, never from Session.displayName, which falls back to
  Supabase user_metadata that the member can write directly.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
/** Source with comments removed, so an assertion cannot be met by prose. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

test("the profile's display name wins, then its username, then the fallback", () => {
  assert.equal(profileName({ displayName: "Alex Builder", username: "Alex_Builder" }, "player"), "Alex Builder");
  assert.equal(profileName({ displayName: "  Alex Builder  ", username: "Alex_Builder" }, "player"), "Alex Builder");
  assert.equal(profileName({ displayName: null, username: "Steve_42" }, "player"), "Steve_42");
  assert.equal(profileName({ displayName: "   ", username: "Steve_42" }, "player"), "Steve_42");
  assert.equal(profileName({ displayName: null, username: null }, "Steve_42"), "Steve_42");
  assert.equal(profileName(undefined, "Steve_42"), "Steve_42");
});

test("the signup placeholder is not a name and gives way to the username", () => {
  assert.equal(profileName({ displayName: "New Player", username: "player_0a1b2c3d" }, "player"), "player_0a1b2c3d");
});

test("nothing outside the profile row can supply the name", () => {
  // Only the two profile fields are read; there is no metadata parameter to pass.
  const source = code("../member-name.ts");
  assert.doesNotMatch(source, /metadata|full_name|user_metadata/);
});

test("reply notifications and gallery credits use the profile name, not the session's", () => {
  const forums = code("../actions/forums.ts");
  const actor = forums.slice(forums.indexOf("async function currentActor"), forums.indexOf("export async function createTopicAction"));
  assert.match(actor, /displayName: schema\.profiles\.displayName,\s*username: schema\.profiles\.username,/);
  assert.match(actor, /username: profileName\(profile, session\.username\),/);
  // The forum reply notification is built from that name.
  assert.match(forums, /replierName: me\.username/);

  const suggestions = code("../actions/suggestions.ts");
  assert.match(suggestions, /replierName: profileName\(replierProfile, session\.username\),/);
  assert.match(
    suggestions,
    /const \[replierProfile\] = await db\s*\.select\(\{ displayName: schema\.profiles\.displayName, username: schema\.profiles\.username \}\)\s*\.from\(schema\.profiles\)\s*\.where\(eq\(schema\.profiles\.userId, userId\)\)/,
  );

  const gallery = code("../actions/gallery.ts");
  assert.match(gallery, /const authorName = profileName\(profile, session\.username \|\| "Player"\);/);
  assert.match(gallery, /\.where\(eq\(schema\.profiles\.userId, userId\)\)/);

  for (const [file, source] of [["forums.ts", forums], ["suggestions.ts", suggestions], ["gallery.ts", gallery]]) {
    assert.doesNotMatch(source, /session\.displayName/, file);
  }
});

test("a failed name lookup cannot fail a suggestion reply that already landed", () => {
  const suggestions = code("../actions/suggestions.ts");
  const lookup = suggestions.slice(suggestions.indexOf("const [replierProfile]"), suggestions.indexOf("dispatchSuggestionReplyNotification({"));
  assert.match(lookup, /\.limit\(1\)\s*\.catch\(\(error\) => \{[^}]*return \[\];\s*\}\);/);
  assert.ok(suggestions.indexOf("const [replierProfile]") > suggestions.indexOf(".insert(schema.suggestionReplies)"));
});
