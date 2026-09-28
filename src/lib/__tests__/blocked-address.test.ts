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
  ]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test("public IPv6 addresses and their public IPv4 translations are allowed", () => {
  for (const ip of ["2606:4700:4700::1111", "64:ff9b::808:808", "2002:808:808::1", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedAddress(ip), false, ip);
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
