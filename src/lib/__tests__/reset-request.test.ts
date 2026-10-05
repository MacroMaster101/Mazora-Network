import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deriveGrantKey, deriveResetGrantKey } from "@/lib/auth/reset-grant-core";
import {
  RESET_REQUEST_TTL_SECONDS,
  resetRequestPending,
  signResetRequest,
  verifyResetRequest,
} from "@/lib/auth/reset-request-core";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const key = deriveGrantKey("test-secret", "password-reset-request");
const now = 1_800_000_000;

test("a reset marker verifies only for the email it was requested for", () => {
  const marker = signResetRequest("steve_42@example.com", key, now);
  assert.equal(verifyResetRequest(marker, "steve_42@example.com", key, now + 60), true);
  // The auth server's copy of the address may differ in case or padding.
  assert.equal(verifyResetRequest(marker, " Steve_42@Example.com ", key, now + 60), true);
  // Someone else's reset link, opened in this browser.
  assert.equal(verifyResetRequest(marker, "alex_builder@example.com", key, now + 60), false);
  assert.equal(verifyResetRequest(marker, undefined, key, now + 60), false);
  assert.equal(verifyResetRequest(marker, "", key, now + 60), false);
});

test("a reset marker does not carry the email", () => {
  const marker = signResetRequest("steve_42@example.com", key, now);
  assert.doesNotMatch(marker, /steve|example|@/i);
  assert.doesNotMatch(Buffer.from(marker.split(".")[1], "base64url").toString("latin1"), /steve_42@example\.com/i);
  assert.match(marker, /^\d+\.[A-Za-z0-9_-]{43}$/);
});

test("a reset marker expires with the link", () => {
  const marker = signResetRequest("steve_42@example.com", key, now);
  assert.equal(resetRequestPending(marker, now + RESET_REQUEST_TTL_SECONDS - 1), true);
  assert.equal(resetRequestPending(marker, now + RESET_REQUEST_TTL_SECONDS), false);
  assert.equal(verifyResetRequest(marker, "steve_42@example.com", key, now + RESET_REQUEST_TTL_SECONDS), false);
});

test("no marker, or a malformed one, is not a pending request", () => {
  for (const value of [undefined, null, "", "abc", ".abc", "12.34.56", "soon.abc"]) {
    assert.equal(resetRequestPending(value, now), false, String(value));
    assert.equal(verifyResetRequest(value, "steve_42@example.com", key, now), false, String(value));
  }
});

test("a forged or stretched marker does not verify", () => {
  const marker = signResetRequest("steve_42@example.com", key, now);
  const [expiry, sig] = marker.split(".");
  // Pushing the expiry out breaks the MAC, which covers it.
  assert.equal(verifyResetRequest(`${Number(expiry) + 99_999}.${sig}`, "steve_42@example.com", key, now), false);
  // Looks pending, so the token would be spent, but the account check still fails.
  assert.equal(resetRequestPending(`${now + 600}.forged`, now), true);
  assert.equal(verifyResetRequest(`${now + 600}.forged`, "steve_42@example.com", key, now), false);
  // Its own purpose key: a key for the reset grant does not sign markers.
  assert.equal(verifyResetRequest(marker, "steve_42@example.com", deriveResetGrantKey("test-secret"), now), false);
  assert.equal(verifyResetRequest(marker, "steve_42@example.com", deriveGrantKey("other-secret", "password-reset-request"), now), false);
});

test("asking for a reset marks the browser whether or not the account exists", () => {
  const src = read("../actions/auth.ts");
  const start = src.indexOf("export async function requestPasswordResetAction");
  const request = src.slice(start, src.indexOf("\n}\n", start));
  const mark = request.indexOf("await markResetRequested(parsed.data.email);");
  const send = request.indexOf("supabase.auth.resetPasswordForEmail(");
  assert.ok(mark > 0 && mark < send, "set before, and so regardless of, what the auth server answers");
  // Nothing between the two may branch on the account.
  assert.doesNotMatch(request.slice(mark, send), /\bif\b|\breturn\b/);
  assert.ok(mark > request.indexOf('throttleAuthAction("reset-request"'), "after the throttle");

  const cookie = read("../auth/reset-request.ts");
  assert.match(cookie, /httpOnly: true,/);
  assert.match(cookie, /sameSite: "lax",/);
  assert.match(cookie, /secure: process\.env\.NODE_ENV === "production",/);
  assert.match(cookie, /maxAge: RESET_REQUEST_TTL_SECONDS,/);
  assert.match(cookie, /deriveGrantKey\(secret, "password-reset-request"\)/);
  assert.doesNotMatch(cookie, /^["']use server["'];?\s*$/m, "not a server-action file");
});

test("a reset link keeps its session only in the browser that asked for that account's reset", () => {
  const src = read("../actions/auth.ts");
  const confirm = src.slice(src.indexOf("export async function confirmEmailAction"), src.indexOf("export async function confirmEmailCodeAction"));
  const verify = confirm.indexOf("supabase.auth.verifyOtp(");

  // No marker at all: refused before the token is spent, so the owner's link survives.
  const absent = confirm.indexOf('if (type === "recovery" && !(await hasResetRequestMarker()))');
  assert.ok(absent > 0 && absent < verify, "the marker is looked for before verifyOtp");
  assert.match(confirm.slice(absent, verify), /return \{ ok: false, message: RESET_LINK_ELSEWHERE \};/);

  // A marker for another account: session dropped, and no reset grant.
  const bound = confirm.indexOf("if (!(await resetRequestedHereFor(verified.user?.email)))");
  const grant = confirm.indexOf("issueResetGrant(");
  assert.ok(bound > verify && bound < grant, "bound to the verified account before any grant is issued");
  const refusal = confirm.slice(bound, grant);
  assert.match(refusal, /await endLocalSession\(supabase\);\s*return \{ ok: false, message: RESET_LINK_ELSEWHERE \};/);

  // One message for both, naming no account. It does not point at the emailed
  // code: that can only be typed after asking again, which replaces it.
  const message = src.slice(src.indexOf("const RESET_LINK_ELSEWHERE ="), src.indexOf("const REGISTRATION_UNFINISHED ="));
  assert.doesNotMatch(message, /6-digit code|enter the code/i);
  assert.match(message, /request a new reset from this device/);
  assert.doesNotMatch(message, /\$\{|account|someone|another (person|user)/i);
});

test("a reset link reads as a password reset, never as confirming an email", () => {
  const panels = read("../../components/auth/auth-panels.tsx");
  const panel = panels.slice(panels.indexOf("export function ConfirmEmailPanel"), panels.indexOf("function ResetLinkForm"));
  const recovery = panel.indexOf('if (type === "recovery") {');
  const signup = panel.indexOf('title="Confirm your email."');
  assert.ok(recovery > 0 && recovery < signup, "the recovery wording is chosen before the sign-up card is reached");
  assert.match(panel.slice(recovery, signup), /title="Reset your password\."/);
  assert.match(panel.slice(recovery, signup), /<ResetLinkForm tokenHash=\{tokenHash!\} \/>/);

  const form = panels.slice(panels.indexOf("function ResetLinkForm"), panels.indexOf("export function ResetPasswordPanel"));
  assert.match(form, /useActionState\(confirmEmailAction, resetLinkInitial\)/);
  assert.match(form, /name="type" value="recovery"/);
  assert.match(form, /Reset my password/);
  assert.doesNotMatch(form, /confirm (my|your) email/i);
});
