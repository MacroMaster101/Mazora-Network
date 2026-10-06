import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertionUserVerified } from "@/lib/passkeys/user-verified";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  credentialToJson,
  passkeyErrorMessage,
  toCreationOptions,
  toRequestOptions,
} from "@/lib/passkeys/webauthn-json";

const actions = readFileSync(new URL("../actions/passkeys.ts", import.meta.url), "utf8");

/** The text of one exported function, from its signature to the next export. */
function body(name: string): string {
  const start = actions.indexOf(`export async function ${name}(`);
  assert.ok(start > -1, `${name} exists`);
  const next = actions.indexOf("\nexport ", start + 1);
  return actions.slice(start, next === -1 ? undefined : next);
}

/* ------------------------------------------------------- browser conversion */

test("base64url round-trips arbitrary bytes, without padding or + and /", () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 62, 63]);
  const encoded = bytesToBase64Url(bytes);
  assert.doesNotMatch(encoded, /[+/=]/);
  assert.deepEqual([...base64UrlToBytes(encoded)], [...bytes]);
  assert.equal(bytesToBase64Url(new Uint8Array([])), "");
});

test("sign-in options decode the challenge and every allowed credential id", () => {
  const options = toRequestOptions({
    challenge: bytesToBase64Url(new Uint8Array([9, 8, 7])),
    rpId: "example.com",
    allowCredentials: [{ type: "public-key", id: bytesToBase64Url(new Uint8Array([1, 2])), transports: ["internal"] }],
    userVerification: "preferred",
  });
  assert.deepEqual([...new Uint8Array(options.challenge as ArrayBuffer)], [9, 8, 7]);
  assert.equal(options.rpId, "example.com");
  const allowed = options.allowCredentials?.[0];
  assert.ok(allowed);
  assert.deepEqual([...new Uint8Array(allowed.id as ArrayBuffer)], [1, 2]);
  assert.deepEqual(allowed.transports, ["internal"]);
});

test("registration options decode the challenge, the user id and excluded credentials", () => {
  const options = toCreationOptions({
    challenge: bytesToBase64Url(new Uint8Array([5])),
    rp: { id: "example.com", name: "Example" },
    user: { id: bytesToBase64Url(new Uint8Array([4, 4])), name: "Steve_42", displayName: "Steve" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    excludeCredentials: [{ type: "public-key", id: bytesToBase64Url(new Uint8Array([3])) }],
  });
  assert.deepEqual([...new Uint8Array(options.challenge as ArrayBuffer)], [5]);
  assert.deepEqual([...new Uint8Array(options.user.id as ArrayBuffer)], [4, 4]);
  assert.equal(options.user.name, "Steve_42");
  assert.deepEqual([...new Uint8Array(options.excludeCredentials?.[0]?.id as ArrayBuffer)], [3]);
});

test("a browser credential becomes the JSON Supabase verifies", () => {
  const json = credentialToJson({
    id: "cred-1",
    rawId: new Uint8Array([1, 2, 3]).buffer,
    type: "public-key",
    authenticatorAttachment: "platform",
    response: {
      clientDataJSON: new Uint8Array([10]).buffer,
      authenticatorData: new Uint8Array([11]).buffer,
      signature: new Uint8Array([12]).buffer,
      userHandle: new Uint8Array([13]).buffer,
    },
    getClientExtensionResults: () => ({}),
  });
  assert.equal(json.id, "cred-1");
  assert.equal(json.rawId, bytesToBase64Url(new Uint8Array([1, 2, 3])));
  assert.equal(json.type, "public-key");
  const response = json.response as Record<string, string>;
  assert.equal(response.clientDataJSON, bytesToBase64Url(new Uint8Array([10])));
  assert.equal(response.signature, bytesToBase64Url(new Uint8Array([12])));
  assert.equal(response.userHandle, bytesToBase64Url(new Uint8Array([13])));
});

test("a dismissed sign-in prompt says nothing; a refused or dismissed add always explains", () => {
  assert.equal(passkeyErrorMessage(new DOMException("closed", "NotAllowedError"), "sign in"), null);
  assert.equal(passkeyErrorMessage(new DOMException("aborted", "AbortError"), "add"), null);
  // A duplicate on this device: InvalidStateError in Chrome, NotAllowedError from Windows Hello.
  assert.match(passkeyErrorMessage(new DOMException("dup", "InvalidStateError"), "add") ?? "", /already has a passkey/);
  assert.match(passkeyErrorMessage(new DOMException("dup", "NotAllowedError"), "add") ?? "", /No passkey was created/);
});

test("a new passkey keeps Supabase's authenticator name unless the model is unknown", () => {
  const finish = body("finishPasskeyRegistrationAction");
  assert.match(finish, /supabaseName && supabaseName !== "Passkey" \? supabaseName :/);
});

/* ----------------------------------------------------------- server actions */

test("the sign-in button comes with the page, not from a request after it opens", () => {
  const forms = readFileSync(new URL("../../components/auth/auth-forms.tsx", import.meta.url), "utf8");
  const button = forms.slice(forms.indexOf("function PasskeySignIn("));
  assert.match(button, /usePasskeySignInOffered\(\)/);
  assert.doesNotMatch(forms, /passkeySignInAvailableAction/);
  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /passkeySignIn=\{passkeysOffered && isSupabaseConfigured\(\)\}/);
});

