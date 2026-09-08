import assert from "node:assert/strict";
import test from "node:test";
import { selectAvatarFiles, selectSkinFiles } from "@/lib/storage/avatar-bucket-files";

// One bucket, two features. Profile photos land as avatar-*.webp and uploaded
// Minecraft skins as skin-raw-*.png / skin-head-*.png, side by side in the same
// per-user folder. Each cleanup must only ever delete its own.
const FOLDER = [
  "avatar-1786206822100.webp",
  "avatar-1788676786057.webp",
  "skin-raw-1786206822100.png",
  "skin-head-1786206822100.png",
];

test("avatar cleanup takes only the profile photos", () => {
  assert.deepEqual(selectAvatarFiles(FOLDER), [
    "avatar-1786206822100.webp",
    "avatar-1788676786057.webp",
  ]);
});

test("avatar cleanup never takes an uploaded Minecraft skin", () => {
  // This is the whole bug: setting a Discord photo, adopting an mc-heads skin
  // or removing a photo each wiped the folder, deleting the skin files while
  // minecraft_accounts kept pointing at them. The row then referenced an object
  // that no longer existed, which Supabase answers with a 400 JSON body — and
  // an <img> asking for that cross-origin gets CORB-blocked by the browser.
  const survivors = FOLDER.filter((name) => !selectAvatarFiles(FOLDER).includes(name));
  assert.deepEqual(survivors, ["skin-raw-1786206822100.png", "skin-head-1786206822100.png"]);
});

test("skin cleanup takes only the skins", () => {
  assert.deepEqual(selectSkinFiles(FOLDER), [
    "skin-raw-1786206822100.png",
    "skin-head-1786206822100.png",
  ]);
});

test("the two selections never overlap", () => {
  // If a name could be claimed by both, whichever cleanup ran last would
  // delete the other feature's file.
  const avatars = new Set(selectAvatarFiles(FOLDER));
  assert.ok(selectSkinFiles(FOLDER).every((name) => !avatars.has(name)));
});

test("a kept file is excluded from its own cleanup", () => {
  // Re-upload: the file just written must survive the sweep of older ones.
  assert.deepEqual(selectAvatarFiles(FOLDER, ["avatar-1788676786057.webp"]), [
    "avatar-1786206822100.webp",
  ]);
  assert.deepEqual(selectSkinFiles(FOLDER, ["skin-raw-1786206822100.png"]), [
    "skin-head-1786206822100.png",
  ]);
});

test("an unrecognised name is left alone by both", () => {
  // Deleting what neither feature claims is how an unrelated file disappears.
  // Nothing in the bucket looks like this today; that is a reason to keep it
  // that way, not a reason to sweep it up.
  const odd = ["legacy.png", "", "avatar", "skin-", "skin-other-1.png"];
  assert.deepEqual(selectAvatarFiles(odd), []);
  assert.deepEqual(selectSkinFiles(odd), []);
});
