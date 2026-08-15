import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { applyCreatorCode, MAX_PERCENT_OFF } from "@/lib/store-discount";

const line = (over: Partial<Parameters<typeof applyCreatorCode>[0][number]> = {}) => ({
  productId: "p1",
  name: "Legendary Key",
  quantity: 1,
  unitPrice: 10,
  eligible: true,
  ...over,
});

describe("applyCreatorCode", () => {
  test("takes the percentage off an eligible line", () => {
    const result = applyCreatorCode([line()], 15);
    assert.equal(result.subtotal, 10);
    assert.equal(result.discount, 1.5);
    assert.equal(result.total, 8.5);
  });

  test("multiplies by quantity before discounting", () => {
    const result = applyCreatorCode([line({ quantity: 3 })], 10);
    assert.equal(result.subtotal, 30);
    assert.equal(result.discount, 3);
    assert.equal(result.total, 27);
  });

  test("leaves ineligible lines untouched but still counts them in the total", () => {
    const result = applyCreatorCode(
      [line({ productId: "a" }), line({ productId: "b", eligible: false })],
      50,
    );
    assert.equal(result.subtotal, 20);
    assert.equal(result.discount, 5);
    assert.equal(result.total, 15);
    assert.equal(result.lines[1].lineDiscount, 0);
  });

  test("returns a zero discount when nothing in the cart is eligible", () => {
    const result = applyCreatorCode([line({ eligible: false })], 25);
    assert.equal(result.discount, 0);
    assert.equal(result.total, result.subtotal);
  });

  test("rounds half-up per line, and line discounts sum to the total discount", () => {
    // 0.05 * 15% = 0.0075 -> 0.75 cents -> rounds up to 1 cent, per line.
    const lines = [
      line({ productId: "a", unitPrice: 0.05 }),
      line({ productId: "b", unitPrice: 0.05 }),
    ];
    const result = applyCreatorCode(lines, 15);
    const summed = result.lines.reduce((sum, item) => sum + item.lineDiscount, 0);
    assert.equal(result.discount, summed);
    assert.equal(result.discount, 0.02);
  });

  test("clamps the percentage to MAX_PERCENT_OFF so a total can never reach zero", () => {
    const result = applyCreatorCode([line({ unitPrice: 100 })], 100);
    assert.equal(MAX_PERCENT_OFF, 90);
    assert.equal(result.discount, 90);
    assert.equal(result.total, 10);
    assert.ok(result.total > 0);
  });

  test("treats a zero or negative percentage as no discount", () => {
    assert.equal(applyCreatorCode([line()], 0).discount, 0);
    assert.equal(applyCreatorCode([line()], -20).discount, 0);
  });

  test("an empty cart yields zeroes rather than NaN", () => {
    const result = applyCreatorCode([], 15);
    assert.equal(result.subtotal, 0);
    assert.equal(result.discount, 0);
    assert.equal(result.total, 0);
  });

  test("guards against NaN unitPrice: a malformed line does not poison the order total", () => {
    const result = applyCreatorCode(
      [line({ productId: "a", unitPrice: NaN }), line({ productId: "b" })],
      20,
    );
    // The NaN line contributes 0 to the totals; the valid line discounts normally.
    assert.equal(result.subtotal, 10);
    assert.equal(result.discount, 2);
    assert.equal(result.total, 8);
    // All totals are finite (not NaN).
    assert.ok(Number.isFinite(result.subtotal));
    assert.ok(Number.isFinite(result.discount));
    assert.ok(Number.isFinite(result.total));
    // The NaN line is still in the output but contributes zero.
    assert.equal(result.lines[0].lineSubtotal, 0);
    assert.equal(result.lines[0].lineDiscount, 0);
  });

  test("guards against non-finite quantity: Infinity does not poison the totals", () => {
    const result = applyCreatorCode(
      [
        line({ productId: "a", quantity: Infinity }),
        line({ productId: "b", quantity: 2 }),
      ],
      25,
    );
    // The Infinity line becomes 0 quantity, contributing nothing.
    assert.equal(result.subtotal, 20);
    assert.equal(result.discount, 5);
    assert.equal(result.total, 15);
    assert.ok(Number.isFinite(result.total));
    assert.equal(result.lines[0].lineSubtotal, 0);
  });

  test("clamps fractional quantity to an integer so cent arithmetic stays clean", () => {
    const result = applyCreatorCode([line({ quantity: 2.5, unitPrice: 1 })], 10);
    // 2.5 should clamp to 2, so subtotal is 2 * 1 = 2, discount is 0.2.
    assert.equal(result.subtotal, 2);
    assert.equal(result.discount, 0.2);
    assert.equal(result.total, 1.8);
    // All totals are finite and valid monetary amounts.
    assert.ok(Number.isFinite(result.subtotal));
    assert.ok(Number.isFinite(result.discount));
    assert.ok(Number.isFinite(result.total));
  });
});
