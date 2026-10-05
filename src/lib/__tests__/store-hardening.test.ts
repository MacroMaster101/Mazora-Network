import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  escapeDiscordMarkdown,
  MAX_QUANTITY_PER_PRODUCT,
  mergeCartLines,
  STORE_PAUSED,
} from "../store-order-rules.js";
import { isSafeLink } from "../net/safe-url.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Source with comments removed, so an assertion cannot be met by prose. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

/** One exported function's body, up to the next export. */
function exported(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

// --- 1. The store "paused" switch ------------------------------------------

test("checkout and the code preview both refuse while the store is paused", () => {
  const paused = /if \(!\(await getSiteGeneralSettings\(\)\)\.storeEnabled\) return \{ ok: false, message: STORE_PAUSED \};/;

  const submit = exported(code("../actions/store.ts"), "submitStoreRequest");
  assert.match(submit, paused);
  // Before anything that costs quota or reaches Discord.
  assert.ok(submit.search(paused) < submit.indexOf("throttleAuthAction("));
  assert.ok(submit.search(paused) < submit.indexOf("isGuildMember("));

  const preview = exported(code("../actions/creator-codes.ts"), "previewCreatorCode");
  assert.match(preview, paused);
  assert.ok(preview.search(paused) < preview.indexOf("resolveCreatorCode("));

  assert.match(STORE_PAUSED, /paused/i);
});

// --- 2. Markdown in the staff order embed ----------------------------------

test("a buyer note cannot plant a masked link in the order embed", () => {
  const escaped = escapeDiscordMarkdown("[View invoice](https://evil.example/pay)");
  assert.equal(escaped, "\\[View invoice\\]\\(https://evil.example/pay\\)");
  // No unescaped bracket or parenthesis is left for Discord to pair up.
  assert.doesNotMatch(escaped, /(?<!\\)[[\]()]/);
});

test("mention, timestamp and heading syntax is neutralised too", () => {
  assert.equal(escapeDiscordMarkdown("<@&111111111111111111>"), "\\<@&111111111111111111\\>");
  assert.equal(escapeDiscordMarkdown("<t:1700000000:R>"), "\\<t:1700000000:R\\>");
  assert.equal(escapeDiscordMarkdown("# Paid in full"), "\\# Paid in full");
});

test("the original styling characters are still escaped, and plain text is untouched", () => {
  assert.equal(escapeDiscordMarkdown("**a** _b_ ~c~ `d` |e| > f \\"), "\\*\\*a\\*\\* \\_b\\_ \\~c\\~ \\`d\\` \\|e\\| \\> f \\\\");
  assert.equal(escapeDiscordMarkdown("Please deliver to Steve_42"), "Please deliver to Steve\\_42");
  assert.equal(escapeDiscordMarkdown("Thanks, see you online."), "Thanks, see you online.");
  // A bare link keeps showing its real address.
  assert.equal(escapeDiscordMarkdown("https://example.com/a"), "https://example.com/a");
});

test("every player-supplied embed value goes through the shared escaper", () => {
  const store = code("../actions/store.ts");
  assert.match(store, /escapeDiscordMarkdown as escapeMarkdown/);
  assert.doesNotMatch(store, /function escapeMarkdown/);
  assert.match(store, /escapeMarkdown\(contact\.data\.notes \|\| "None"\)/);
  assert.match(store, /escapeMarkdown\(discord\.username\)/);
  assert.match(store, /escapeMarkdown\(contact\.data\.minecraftUsername\)/);
});

// --- 3. Repeated cart slugs ------------------------------------------------

test("repeated slugs merge into one line per product", () => {
  assert.deepEqual(
    mergeCartLines([
      { slug: "vip-rank", qty: 3 },
      { slug: "crate-key", qty: 1 },
      { slug: "vip-rank", qty: 4 },
    ]),
    [
      { slug: "vip-rank", qty: 7 },
      { slug: "crate-key", qty: 1 },
    ],
  );
});

test("the per-product ceiling applies to the merged quantity", () => {
  assert.equal(MAX_QUANTITY_PER_PRODUCT, 20);
  assert.deepEqual(
    mergeCartLines([{ slug: "vip-rank", qty: 10 }, { slug: "vip-rank", qty: 10 }]),
    [{ slug: "vip-rank", qty: 20 }],
  );
  assert.equal(mergeCartLines([{ slug: "vip-rank", qty: 20 }, { slug: "vip-rank", qty: 1 }]), null);
  // The case the per-entry cap alone allowed: twenty entries of twenty.
  assert.equal(mergeCartLines(Array.from({ length: 20 }, () => ({ slug: "vip-rank", qty: 20 }))), null);
});

test("the cart never holds more of one product than an order may carry", () => {
  const cart = code("../../components/shared/cart-provider.tsx");
  assert.match(cart, /import \{ MAX_QUANTITY_PER_PRODUCT \} from "@\/lib\/store-order-rules";/);
  assert.match(cart, /return Math\.min\(qty, MAX_QUANTITY_PER_PRODUCT\);/);
  // Adding again, the drawer's stepper and a cart restored from storage all go through it.
  assert.match(cart, /qty: capQty\(item\.qty \+ 1\)/);
  assert.match(cart, /qty: capQty\(qty\)/);
  assert.match(cart, /qty: capQty\(item\.qty\)/);
  // No quantity is written any other way, apart from the first unit of a new line.
  // (`qty: number` is a type annotation, not a write.)
  const writes = cart.match(/\bqty: (?!number\b)[^,;}\n]+/g) ?? [];
  assert.ok(writes.length >= 4, `expected the quantity writes, found ${writes.length}`);
  assert.deepEqual(writes.filter((write) => !/^qty: (capQty\(|1$)/.test(write)), []);
});

test("checkout prices the merged cart, not the submitted entries", () => {
  const submit = exported(code("../actions/store.ts"), "submitStoreRequest");
  assert.match(submit, /const cartLines = mergeCartLines\(submittedItems\.data\);\s*if \(!cartLines\) \{\s*return \{\s*ok: false/);
  assert.match(submit, /for \(const submitted of cartLines\)/);
  assert.doesNotMatch(submit, /of submittedItems\.data\)/);
});

// --- 4. Decline DM ordering ------------------------------------------------

test("a stale Decline stops before the buyer is messaged", () => {
  const route = code("../../app/api/discord/interactions/route.ts");
  const reject = route.slice(route.indexOf("async function runReject"), route.indexOf("export async function POST"));

  assert.match(
    reject,
    /const claim = await claimOrderDecision\(context\.reference, "rejected", context\.actorName, \[\s*"pending",\s*"awaiting_discord_join",\s*"confirmed",\s*\]\);\s*if \(claim === "already_final"\) \{\s*await reportAlreadyHandled\(context\);\s*return;\s*\}/,
  );
  assert.ok(reject.indexOf("claimOrderDecision(") < reject.indexOf("sendBotDirectMessage("));
  // One guarded write, and its result is used. The boolean variant cannot tell
  // a closed order from one that was never saved, so it is not used here.
  assert.equal(reject.match(/claimOrderDecision\(/g)?.length, 1);
  assert.doesNotMatch(reject, /markOrderDecision\(/);
  // Only "already_final" stops the DM: an order with no row still gets its answer.
  assert.equal(reject.match(/reportAlreadyHandled\(/g)?.length, 1);
  assert.doesNotMatch(reject, /claim === "no_record"|claim !== "moved"/);
  // Loading the wording cannot strand a buyer whose order is already declined.
  assert.match(reject, /await getStoreMessages\(\)\.catch\(\(error\) => \{[^}]*return structuredClone\(DEFAULT_STORE_MESSAGES\);\s*\}\);/);
  assert.ok(reject.indexOf("getStoreMessages()") > reject.indexOf("claimOrderDecision("));

  // Confirm reports a lost claim the same way.
  const confirm = route.slice(route.indexOf("async function runConfirm"), route.indexOf("interface TicketLifecycleContext"));
  assert.match(confirm, /if \(!claimed\) \{\s*await reportAlreadyHandled\(context\);\s*return;\s*\}/);
  assert.ok(confirm.indexOf("claimOrderForConfirm(") < confirm.indexOf("sendBotDirectMessage("));
});

// --- 5. Invoice actions use the Orders permission --------------------------

test("invoice actions are gated on the permission their pages require", () => {
  const actions = code("../actions/order-invoices.ts");
  assert.match(actions, /await canManageOrders\(session, userId\)/);
  assert.doesNotMatch(actions, /canManageStore/);
  for (const name of ["createStandaloneInvoiceAction", "saveInvoiceDetailsAction"]) {
    assert.match(exported(actions, name), /const session = await ordersEditor\(\);\s*if \(!session\) return \{ ok: false/, name);
  }

  assert.match(read("../../app/admin/orders/page.tsx"), /requireModuleAccess\(ORDERS_PERMISSION_KEY, "\/admin\/orders"\)/);
  assert.match(read("../../app/admin/orders/[reference]/invoice/page.tsx"), /requireModuleAccess\(ORDERS_PERMISSION_KEY,/);
});

// --- 6. Patch sync route ---------------------------------------------------

test("the patch sync route uses the Play permission, as the editor that calls it does", () => {
  const route = code("../../app/api/discord/patches/route.ts");
  assert.match(route, /if \(!session \|\| !\(await canManagePlay\(session, userId\)\)\) \{/);
  assert.doesNotMatch(route, /hasAtLeast/);
  assert.ok(route.indexOf("canManagePlay(session, userId)") < route.indexOf("getPatchUpdates("));
  // The channel allowlist is still there.
  assert.match(route, /if \(requested && !approvedChannelIds\.has\(requested\)\)/);

  assert.match(read("../../app/admin/play/page.tsx"), /requireModuleAccess\(PLAY_PERMISSION_KEY, "\/admin\/play"\)/);
  assert.match(read("../actions/play-config.ts"), /await canManagePlay\(session, userId\)/);
});

// --- 7. Audit titles come from the database --------------------------------

test("suggestion audit rows record the stored title, never the submitted one", () => {
  const actions = code("../actions/suggestions-admin.ts");

  const status = exported(actions, "updateSuggestionStatusAction");
  assert.doesNotMatch(status, /formData\.get\("title"\)/);
  assert.match(status, /\.returning\(\{ title: schema\.suggestions\.title \}\)/);
  assert.match(status, /metadata: \{ title: updated\.title, status, by: session\.username \}/);

  const remove = exported(actions, "deleteSuggestionAction");
  assert.doesNotMatch(remove, /formData\.get\("title"\)/);
  assert.match(remove, /\.delete\(schema\.suggestions\)\s*\.where\(eq\(schema\.suggestions\.id, id\)\)\s*\.returning\(\{ title: schema\.suggestions\.title \}\)/);
  assert.match(remove, /const title = deleted\.title;/);
  // Nothing is logged when this call deleted nothing.
  assert.ok(remove.indexOf("if (!deleted)") < remove.indexOf("auditLogs"));
});

// --- 8. Staff-set image URLs -----------------------------------------------

test("the banner and share image URLs are checked, not just length-capped", () => {
  assert.match(code("../actions/store-settings.ts"), /imageUrl: z\s*\.string\(\)\s*\.trim\(\)\s*\.min\(1, [^)]*\)\s*\.max\(500, [^)]*\)\s*\.refine\(isSafeLink,/);
  assert.match(code("../actions/site-settings.ts"), /ogImageUrl: z\s*\.string\(\)\s*\.trim\(\)\s*\.max\(500, [^)]*\)\s*\.refine\(isSafeLink,/);
});

test("the image rule keeps every value the editors offer and drops the rest", () => {
  // Presets and defaults shipped today.
  for (const value of [
    "/images/og-default.webp",
    "/images/og-preset-hero-logo.webp",
    "/images/store/survival-purple-citadel.webp",
    "/images/vote-world-bg-v2.webp",
    "https://example.com/social-banner.webp",
  ]) {
    assert.equal(isSafeLink(value), true, value);
  }
  for (const value of [
    "http://example.com/banner.webp",
    "//evil.example/banner.webp",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "javascript:alert(1)",
    "images/banner.webp",
  ]) {
    assert.equal(isSafeLink(value), false, value);
  }
});

test("a decline tells a closed order from one that was never saved", () => {
  const orders = code("../data/orders.ts");
  const claim = orders.slice(orders.indexOf("export async function claimOrderDecision"), orders.indexOf("async function writeOrderDecision"));
  assert.ok(claim.length > 0);
  assert.match(orders, /export type OrderDecisionOutcome = "moved" \| "already_final" \| "no_record";/);
  // No database, or no reference: there is nothing to protect.
  assert.match(claim, /if \(!db \|\| !reference\) return "no_record";/);
  assert.match(claim, /if \(await writeOrderDecision\(db, reference, status, handledBy, null, from\)\) return "moved";/);
  // Nothing moved: look for the row, by the same reference, to say which case it is.
  assert.match(claim, /\.from\(schema\.orders\)\s*\.where\(eq\(schema\.orders\.reference, reference\)\)\s*\.limit\(1\);\s*return existing \? "already_final" : "no_record";/);
  // A database error must reach the caller, so nothing in here swallows it.
  assert.doesNotMatch(claim, /\bcatch\b/);

  // The boolean contract other callers rely on is unchanged: every failure is false.
  const mark = exported(orders, "markOrderDecision");
  assert.match(mark, /if \(!db \|\| !reference\) return false;/);
  assert.match(mark, /try \{\s*return await writeOrderDecision\(db, reference, status, handledBy, ticketChannelId, from\);\s*\} catch \(error\) \{[^}]*return false;\s*\}/);
});
