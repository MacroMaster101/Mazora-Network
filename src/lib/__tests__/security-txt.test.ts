import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = readFileSync(new URL("../../../public/.well-known/security.txt", import.meta.url), "utf8");

function field(name: string): string | undefined {
  return text.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim();
}

test("security.txt carries the RFC 9116 required fields", () => {
  assert.match(field("Contact") ?? "", /^https:\/\//);
  assert.equal(field("Canonical"), "https://mazora.us/.well-known/security.txt");
});

/*
  RFC 9116 makes Expires mandatory and tells readers to ignore an expired file,
  so a lapsed date silently removes the security contact. This fails a month
  ahead of the date so it is renewed in time: bump Expires by a year.
*/
test("security.txt Expires is at least 30 days away", () => {
  const expires = Date.parse(field("Expires") ?? "");
  assert.ok(Number.isFinite(expires), "Expires must be an ISO 8601 date");
  const daysLeft = (expires - Date.now()) / 86_400_000;
  assert.ok(daysLeft >= 30, `security.txt expires in ${Math.floor(daysLeft)} days; renew public/.well-known/security.txt`);
  assert.ok(daysLeft <= 366, "RFC 9116 recommends an Expires date less than a year ahead");
});
