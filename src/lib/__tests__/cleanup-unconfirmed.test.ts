import assert from "node:assert/strict";
import test from "node:test";
import { selectExpiredUnconfirmed, type AuthUserLike } from "@/lib/cleanup-rules";

const NOW = Date.parse("2026-08-30T00:00:00Z");
const TTL = 48 * 60 * 60 * 1000;
const OLD = "2026-08-20T00:00:00Z"; // 10 days before NOW
const RECENT = "2026-08-29T20:00:00Z"; // 4 hours before NOW

const base: AuthUserLike = {
  id: "x",
  email: "x@example.com",
  created_at: OLD,
  last_sign_in_at: null,
  invited_at: null,
  email_confirmed_at: null,
  confirmed_at: null,
};

const ids = (users: AuthUserLike[]) => selectExpiredUnconfirmed(users, NOW, TTL).map((u) => u.id);

test("reaps an old, unconfirmed, never-signed-in self-signup", () => {
  assert.deepEqual(ids([{ ...base, id: "reap" }]), ["reap"]);
});

test("keeps a confirmed account (email_confirmed_at)", () => {
  assert.deepEqual(ids([{ ...base, id: "confirmed", email_confirmed_at: OLD }]), []);
});

test("keeps a confirmed account (confirmed_at)", () => {
  assert.deepEqual(ids([{ ...base, id: "confirmed2", confirmed_at: OLD }]), []);
});

test("keeps an account that has signed in", () => {
  assert.deepEqual(ids([{ ...base, id: "signed-in", last_sign_in_at: OLD }]), []);
});

test("keeps a pending staff invitation", () => {
  assert.deepEqual(ids([{ ...base, id: "invited", invited_at: OLD }]), []);
});

test("keeps a recent unconfirmed signup (still within the TTL)", () => {
  assert.deepEqual(ids([{ ...base, id: "recent", created_at: RECENT }]), []);
});

test("ignores an account with an unparseable created_at", () => {
  assert.deepEqual(ids([{ ...base, id: "nodate", created_at: null }]), []);
});

test("selects only the expired ones from a mixed set", () => {
  const users: AuthUserLike[] = [
    { ...base, id: "reap-a" },
    { ...base, id: "reap-b" },
    { ...base, id: "confirmed", email_confirmed_at: OLD },
    { ...base, id: "invited", invited_at: OLD },
    { ...base, id: "recent", created_at: RECENT },
  ];
  assert.deepEqual(ids(users).sort(), ["reap-a", "reap-b"]);
});
