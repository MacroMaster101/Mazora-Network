import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const orders = read("src/lib/data/orders.ts");
const registrations = read("src/lib/data/event-registrations.ts");

test("member order path drops handler, ticket channel and discord id", () => {
  assert.match(orders, /function toMemberOrder\(/);
  const fn = orders.slice(orders.indexOf("function toMemberOrder"), orders.indexOf("export async function getOrdersForUser"));
  for (const field of ["handledBy", "ticketChannelId", "discordId"]) assert.ok(fn.includes(field), field);
  const getter = orders.slice(orders.indexOf("export async function getOrdersForUser"), orders.indexOf("anonymiseOrdersForUser") );
  assert.match(getter, /Promise<MemberOrder\[\]>/);
  assert.match(getter, /\.map\(toMemberOrder\)/);
});

test("order anonymisation also clears the ticket channel id", () => {
  const body = orders.slice(orders.indexOf("export async function anonymiseOrdersForUser"));
  assert.match(body, /ticketChannelId: null/);
  assert.doesNotMatch(body.slice(0, body.indexOf("claimOrderForConfirm")), /handledBy: null/);
});

test("event registrant lists and counts only include active accounts", () => {
  const matches = registrations.match(/eq\(schema\.profiles\.accountStatus, "active"\)/g) ?? [];
  assert.equal(matches.length, 2);
  const joins = registrations.match(/innerJoin\(schema\.profiles/g) ?? [];
  assert.equal(joins.length, 2);
});
