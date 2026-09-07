import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSENT_ACCEPTED,
  CONSENT_POLICY_VERSION,
  CONSENT_REJECTED,
  resolveConsent,
  serializeConsent,
} from "@/lib/consent-client";

test("a choice recorded against the current policy stands", () => {
  assert.equal(resolveConsent(`${CONSENT_ACCEPTED}:1`, 1), CONSENT_ACCEPTED);
  assert.equal(resolveConsent(`${CONSENT_REJECTED}:1`, 1), CONSENT_REJECTED);
});

test("a choice made before the policy changed is treated as unanswered", () => {
  // The point of versioning: bump the policy and the banner comes back rather
  // than a visitor staying opted in to terms they never saw.
  assert.equal(resolveConsent(`${CONSENT_ACCEPTED}:1`, 2), null);
  assert.equal(resolveConsent(`${CONSENT_REJECTED}:1`, 2), null);
});

test("a choice recorded against a newer policy is still honoured", () => {
  // Someone who answered on a newly deployed build, then hits an older cached
  // one, should not be asked again.
  assert.equal(resolveConsent(`${CONSENT_ACCEPTED}:3`, 2), CONSENT_ACCEPTED);
});

test("cookies written before versioning existed are grandfathered, not discarded", () => {
  // The stored format was a bare "accepted". Re-prompting every existing
  // visitor on deploy would be discarding consent that is still valid — the
  // policy they agreed to has not changed.
  assert.equal(resolveConsent(CONSENT_ACCEPTED, CONSENT_POLICY_VERSION), CONSENT_ACCEPTED);
  assert.equal(resolveConsent(CONSENT_REJECTED, CONSENT_POLICY_VERSION), CONSENT_REJECTED);
});

test("anything unrecognised counts as no answer", () => {
  for (const raw of [undefined, null, "", "maybe", "accepted:", "accepted:x", ":1", "accepted:1:2"]) {
    assert.equal(resolveConsent(raw, 1), null, `expected no answer for ${JSON.stringify(raw)}`);
  }
});

test("what is written can be read back", () => {
  const written = serializeConsent(CONSENT_ACCEPTED);
  assert.equal(resolveConsent(written, CONSENT_POLICY_VERSION), CONSENT_ACCEPTED);
  assert.ok(written.endsWith(`:${CONSENT_POLICY_VERSION}`), "the version must be recorded alongside the choice");
});