test("every passkey action is behind the Passkey Sign-in switch", () => {
  for (const name of ["startPasskeySignInAction", "finishPasskeySignInAction"]) {
    assert.match(body(name), /passkeysOn\(\)/, `${name} checks the switch`);
  }
  // The management actions go through signedIn(), which checks it first.
  assert.match(actions.slice(actions.indexOf("async function signedIn()")), /if \(!\(await passkeysOn\(\)\)\) return null;/);
  for (const name of [
    "passkeyConfirmationNeededAction",
    "confirmPasskeyOwnerAction",
    "startPasskeyRegistrationAction",
    "finishPasskeyRegistrationAction",
    "renamePasskeyAction",
    "deletePasskeyAction",
  ]) {
    assert.match(body(name), /const actor = await signedIn\(\);/, `${name} needs a completed sign-in`);
  }
});

test("a passkey sign-in runs the password sign-in's checks, in the same order", () => {
  const finish = body("finishPasskeySignInAction");
  const verified = finish.indexOf("passkey.verifyAuthentication(");
  const statusRead = finish.indexOf("await accountStatusFor(signedIn.user.id)");
  const unreadable = finish.indexOf("if (status === STATUS_UNREADABLE) {");
  const suspended = finish.indexOf('if (status === "suspended" && (!hasAuthenticator || secondStepPassed)) {');
  const notices = finish.indexOf("dispatchSignInNotifications(");
  const twoStep = finish.indexOf("isTwoFactorPending()");

  assert.equal((finish.match(/accountStatusFor\(/g) ?? []).length, 1, "the status is read once");
  assert.ok(verified > -1 && statusRead > verified, "status is read for the account the passkey signed in");
  assert.ok(unreadable > statusRead && unreadable < notices, "an unreadable status is refused before the sign-in counts");
  assert.ok(suspended > unreadable && suspended < notices, "a suspended account is ended before the sign-in counts");
  assert.match(finish.slice(unreadable, suspended), /await endLocalSession\(supabase\);/);
  assert.match(finish.slice(suspended, notices), /await endLocalSession\(supabase\);\s*return \{ ok: true, redirectTo: SUSPENDED_PATH \};/);
  assert.ok(twoStep > notices, "two-step verification is still owed after a passkey");
  assert.match(finish, /safeNext\(input\.next\)/, "the destination is sanitised");
  assert.match(finish, /return \{ ok: true, redirectTo: twoFactorPath\(destination\) \};/, "a pending second step goes to /two-factor");
});

test("adding a passkey needs a fresh 'confirm it's you' before Supabase is asked for anything", () => {
  const confirm = body("confirmPasskeyOwnerAction");
  const proof = confirm.indexOf("await confirmOwner(actor, formData)");
  const grant = confirm.indexOf("issuePasskeyGrant(");
  assert.ok(proof > -1 && grant > proof, "the grant is issued only after the owner is confirmed");
  assert.match(confirm.slice(proof, grant), /if \(proofError\) return \{ ok: false, message: proofError \};/);

  const start = body("startPasskeyRegistrationAction");
  assert.ok(start.indexOf("hasPasskeyGrant(") > -1 && start.indexOf("hasPasskeyGrant(") < start.indexOf("passkey.startRegistration()"));
  const finish = body("finishPasskeyRegistrationAction");
  assert.ok(finish.indexOf("hasPasskeyGrant(") > -1 && finish.indexOf("hasPasskeyGrant(") < finish.indexOf("passkey.verifyRegistration("), "a challenge alone is not enough");

  const owner = actions.slice(actions.indexOf("async function confirmOwner("), actions.indexOf("/** Whether \"Add a passkey\""));
  assert.match(owner, /confirmSecondStep\(actor\.supabase, actor\.user, formData, "two-step-settings"\)/, "authenticator code when two-step is on");
  assert.match(owner, /passwordMatchesCurrent\(actor\.user\.email, password\)/, "otherwise the current password");
  assert.match(owner, /consumeEmailProofCode\("passkey-add", await grantSubject\(actor\), emailCode\)/, "otherwise a code sent to the inbox, for this session");
  // The account-wide last sign-in is not proof: another browser's sign-in moves it.
  assert.doesNotMatch(owner, /last_sign_in_at/);

  const send = body("sendPasskeyEmailCodeAction");
  assert.match(send, /factors\.totp\.length > 0 \|\| accountHasPassword\(actor\.user\)/, "only for accounts with nothing else to prove");
  assert.match(send, /actor\.user\.email_confirmed_at/);
  assert.match(send, /sendEmailProofCode\("passkey-add", await grantSubject\(actor\), actor\.user\.email\)/);
});

test("the confirmation lasts 15 minutes, for this user and sign-in only", () => {
  const grant = readFileSync(new URL("../auth/passkey-grant.ts", import.meta.url), "utf8");
  assert.match(grant, /const TTL_SECONDS = 15 \* 60;/);
  assert.match(grant, /deriveGrantKey\(secret, "passkey-add"\)/, "its own purpose key");
  assert.match(grant, /httpOnly: true/);
  assert.match(grant, /sameSite: "strict"/);
  assert.match(actions, /sessionId: \(await getSignInSessionId\(\)\) \?\? ""/, "bound to this sign-in's session");
});

/** Authenticator data: a 32-byte rpIdHash, the flags byte, then a 4-byte counter. */
function authenticatorData(flags: number): string {
  const bytes = new Uint8Array(37);
  bytes[32] = flags;
  return Buffer.from(bytes).toString("base64url");
}

test("only a passkey the device unlocked (UV) counts as two factors", () => {
  const assertion = (flags: number) => ({ response: { authenticatorData: authenticatorData(flags) } });
  assert.equal(assertionUserVerified(assertion(0x01 | 0x04)), true, "present and verified");
  assert.equal(assertionUserVerified(assertion(0x01 | 0x04 | 0x08 | 0x10)), true, "backup flags do not matter");
  assert.equal(assertionUserVerified(assertion(0x01)), false, "presence alone is one factor");
  assert.equal(assertionUserVerified(assertion(0x04)), false, "verified without presence is malformed");
  assert.equal(assertionUserVerified({ response: { authenticatorData: "short" } }), false);
  assert.equal(assertionUserVerified({ response: {} }), false);
  assert.equal(assertionUserVerified(null), false);
});

test("a verified passkey passes the second step, and the pass is issued before anyone asks who is signed in", () => {
  const finish = body("finishPasskeySignInAction");
  const passed = finish.indexOf("const secondStepPassed =");
  const issued = finish.indexOf("issuePasskeySignInGrant(");
  const firstWho = finish.indexOf("getSessionUserId(");
  assert.ok(passed > -1 && issued > passed, "issued as part of deciding the second step");
  assert.ok(firstWho > issued, "getAuthState is cached per request, so the pass must exist before its first read");
  const rule = finish.slice(passed, finish.indexOf(";", issued));
  assert.match(rule, /hasAuthenticator &&/);
  assert.match(rule, /assertionUserVerified\(credential\.data\)/, "only when the device verified the member");
  assert.match(rule, /sessionId: sessionId|sessionId \}/, "bound to this session");
});

