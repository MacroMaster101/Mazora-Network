import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fakeRedis, loadServerModule } from "./helpers/server-module";
import * as grants from "@/lib/auth/reset-grant-core";
import type * as Proof from "@/lib/auth/account-deletion-proof";

const subject = { userId: "00000000-0000-3000-8000-000000000001", sessionId: "00000000-0000-3000-8000-000000000002" };

function fixture(sent = true, secret: string | undefined = "fake-server-secret") {
  let now = 0;
  let nextCode = 123_456;
  const store = fakeRedis(() => now);
  const emails: Array<{ to: string; text: string }> = [];
  const proof = loadServerModule<typeof Proof>(new URL("../auth/account-deletion-proof.ts", import.meta.url), {
    mocks: {
      "node:crypto": { ...crypto, randomInt: () => nextCode++ },
      "@/lib/auth/reset-grant-core": grants,
      "@/lib/supabase/secret-key": { supabaseSecretKey: () => secret },
      "@/lib/redis": { redisCommand: store.command },
      "@/lib/email/send": { sendEmail: async (email: { to: string; text: string }) => { emails.push(email); return sent; } },
    },
  });
  return { proof, emails, store, advance: (ms: number) => { now += ms; } };
}

test("deletion codes prove inbox control only for the requesting user and session", async () => {
  const { proof, emails, store } = fixture();
  assert.equal(await proof.sendAccountDeletionCode(subject, "alex@example.com"), true);
  assert.equal(emails[0].to, "alex@example.com");
  assert.equal(await proof.consumeAccountDeletionCode({ ...subject, sessionId: "another-fake-session" }, "123456"), false);
  assert.equal(await proof.consumeAccountDeletionCode({ ...subject, userId: "another-fake-user" }, "123456"), false);
  assert.equal(await proof.consumeAccountDeletionCode(subject, "999999"), false);
  assert.equal([...store.values.values()].some((value) => value.value.includes("123456")), false, "only a keyed digest is stored");
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123456"), true);
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123456"), false, "single use");
});

test("concurrent deletion attempts cannot spend one email code twice", async () => {
  const { proof } = fixture();
  await proof.sendAccountDeletionCode(subject, "alex@example.com");
  const result = await Promise.all([proof.consumeAccountDeletionCode(subject, "123456"), proof.consumeAccountDeletionCode(subject, "123456")]);
  assert.equal(result.filter(Boolean).length, 1);
});

test("codes expire after ten minutes and resending invalidates the old code", async () => {
  const { proof, advance } = fixture();
  await proof.sendAccountDeletionCode(subject, "alex@example.com");
  await proof.sendAccountDeletionCode(subject, "alex@example.com");
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123456"), false);
  advance(600_000);
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123457"), false);
});

test("mail failure and missing signing secrets cannot authorize deletion", async () => {
  const failed = fixture(false);
  assert.equal(await failed.proof.sendAccountDeletionCode(subject, "alex@example.com"), false);
  assert.equal(await failed.proof.consumeAccountDeletionCode(subject, "123456"), false);
  const unsigned = fixture(true, "");
  assert.equal(await unsigned.proof.sendAccountDeletionCode(subject, "alex@example.com"), false);
  assert.equal(unsigned.emails.length, 0);
});

test("deletion checks the bound code before any account data is removed", () => {
  const source = readFileSync(new URL("../actions/account.ts", import.meta.url), "utf8");
  const deletion = source.slice(source.indexOf("export async function deleteAccountAction"));
  assert.ok(deletion.indexOf("consumeAccountDeletionCode(") < deletion.indexOf("cleanupAccountOwnedData("));
  assert.match(deletion, /if \(!verified\) return/);
  assert.match(deletion, /identity: auth\.user\.id/);
  const send = source.slice(source.indexOf("export async function requestAccountDeletionCodeAction"), source.indexOf("export async function deleteAccountAction"));
  assert.match(send, /auth\.user\.email_confirmed_at/);
  assert.match(send, /getSignInSessionId\(\)/);
  assert.match(send, /auth\.user\.email,/);
});

test("a code sent for one purpose cannot be spent on another", async () => {
  const { proof } = fixture();
  assert.equal(await proof.sendEmailProofCode("passkey-add", subject, "alex@example.com"), true);
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123456"), false, "a passkey code does not delete the account");
  assert.equal(await proof.consumeEmailProofCode("passkey-add", { ...subject, sessionId: "another-fake-session" }, "123456"), false);
  assert.equal(await proof.consumeEmailProofCode("passkey-add", subject, "123456"), true);

  await proof.sendAccountDeletionCode(subject, "alex@example.com");
  assert.equal(await proof.consumeEmailProofCode("passkey-add", subject, "123457"), false, "a deletion code does not add a passkey");
  assert.equal(await proof.consumeAccountDeletionCode(subject, "123457"), true);
});
