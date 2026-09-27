import assert from "node:assert/strict";
import test from "node:test";
import { hostMatches, urlHostMatches } from "../net/host-match.js";

test("a host matches its own domain and its subdomains", () => {
  assert.equal(hostMatches("mc-heads.net", "mc-heads.net"), true);
  assert.equal(hostMatches("api.mc-heads.net", "mc-heads.net"), true);
  assert.equal(hostMatches("LH3.GoogleUserContent.com", "googleusercontent.com"), true);
});

test("lookalike hosts that a substring check would accept are rejected", () => {
  assert.equal(hostMatches("evil-mc-heads.net", "mc-heads.net"), false);
  assert.equal(hostMatches("mc-heads.net.example.com", "mc-heads.net"), false);
  assert.equal(hostMatches("notpooler.supabase.com", "pooler.supabase.com"), false);
});

test("urlHostMatches reads the host from a full URL and never throws", () => {
  assert.equal(urlHostMatches("https://cdn.discordapp.com/avatars/1/a.png", "cdn.discordapp.com"), true);
  assert.equal(urlHostMatches("https://example.com/?next=cdn.discordapp.com", "cdn.discordapp.com"), false);
  assert.equal(urlHostMatches("/storage/skin-head-1.png", "mc-heads.net"), false);
  assert.equal(urlHostMatches("not a url", "mc-heads.net"), false);
  assert.equal(urlHostMatches(null, "mc-heads.net"), false);
});
