import assert from "node:assert/strict";
import test from "node:test";
import { classifyPasswordUpdateError, normaliseReauthCode } from "@/lib/auth/password-reauth";

test("Supabase asking for reauthentication means: email a code", () => {
  assert.equal(classifyPasswordUpdateError("reauthentication_needed"), "send-code");
  assert.equal(classifyPasswordUpdateError("reauth_nonce_missing"), "send-code");
});

test("a wrong or expired code is reported as a bad code, not a generic failure", () => {
  assert.equal(classifyPasswordUpdateError("reauthentication_not_valid"), "bad-code");
  assert.equal(classifyPasswordUpdateError("otp_expired"), "bad-code");
});

test("anything else stays a generic failure", () => {
  assert.equal(classifyPasswordUpdateError("same_password"), "other");
  assert.equal(classifyPasswordUpdateError(undefined), "other");
});

test("codes are trimmed and must be digits of a sane length", () => {
  assert.equal(normaliseReauthCode(" 123456 "), "123456");
  assert.equal(normaliseReauthCode("12345678"), "12345678");
  assert.equal(normaliseReauthCode(""), null);
  assert.equal(normaliseReauthCode("12 34 56"), "123456");
  assert.equal(normaliseReauthCode("12345"), null);
  assert.equal(normaliseReauthCode("abc123"), null);
  assert.equal(normaliseReauthCode(null), null);
});
