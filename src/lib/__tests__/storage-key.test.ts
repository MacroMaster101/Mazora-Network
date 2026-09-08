import assert from "node:assert/strict";
import test from "node:test";
import { MAX_STORAGE_KEY_LENGTH, safeStorageKey } from "@/lib/storage-key";

test("the keys this codebase actually builds pass through unchanged", () => {
  // Every caller composes a prefix with a uuid, a slug or a snowflake and a
  // timestamp. None of that should be touched, or existing objects stop
  // resolving.
  for (const key of [
    "custom/8f14e45f-ea0e-4d6a-9c3b-1234567890ab-1788764715812",
    "gallery/submit-1788764715812",
    "gallery/admin-1787143194829",
    "store/rank-hero-monthly-1788764715812",
    "discord/1514998467817242715",
  ]) {
    assert.equal(safeStorageKey(key), key);
  }
});

test("a traversal segment is dropped rather than escaping the prefix", () => {
  // The reason this exists: `id` arrives from a form as free text and is
  // interpolated straight into the key, and the upload uses upsert.
  assert.equal(safeStorageKey("custom/../../evil-1"), "custom/evil-1");
  assert.equal(safeStorageKey("../../../etc/passwd"), "etc/passwd");
  assert.equal(safeStorageKey("custom/../gallery/x"), "custom/gallery/x");
});

test("a lone dot segment is dropped too", () => {
  assert.equal(safeStorageKey("custom/./x"), "custom/x");
});

test("empty segments and stray slashes collapse", () => {
  assert.equal(safeStorageKey("/custom//x/"), "custom/x");
});

test("characters outside the allowed set are removed", () => {
  assert.equal(safeStorageKey("custom/a b:c?d*e"), "custom/abcde");
  assert.equal(safeStorageKey("custom/héllo–🔐"), "custom/hllo");
});

test("dots inside a segment are left alone — only a whole `..` segment traverses", () => {
  // A storage key is a string, not a filesystem path: a backslash is not a
  // separator here, and "x..y" is simply an object named "x..y". Stripping
  // dots mid-segment would mangle legitimate names for no security gain.
  assert.equal(safeStorageKey("custom/x\\..\\y"), "custom/x..y");
  assert.equal(safeStorageKey("custom/file..name"), "custom/file..name");
});

test("no segment of the result is ever a traversal segment", () => {
  // The property that actually matters, asserted across the awkward inputs
  // rather than pinning one exact string per case.
  for (const input of [
    "custom/../../evil",
    "..\\..\\evil",
    "custom/./../x",
    "/../custom/..",
    "custom/..%2F..%2Fx",
    "custom/....//x",
  ]) {
    const key = safeStorageKey(input);
    if (key === null) continue;
    assert.ok(!key.startsWith("/"), `leading slash in ${key}`);
    for (const segment of key.split("/")) {
      assert.notEqual(segment, "..", `traversal segment survived in ${key}`);
      assert.notEqual(segment, ".", `dot segment survived in ${key}`);
      assert.notEqual(segment, "", `empty segment survived in ${key}`);
    }
  }
});

test("a key that sanitises away to nothing is refused, not silently rewritten", () => {
  // Returning "" would upload to the bucket root under a bare extension and
  // upsert over whatever was already there.
  for (const junk of ["", "   ", "/", "..", "../..", "🔐", "///"]) {
    assert.equal(safeStorageKey(junk), null, `expected null for ${JSON.stringify(junk)}`);
  }
});

test("an over-long key is truncated rather than refused", () => {
  const long = `custom/${"a".repeat(500)}`;
  const result = safeStorageKey(long);
  assert.ok(result);
  assert.ok(result.length <= MAX_STORAGE_KEY_LENGTH, `got ${result.length}`);
  assert.ok(result.startsWith("custom/"), "the prefix must survive truncation");
});

test("truncation never leaves a trailing separator or dot", () => {
  // `${key}.${ext}` is appended by the caller, so a key ending in / or .
  // would produce `custom/x/.webp` or `custom/x..webp`.
  const result = safeStorageKey(`custom/${"a".repeat(MAX_STORAGE_KEY_LENGTH)}/bbb`);
  assert.ok(result);
  assert.ok(!result.endsWith("/") && !result.endsWith("."), `got ${JSON.stringify(result)}`);
});
