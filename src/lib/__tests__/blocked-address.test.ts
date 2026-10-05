import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isBlockedAddress, isBlockedIpLiteralHost } from "@/lib/net/blocked-address";

const hostOf = (url: string) => new URL(url).hostname;

test("IP-literal image URLs pointing inside the network are refused", () => {
  for (const url of [
    "http://127.0.0.1/a.png",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/", // 127.0.0.1 as one number
    "http://0x7f.1/", // 127.0.0.1 in hex shorthand
    "http://0.0.0.0/",
  ]) {
    assert.equal(isBlockedIpLiteralHost(hostOf(url)), true, url);
  }
});

test("public IP literals and ordinary hostnames are left to the DNS guard", () => {
  for (const url of ["http://8.8.8.8/x.png", "https://i.imgur.com/x.png", "https://cdn.example.com/a.webp"]) {
    assert.equal(isBlockedIpLiteralHost(hostOf(url)), false, url);
  }
});

test("IPv6 forms that carry an internal IPv4 address are refused", () => {
  for (const ip of [
    "::7f00:1", // IPv4-compatible 127.0.0.1
    "::127.0.0.1",
    "0:0:0:0:0:ffff:a9fe:a9fe", // mapped 169.254.169.254, spelled out
    "64:ff9b::a9fe:a9fe", // NAT64 to the metadata address
    "64:ff9b::10.0.0.1",
    "64:ff9b:1::1", // local-use NAT64
    "2002:7f00:1::", // 6to4 of 127.0.0.1
    "2002:c0a8:101::1", // 6to4 of 192.168.1.1
    "2001:0:4136:e378:8000:63bf:3fff:fdd2", // Teredo
    "fd12:3456::1",
    "fe80::1%eth0",
    "fec0::1",
    "0000:0000:0000:0000:0000:0000:0000:0001",
    "::ffff:0:7f00:1", // IPv4-translated 127.0.0.1
    "::ffff:0:127.0.0.1",
    "::ffff:0:a9fe:a9fe", // IPv4-translated metadata address
    "::ffff:0:10.0.0.1",
    "0:0:0:0:ffff:0:c0a8:101", // IPv4-translated 192.168.1.1, spelled out
  ]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test("public IPv6 addresses and their public IPv4 translations are allowed", () => {
  for (const ip of [
    "2606:4700:4700::1111",
    "64:ff9b::808:808",
    "2002:808:808::1",
    "::ffff:8.8.8.8",
    "::ffff:0:808:808", // IPv4-translated 8.8.8.8
    "::ffff:0:8.8.8.8",
  ]) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test("the IPv4-translated form is refused as a URL host when it points inside", () => {
  for (const url of ["http://[::ffff:0:7f00:1]/", "http://[::ffff:0:169.254.169.254]/latest/meta-data/"]) {
    assert.equal(isBlockedIpLiteralHost(hostOf(url)), true, url);
  }
  assert.equal(isBlockedIpLiteralHost(hostOf("http://[::ffff:0:8.8.8.8]/x.png")), false);
});

test("the address rules still fail closed on anything unparseable", () => {
  assert.equal(isBlockedAddress("not-an-ip"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
});

test("rehostImageFromUrl checks IP literals on every hop before requesting", () => {
  const src = readFileSync(new URL("../news/image-store.ts", import.meta.url), "utf8");
  const loop = src.slice(src.indexOf("for (let hop = 0;"), src.indexOf("if (!response) return null; // ran out"));
  const guard = loop.indexOf("if (isBlockedIpLiteralHost(current.hostname)) return null;");
  assert.ok(guard > 0, "guard inside the redirect loop");
  const request = loop.indexOf("await requestImage(current, deadline)");
  assert.ok(request > 0, "the request is made inside the redirect loop");
  assert.ok(guard < request, "guard runs before the request");
});

test("a remote image fetch runs against one overall deadline, not just an idle timeout", () => {
  const src = readFileSync(new URL("../news/image-store.ts", import.meta.url), "utf8");

  // One clock for the whole fetch, stopped whatever the outcome.
  const rehost = src.slice(src.indexOf("export async function rehostImageFromUrl("), src.indexOf("async function downloadImage("));
  assert.match(rehost, /const deadline = startFetchDeadline\(REMOTE_FETCH_DEADLINE_MS\);/);
  assert.match(rehost, /try \{\s*bytes = await downloadImage\(url, deadline\);\s*\} finally \{\s*deadline\.finish\(\);\s*\}/);

  // Every request joins it before it is sent, and none starts after it passed.
  const request = src.slice(src.indexOf("function requestImage("), src.indexOf("export async function rehostImageFromUrl("));
  assert.match(request, /if \(deadline\.expired\) return Promise\.resolve\(null\);/);
  assert.ok(request.indexOf("deadline.track(req);") > 0);
  assert.ok(request.indexOf("deadline.track(req);") < request.indexOf("req.end();"));

  // Expiry destroys the open requests, and a body it cut short is not stored.
  const clock = src.slice(src.indexOf("function startFetchDeadline("), src.indexOf("function requestImage("));
  assert.match(clock, /setTimeout\(\(\) => \{\s*expired = true;\s*closeAll\(\);\s*\}, ms\)/);
  assert.match(clock, /for \(const request of requests\) request\.destroy\(\);/);
  assert.match(src, /if \(!bytes \|\| deadline\.expired\) return null;/);

  const budget = Number(src.match(/const REMOTE_FETCH_DEADLINE_MS = ([\d_]+);/)?.[1].replaceAll("_", ""));
  assert.ok(budget >= 5_000 && budget <= 30_000, `unexpected deadline: ${budget}`);
});

test("the connect-time guard, the idle timeout and the size cap are still in place", () => {
  const src = readFileSync(new URL("../news/image-store.ts", import.meta.url), "utf8");
  assert.match(src, /lookup: secureLookup as http\.RequestOptions\["lookup"\]/);
  assert.match(src, /req\.setTimeout\(15_000, \(\) => req\.destroy\(\)\)/);
  assert.match(src, /const MAX_IMAGE_BYTES = 8 \* 1024 \* 1024;/);
  assert.match(src, /if \(total > MAX_IMAGE_BYTES\) \{\s*stream\.destroy\(\);/);
});

test("uploads to the shared bucket do not overwrite unless the caller asks", () => {
  const src = readFileSync(new URL("../news/image-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /upsert: true/);
  assert.match(src, /upsert: overwrite,/);
  // Nothing is inferred from the key: unset means no overwrite, for every folder.
  assert.match(src, /const overwrite = options\.overwrite === true;/);
  assert.doesNotMatch(src, /options\.overwrite \?\?/);
  assert.doesNotMatch(src, /DISCORD_ORIGINAL_PREFIX/);
  assert.match(src, /return `discord\/\$\{discordMessageId\}`;/);

  // The announcement original reuses the message-id key, so both of its callers ask.
  const importer = readFileSync(new URL("../news/discord-import.ts", import.meta.url), "utf8");
  assert.match(importer, /discordOriginalKey\(mapped\.discordMessageId\),\s*\{ overwrite: true \},/);
  const news = readFileSync(new URL("../actions/news.ts", import.meta.url), "utf8");
  assert.match(news, /const key = discordOriginalKey\(article\.messageId\);/);
  assert.match(news, /rehostImageFromUrl\(attachment, key, \{ overwrite: true \}\)/);
  // Every other news upload builds a fresh timestamped key and never asks.
  assert.equal((news.match(/overwrite: true/g) ?? []).length, 1);
  assert.equal((importer.match(/overwrite: true/g) ?? []).length, 1);

  // The other caller that reuses a key says so; a new submission never does.
  const gallery = readFileSync(new URL("../actions/gallery.ts", import.meta.url), "utf8");
  assert.match(gallery, /resolveGalleryImage\(formData, id \|\| `admin-\$\{randomUUID\(\)\}`, Boolean\(id\)\)/);
  assert.match(gallery, /resolveGalleryImage\(formData, `submit-\$\{randomUUID\(\)\}`\)/);
  assert.match(gallery, /overwrite = false,/);
});
