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

test("the address rules still fail closed on anything unparseable", () => {
  assert.equal(isBlockedAddress("not-an-ip"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
});

test("rehostImageFromUrl checks IP literals on every hop before requesting", () => {
  const src = readFileSync(new URL("../news/image-store.ts", import.meta.url), "utf8");
  const loop = src.slice(src.indexOf("for (let hop = 0;"), src.indexOf("if (!response) return null; // ran out"));
  const guard = loop.indexOf("if (isBlockedIpLiteralHost(current.hostname)) return null;");
  assert.ok(guard > 0, "guard inside the redirect loop");
  assert.ok(guard < loop.indexOf("await requestImage(current)"), "guard runs before the request");
});
