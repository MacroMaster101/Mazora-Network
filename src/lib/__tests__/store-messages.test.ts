import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STORE_MESSAGES,
  MAX_BLOCK,
  PAYMENT_NOTICE,
  buildConfirmedDescription,
  buildDeclinedDescription,
  containsLink,
  missingTokens,
  sanitiseStoreMessages,
} from "../store-messages-shared.js";

const parts = {
  reference: "MZ-20260904-A1B2C3",
  staff: "KaviYa",
  ticketLink: "https://discord.com/channels/1/2",
  items: "1× Premium Battlepass — $4.50 ($4.50 each)",
  total: "$4.50",
  creatorCode: "AAA1 · −$0.45 (15%)",
};
const support = "https://discord.com/channels/1/2";

test("the shipped defaults reproduce the message buyers already receive", () => {
  // Pinned in full. This wording was hardcoded in the interaction handler
  // before it became configurable, and moving it must not have changed a
  // single character of what lands in a buyer's DMs.
  assert.equal(
    buildConfirmedDescription(DEFAULT_STORE_MESSAGES.confirmed, parts, support),
    [
      "Your Mazora Network order (`MZ-20260904-A1B2C3`) has just been confirmed by **KaviYa**.",
      "A private ticket has been opened for you — continue there: https://discord.com/channels/1/2",
      "",
      "**Order Summary**",
      "1× Premium Battlepass — $4.50 ($4.50 each)",
      "",
      "**Total:** $4.50",
      "**Discount code:** AAA1 · −$0.45 (15%)",
      "_No payment has been taken yet — staff will never ask for card details in chat._",
      "",
      "— — —",
      "🤖 This message was sent by an automated bot, which **cannot read replies**. To respond, open a ticket and a staff member will get back to you:",
      "https://discord.com/channels/1/2",
    ].join("\n"),
  );
});

test("an order with no ticket, items or discount still reads as a whole message", () => {
  const body = buildConfirmedDescription(
    DEFAULT_STORE_MESSAGES.confirmed,
    { reference: "MZ-1", staff: "KaviYa", ticketLink: null, items: null, total: null, creatorCode: null },
    support,
  );

  assert.ok(body.includes("A staff member will reach out to you here shortly"));
  assert.ok(!body.includes("**Order Summary**"));
  assert.ok(!body.includes("**Total:**"));
  // No stray "{ticket_link}" left behind where the link would have gone.
  assert.ok(!body.includes("{"));
});

test("the payment warning survives every edit", () => {
  // It is the sentence that separates a real staff message from an
  // impersonation, so no configuration may drop it.
  const stripped = sanitiseStoreMessages({
    confirmed: {
      title: "hi",
      opening: "{reference} {staff}",
      withTicket: "{ticket_link}",
      withoutTicket: "x",
      disclaimer: "y",
    },
    declined: { title: "hi", opening: "{reference} {staff}", closing: "x", disclaimer: "y" },
  });

  assert.ok(buildConfirmedDescription(stripped.confirmed, parts, support).includes(PAYMENT_NOTICE));
});

test("a block that lost a required token falls back rather than shipping", () => {
  // Runs on read as well as write, so a direct database edit cannot strip the
  // order reference out of a live buyer notification.
  const config = sanitiseStoreMessages({
    ...DEFAULT_STORE_MESSAGES,
    confirmed: { ...DEFAULT_STORE_MESSAGES.confirmed, opening: "Your order was confirmed." },
    declined: { ...DEFAULT_STORE_MESSAGES.declined, opening: "Declined, sorry." },
  });

  assert.equal(config.confirmed.opening, DEFAULT_STORE_MESSAGES.confirmed.opening);
  assert.equal(config.declined.opening, DEFAULT_STORE_MESSAGES.declined.opening);
});

