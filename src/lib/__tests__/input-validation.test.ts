import assert from "node:assert/strict";
import test from "node:test";
import { isValidSocialUrl } from "../creator-socials";
import { parseStoredCart } from "../../components/shared/cart-provider";

test("social URLs must be https without credentials", () => {
  assert.equal(isValidSocialUrl("https://youtube.com/@Steve_42"), true);
  assert.equal(isValidSocialUrl(" https://example.com/page "), true);
  assert.equal(isValidSocialUrl("http://example.com/page"), false);
  assert.equal(isValidSocialUrl("https://user:pass@example.com/"), false);
  assert.equal(isValidSocialUrl("https://user@example.com/"), false);
  assert.equal(isValidSocialUrl("javascript:alert(1)"), false);
  assert.equal(isValidSocialUrl("not a url"), false);
});

const goodItem = { slug: "example-rank", name: "Example Rank", price: 9.99, accent: "emerald", category: "ranks", qty: 2 };

test("stored cart keeps valid lines and drops malformed ones", () => {
  const result = parseStoredCart([
    goodItem,
    null,
    "text",
    { ...goodItem, slug: 5 },
    { ...goodItem, slug: "bad-qty", qty: 1.5 },
    { ...goodItem, slug: "zero-qty", qty: 0 },
    { ...goodItem, slug: "bad-price", price: "free" },
    { ...goodItem, slug: "nan-price", price: Number.NaN },
    { ...goodItem, slug: "dup" },
    { ...goodItem, slug: "dup" },
  ]);
  assert.deepEqual(result.map((item) => item.slug), ["example-rank", "dup"]);
});

test("stored cart caps quantity and rejects non-arrays", () => {
  assert.equal(parseStoredCart([{ ...goodItem, qty: 9999 }])[0].qty, 20);
  assert.deepEqual(parseStoredCart({ slug: "x" }), []);
  assert.deepEqual(parseStoredCart(null), []);
});
