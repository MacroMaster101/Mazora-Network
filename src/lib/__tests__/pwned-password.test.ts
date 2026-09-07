import assert from "node:assert/strict";
import test from "node:test";
import { countBreaches, splitPasswordHash } from "../pwned-password-shared.js";

test("only the first five hex characters of the hash ever leave the server", async () => {
  // The whole point of the k-anonymity scheme: HIBP is sent a prefix that
  // matches hundreds of hashes, and never learns which one was asked about.
  const { prefix, suffix } = await splitPasswordHash("password");
  assert.equal(prefix, "5BAA6");
  assert.equal(suffix, "1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  assert.equal(prefix.length, 5, "the prefix sent upstream must be exactly 5 characters");
  assert.equal(suffix.length, 35, "the remaining 35 characters must stay local");
});

test("the same password always produces the same split, a different one does not", async () => {
  assert.deepEqual(await splitPasswordHash("hunter2"), await splitPasswordHash("hunter2"));
  assert.notDeepEqual(await splitPasswordHash("hunter2"), await splitPasswordHash("hunter3"));
});

test("non-ASCII passwords are hashed as UTF-8", async () => {
  // Hashing these as latin1 would silently let a breached passphrase through.
  const { prefix, suffix } = await splitPasswordHash("pässwörd–🔐");
  assert.match(prefix, /^[0-9A-F]{5}$/);
  assert.match(suffix, /^[0-9A-F]{35}$/);
});

const RANGE_BODY = [
  "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365",
  "0018A45C4D1DEF81644B54AB7F969B88D65:1",
  "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2",
].join("\r\n");

test("a suffix present in the range is reported with its breach count", () => {
  assert.equal(countBreaches(RANGE_BODY, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), 9659365);
});

test("a suffix absent from the range counts as zero", () => {
  assert.equal(countBreaches(RANGE_BODY, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), 0);
});

test("matching is case-insensitive", () => {
  // HIBP returns uppercase today; nothing in the API guarantees it keeps doing so.
  assert.equal(countBreaches(RANGE_BODY.toLowerCase(), "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), 9659365);
});

test("padding entries are not treated as breaches", () => {
  // The request asks for padding, which pads the response with fabricated
  // suffixes at count 0 so the response size cannot fingerprint the prefix.
  // A padded row must never fail a password.
  assert.equal(countBreaches("ABCDEFABCDEFABCDEFABCDEFABCDEFABCDE:0", "ABCDEFABCDEFABCDEFABCDEFABCDEFABCDE"), 0);
});

test("a malformed or empty response counts as zero rather than throwing", () => {
  // This runs in the signup path. A bad response has to mean "carry on",
  // never an exception that takes registration down with it.
  for (const body of ["", "\r\n", "garbage", "NOCOLON", ":", "ABC:notanumber"]) {
    assert.equal(countBreaches(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"), 0, `threw or misread on ${JSON.stringify(body)}`);
  }
});
