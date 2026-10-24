import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { newsClientKey, normalizeClientIp } from "../../app/api/news/_client-key";

const req = (headers: Record<string, string>) => new Request("https://example.com/api/news/visitors", { headers });

test("IPv6 addresses in one /64 share a key", () => {
  const a = newsClientKey(req({ "x-forwarded-for": "2001:db8:1:2:aaaa:bbbb:cccc:dddd" }), "s");
  const b = newsClientKey(req({ "x-forwarded-for": "2001:DB8:1:2::1" }), "s");
  const c = newsClientKey(req({ "x-forwarded-for": "2001:db8:1:3::1" }), "s");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("normalisation handles compression, zones, mapped IPv4 and junk", () => {
  assert.equal(normalizeClientIp("2001:db8::1"), "2001:0db8:0000:0000::/64");
  assert.equal(normalizeClientIp("fe80::1%eth0"), "fe80:0000:0000:0000::/64");
  assert.equal(normalizeClientIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeClientIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeClientIp("unknown"), "unknown");
  assert.equal(normalizeClientIp("1:2:3::4::5"), "1:2:3::4::5");
});

test("IPv4 clients stay per address and the key holds no raw IP", () => {
  const a = newsClientKey(req({ "x-forwarded-for": "203.0.113.7" }), "s");
  const b = newsClientKey(req({ "x-forwarded-for": "203.0.113.8" }), "s");
  assert.notEqual(a, b);
  assert.match(a, /^s:[0-9a-f]{16}$/);
});

test("both counter routes use the /64-aware key", () => {
  for (const path of ["../../app/api/news/visitors/route.ts", "../../app/api/news/[slug]/reads/route.ts"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /newsClientKey/);
    assert.doesNotMatch(source, /\bclientKey\(/);
  }
});
