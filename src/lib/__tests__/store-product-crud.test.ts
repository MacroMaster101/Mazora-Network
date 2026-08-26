import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  parseStoreProductForm,
  storeProductSlug,
  storeRankFamily,
} from "@/lib/store-product-validation";

function productForm(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    name: "Scarlet Bundle",
    description: "A complete cosmetic skin bundle.",
    category: "Cosmetics",
    price: "24.99",
    salePrice: "19.99",
    imageUrl: "/images/store/scarlet.webp",
    features: "Permanent access\nStaff delivery",
    accent: "rose",
    badge: "Popular",
    billing: "",
    subcategory: "Skin Bundles",
    gameModeSlug: "survival-smp",
    sortOrder: "20",
    enabled: "on",
    ...overrides,
  };
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("Store product validation", () => {
  test("accepts and normalizes a complete product form", () => {
    const parsed = parseStoreProductForm(productForm());
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.price, 24.99);
    assert.equal(parsed.data.salePrice, 19.99);
    assert.equal(parsed.data.enabled, true);
    assert.equal(storeProductSlug(parsed.data), "survival-smp-cosmetics-skin-bundles-scarlet-bundle");
  });

  test("returns the exact field when a sale exceeds the regular price", () => {
    const parsed = parseStoreProductForm(productForm({ price: "10", salePrice: "12" }));
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.deepEqual(parsed.error.issues[0]?.path, ["salePrice"]);
    assert.equal(parsed.error.issues[0]?.message, "Sale price cannot be higher than the regular price.");
  });

  test("rejects missing names, descriptions, categories, and game modes", () => {
    const parsed = parseStoreProductForm(productForm({ name: "", description: "", category: "", gameModeSlug: "" }));
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.deepEqual(new Set(parsed.error.issues.map((issue) => issue.path[0])), new Set(["name", "description", "category", "gameModeSlug"]));
  });

  test("keeps rank family names stable across billing suffixes", () => {
    assert.equal(storeRankFamily("Conqueror (Permanent)"), "Conqueror");
    assert.equal(storeRankFamily("Conqueror Monthly"), "Conqueror");
  });
});

describe("Store product mutation guarantees", () => {
  const actions = readFileSync(join(process.cwd(), "src/lib/actions/store-admin.ts"), "utf8");
  const manager = readFileSync(join(process.cwd(), "src/components/admin/store-catalog-manager.tsx"), "utf8");

  function actionBody(name: string, nextName: string) {
    const start = actions.indexOf(`export async function ${name}`);
    const end = actions.indexOf(`export async function ${nextName}`, start + 1);
    assert.ok(start >= 0 && end > start, `${name} source block should exist`);
    return actions.slice(start, end);
  }

  test("create/update, publish toggles, and deletes keep their audit write transactional", () => {
    for (const body of [
      actionBody("saveStoreProductAction", "toggleStoreProductAction"),
      actionBody("toggleStoreProductAction", "saveStoreModeAction"),
      actionBody("deleteStoreProductAction", "deleteStoreModeAction"),
    ]) {
      assert.match(body, /db\.transaction/);
      assert.match(body, /tx\.insert\(schema\.auditLogs\)/);
    }
  });

  test("the product modal renders returned errors and focuses the first invalid field", () => {
    assert.match(manager, /setProductErrors\(nextErrors\)/);
    assert.match(manager, /PRODUCT_ERROR_TARGETS/);
    assert.match(manager, /scrollIntoView/);
    assert.match(manager, /aria-invalid=\{Boolean\(productErrors\.salePrice\)\}/);
    assert.match(manager, /error=\{productErrors\.description\}/);
  });
});
