import assert from "node:assert/strict";
import test from "node:test";
import {
  amrFromAccessToken,
  buildSecurityState,
  currentSignInMethod,
  linkedMethods,
  methodLabel,
} from "../auth/session-security.js";

/** A token shaped like Supabase's, carrying only the claims under test. */
function tokenWith(claims: object): string {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(claims)}.signature-not-checked`;
}

test("password beats oauth when a session carries both", () => {
  // A session can accumulate methods. The strongest statement about how the
  // person proved who they are is the one to show.
  assert.equal(currentSignInMethod([{ method: "oauth" }, { method: "password" }], "google"), "password");
});

test("oauth is narrowed by the account's own provider, since amr never names it", () => {
  assert.equal(currentSignInMethod([{ method: "oauth" }], "google"), "google");
  assert.equal(currentSignInMethod([{ method: "oauth" }], "discord"), "discord");
});

test("a magic link is not reported as a password", () => {
  // Saying "Email and password" to someone who used a one-time link would be
  // a plain lie about how their account was reached.
  assert.equal(currentSignInMethod([{ method: "otp" }], "email"), "magic-link");
  assert.equal(currentSignInMethod([{ method: "magiclink" }], "email"), "magic-link");
});

test("a missing amr falls back to the provider rather than guessing", () => {
  assert.equal(currentSignInMethod([], "discord"), "discord");
  assert.equal(currentSignInMethod(null, "email"), "password");
  assert.equal(currentSignInMethod(undefined, null), "unknown");
  assert.equal(methodLabel("unknown"), "Unknown");
});

test("every linked way in is listed, providers and password alike", () => {
  assert.deepEqual(linkedMethods({ providers: ["google", "discord"], hasPassword: false }), ["google", "discord"]);
  assert.deepEqual(linkedMethods({ providers: ["google"], hasPassword: true }), ["google", "password"]);
  assert.deepEqual(linkedMethods({ providers: null, hasPassword: false }), []);
});

test("an account reachable only through a provider is flagged", () => {
  // The single actionable line on the card: lose the provider, lose the account.
  const oauthOnly = buildSecurityState({
    amr: [{ method: "oauth" }],
    provider: "google",
    providers: ["google"],
    hasPassword: false,
    emailConfirmedAt: "2026-01-01T00:00:00Z",
    lastSignInAt: "2026-09-05T00:00:00Z",
  });
  assert.equal(oauthOnly.oauthOnly, true);
  assert.equal(oauthOnly.current, "google");

  const withPassword = buildSecurityState({
    amr: [{ method: "password" }],
    provider: "email",
    providers: ["email"],
    hasPassword: true,
    emailConfirmedAt: "2026-01-01T00:00:00Z",
    lastSignInAt: null,
  });
  assert.equal(withPassword.oauthOnly, false);
});

test("an unconfirmed email is reported as unconfirmed", () => {
  const state = buildSecurityState({
    amr: null,
    provider: "email",
    providers: ["email"],
    hasPassword: true,
    emailConfirmedAt: null,
    lastSignInAt: null,
  });
  assert.equal(state.emailConfirmed, false);
});

test("amr is read out of a real-shaped access token", () => {
  const token = tokenWith({ sub: "user-1", amr: [{ method: "oauth", timestamp: 1 }] });
  assert.deepEqual(amrFromAccessToken(token), [{ method: "oauth", timestamp: 1 }]);
});

test("a malformed or absent token degrades to the provider fallback, never a throw", () => {
  // This runs while rendering a signed-in page. A bad token must cost a label,
  // not the whole settings screen.
  for (const bad of [null, undefined, "", "not-a-jwt", "a.b", "a.!!!not-base64!!!.c"]) {
    assert.doesNotThrow(() => amrFromAccessToken(bad as string));
    assert.deepEqual(amrFromAccessToken(bad as string), []);
  }
});