test("rewording is kept as long as the facts stay", () => {
  const config = sanitiseStoreMessages({
    ...DEFAULT_STORE_MESSAGES,
    confirmed: {
      ...DEFAULT_STORE_MESSAGES.confirmed,
      opening: "Nice one! Order {reference} was approved by {staff}.",
      disclaimer: "This is a bot and cannot read replies.",
    },
  });

  assert.equal(config.confirmed.opening, "Nice one! Order {reference} was approved by {staff}.");
  assert.equal(config.confirmed.disclaimer, "This is a bot and cannot read replies.");
});

test("missingTokens names exactly what is absent", () => {
  assert.deepEqual(missingTokens("nothing here", ["reference", "staff"]), ["reference", "staff"]);
  assert.deepEqual(missingTokens("{staff} did it", ["reference", "staff"]), ["reference"]);
  assert.deepEqual(missingTokens("{reference} {staff}", ["reference", "staff"]), []);
});

test("oversized and empty input degrade to something sendable", () => {
  const config = sanitiseStoreMessages({
    confirmed: { title: "", opening: "{reference} {staff} " + "x".repeat(MAX_BLOCK * 2) },
    declined: null,
  });

  assert.equal(config.confirmed.title, DEFAULT_STORE_MESSAGES.confirmed.title);
  assert.equal(config.confirmed.opening.length, MAX_BLOCK);
  assert.deepEqual(config.declined, DEFAULT_STORE_MESSAGES.declined);
});

test("junk input returns the defaults rather than throwing", () => {
  assert.deepEqual(sanitiseStoreMessages(null), DEFAULT_STORE_MESSAGES);
  assert.deepEqual(sanitiseStoreMessages("nope"), DEFAULT_STORE_MESSAGES);
  assert.deepEqual(sanitiseStoreMessages([]), DEFAULT_STORE_MESSAGES);
});

test("the shipped defaults contain no link of their own", () => {
  // Guards the rule against itself: if a default ever tripped the link check,
  // sanitise would silently swap it for the same value and the panel would
  // refuse a save the operator never changed.
  const d = DEFAULT_STORE_MESSAGES;
  for (const block of [
    d.confirmed.title, d.confirmed.opening, d.confirmed.withTicket,
    d.confirmed.withoutTicket, d.confirmed.disclaimer,
    d.declined.title, d.declined.opening, d.declined.closing, d.declined.disclaimer,
  ]) {
    assert.equal(containsLink(block), false, `default block should not read as a link: ${block}`);
  }
});

test("{ticket_link} is a token, not a link", () => {
  // The sender expands it to a channel the bot itself made, so it must survive
  // the check that blocks typed destinations.
  assert.equal(containsLink("continue there: {ticket_link}"), false);
});

test("typed links are refused however they are written", () => {
  assert.equal(containsLink("go to https://evil.example"), true);
  assert.equal(containsLink("go to http://evil.example"), true);
  assert.equal(containsLink("join discord.gg/notreally"), true);
  // Markdown link syntax hides the destination behind friendly text, which is
  // the most convincing form of the attack.
  assert.equal(containsLink("[click here](https://evil.example)"), true);
  assert.equal(containsLink("HTTPS://EVIL.EXAMPLE"), true);
});

test("a stored link is stripped on read, not just refused on save", () => {
  // Defends against a direct database write bypassing the save action.
  const config = sanitiseStoreMessages({
    ...DEFAULT_STORE_MESSAGES,
    declined: {
      ...DEFAULT_STORE_MESSAGES.declined,
      closing: "Appeal at https://mazora-support.example",
    },
  });

  assert.equal(config.declined.closing, DEFAULT_STORE_MESSAGES.declined.closing);
});

test("a declined message still names the order and who declined it", () => {
  const body = buildDeclinedDescription(DEFAULT_STORE_MESSAGES.declined, { reference: "MZ-1", staff: "KaviYa" }, support);

  assert.ok(body.includes("MZ-1"));
  assert.ok(body.includes("KaviYa"));
  assert.ok(body.includes(support));
});
