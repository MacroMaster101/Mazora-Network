import assert from "node:assert/strict";
import test from "node:test";
import { savedTimeZone, validTimeZone } from "@/lib/time-zone";

test("only real IANA zones are accepted", () => {
  assert.equal(validTimeZone("Asia/Colombo"), "Asia/Colombo");
  assert.equal(validTimeZone("UTC"), "UTC");
  for (const value of ["", "Not/A_Zone", "<script>", "x".repeat(65), 5, null, undefined, {}]) {
    assert.equal(validTimeZone(value), null);
  }
});

test("a saved zone is read from user metadata, which the member can edit, so it is checked", () => {
  assert.equal(savedTimeZone({ time_zone: "Europe/London" }), "Europe/London");
  assert.equal(savedTimeZone({ time_zone: "Mars/Olympus" }), null);
  assert.equal(savedTimeZone({}), null);
  assert.equal(savedTimeZone(undefined), null);
});
