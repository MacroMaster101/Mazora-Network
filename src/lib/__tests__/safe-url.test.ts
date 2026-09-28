import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isHttpsUrl, isSafeLink, isSitePath } from "../net/safe-url.js";
import { otpTypes } from "../validation/auth.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("isHttpsUrl accepts only https links with a host and no credentials", () => {
  assert.equal(isHttpsUrl("https://discord.gg/example"), true);
  assert.equal(isHttpsUrl("http://discord.gg/example"), false);
  assert.equal(isHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isHttpsUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isHttpsUrl("https://user:pass@example.com/"), false);
  assert.equal(isHttpsUrl("/news"), false);
  assert.equal(isHttpsUrl(""), false);
});

test("isSafeLink allows site paths and https links, never another scheme or host-relative path", () => {
  assert.equal(isSafeLink("/news"), true);
  assert.equal(isSafeLink("/support/suggestions/1?tab=replies"), true);
  assert.equal(isSafeLink("https://example.com/page"), true);
  assert.equal(isSafeLink("//evil.example"), false);
  assert.equal(isSafeLink("/\\evil.example"), false);
  assert.equal(isSafeLink("/\tnews"), false);
  assert.equal(isSafeLink("javascript:alert(1)"), false);
  assert.equal(isSafeLink("JavaScript:alert(1)"), false);
});

test("staff-typed links are checked for their scheme, not just parsed", () => {
  const settings = read("../actions/site-settings.ts");
  assert.match(settings, /discord: z\.string\(\)\.trim\(\)\.refine\(isHttpsUrl,/);
  assert.match(settings, /discordSupportTickets: z\.string\(\)\.trim\(\)\.refine\(isHttpsUrl,/);
  assert.match(read("../actions/notifications.ts"), /isSafeLink\(value\)/);
});

test("the confirm button only accepts the links this site emails", () => {
  // A magiclink token for the sender's own account would sign the clicker into it.
  assert.deepEqual([...otpTypes], ["signup", "email", "recovery"]);
});

test("isSitePath accepts this site's paths only", () => {
  assert.equal(isSitePath("/images/og-default.webp"), true);
  assert.equal(isSitePath("//evil.example/x.png"), false);
  assert.equal(isSitePath("/\\evil.example/x.png"), false);
  assert.equal(isSitePath("/\timages/x.png"), false);
  assert.equal(isSitePath("https://example.com/x.png"), false);
});