test("the two-step check honours the passkey pass only on a passkey session", () => {
  const auth = readFileSync(new URL("../auth/index.ts", import.meta.url), "utf8");
  const rule = auth.slice(auth.indexOf("const passkeyVerified ="), auth.indexOf("const aal: "));
  assert.match(rule, /hasAuthenticator &&/);
  assert.match(rule, /token\.amr\.includes\("passkey"\)/, "the token must say it was a passkey sign-in");
  assert.match(rule, /hasPasskeySignInGrant\(\{ userId: data\.user\.id, sessionId: token\.sessionId \}\)/);
  assert.match(auth, /const aal: "aal1" \| "aal2" = recovered \|\| passkeyVerified \? "aal2" : token\.aal;/);
  // It passes the check and nothing more: the recovery-only shortcuts stay keyed on `recovered`.
  assert.match(auth, /\.\.\.\(state\.recovered \? \{ recoveredSignIn: true \} : \{\}\)/);
  assert.match(auth, /\.\.\.\(state\.passkeyVerified \? \{ passkeySignIn: true \} : \{\}\)/);
  const signOut = auth.slice(auth.indexOf("export async function destroySession"));
  assert.match(signOut, /await clearPasskeySignInGrant\(\);/, "signing out clears it");

  const grant = readFileSync(new URL("../auth/passkey-signin-grant.ts", import.meta.url), "utf8");
  assert.match(grant, /deriveGrantKey\(secret, "passkey-sign-in"\)/, "its own purpose key");
  assert.match(grant, /httpOnly: true/);
});

test("passkey ids are validated before they reach Supabase", () => {
  assert.match(actions, /const passkeyIdSchema = z\.string\(\)\.uuid\(\);/);
  assert.match(body("renamePasskeyAction"), /passkeyIdSchema\.safeParse/);
  assert.match(body("deletePasskeyAction"), /passkeyIdSchema\.safeParse/);
});

test("the Passkey Sign-in switch is off until someone turns it on", () => {
  const settings = readFileSync(new URL("../data/site-settings.ts", import.meta.url), "utf8");
  assert.match(settings, /passkeysEnabled: false,/, "default");
  assert.match(settings, /passkeysEnabled: stored\.passkeysEnabled === true,/, "rows saved before the key existed read as off");
});
