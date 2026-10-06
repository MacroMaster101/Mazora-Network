import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const braces = require("braces");

test("installed brace expansion preserves ordinary glob and range behavior", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file-{1..3}.ts"), ["src/app/file-1.ts", "src/app/file-2.ts", "src/app/file-3.ts", "src/lib/file-1.ts", "src/lib/file-2.ts", "src/lib/file-3.ts"]);
  assert.equal(braces.compile("src/{app,lib}/**/*.ts"), "src/(app|lib)/**/*.ts");
  assert.equal(braces.stringify(braces.parse("{a,{b,c}}")), "{a,{b,c}}");
});

test("deep brace and parentheses nesting fails with a bounded syntax error", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"]]) {
    const input = open.repeat(3_000) + "a,b" + close.repeat(3_000);
    for (const method of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => method(input), { name: "SyntaxError", message: /nesting limit/ });
    }
  }
});

test("AST inputs cannot bypass nesting guards or recurse through cycles", () => {
  const root: { nodes: unknown[] } = { nodes: [] };
  let current = root;
  for (let i = 0; i < 1000; i++) { const child = { nodes: [] }; current.nodes.push(child); current = child; }
  for (const method of [braces.compile, braces.expand, braces.stringify]) assert.throws(() => method(root), { name: "SyntaxError" });
  const cyclic: { nodes: unknown[] } = { nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const method of [braces.compile, braces.expand, braces.stringify]) assert.throws(() => method(cyclic), { name: "SyntaxError" });
});

test("quoted and escaped literal braces are not mistaken for nested syntax", () => {
  const quoted = '"' + "{".repeat(1000) + '"';
  assert.equal(braces.compile(quoted), "{".repeat(1000));
  assert.equal(braces.compile("\\{".repeat(1000)), "{".repeat(1000));
});
