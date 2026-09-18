import assert from "node:assert/strict";
import test from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePostBody, renderPostBody } from "@/lib/forums/render-post";

const html = (body: string) =>
  renderToStaticMarkup(createElement(Fragment, null, renderPostBody(body)));

test("plain text becomes a paragraph", () => {
  assert.match(html("hello world"), /<p[^>]*>hello world<\/p>/);
});

test("HTML-looking input is rendered as text, never as markup", () => {
  const out = html("<script>alert(1)</script>");
  assert.ok(!out.includes("<script>"), "a script tag must never reach the output");
  assert.ok(out.includes("&lt;script&gt;"));
});

test("an img onerror payload is inert", () => {
  // React escapes `<` and `"` but not `=` or letters, so the words "img" and
  // "onerror=" survive as visible text. Asserting they vanish would assert
  // something React never does. The real property is that no element is
  // produced — checked for both the quoted and the unquoted payload.
  for (const payload of ['<img src=x onerror="alert(1)">', "<img src=x onerror=alert(1)>"]) {
    const out = html(payload);
    assert.ok(!/<(img|script|svg|iframe)/i.test(out), `${payload} must not produce an element`);
    assert.ok(out.includes("&lt;img"));
  }
});

test("javascript: and data: URLs are never linked", () => {
  for (const attack of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
    const out = html(`click ${attack}`);
    assert.ok(!out.includes("<a "), `${attack} must not become a link`);
  }
});

test("a protocol-relative URL is not linked", () => {
  assert.ok(!html("see //evil.example/x").includes("<a "));
});

test("http and https URLs are linked safely", () => {
  const out = html("see https://mazora.us/vote for details");
  assert.match(out, /<a [^>]*href="https:\/\/mazora\.us\/vote"/);
  assert.match(out, /rel="noopener noreferrer"/);
});

test("emphasis and inline code render as elements", () => {
  assert.match(html("**bold**"), /<strong>bold<\/strong>/);
  assert.match(html("*italic*"), /<em>italic<\/em>/);
  assert.match(html("`code`"), /<code>code<\/code>/);
});

test("unbalanced markers stay literal instead of swallowing the post", () => {
  const out = html("**unclosed bold");
  assert.ok(!out.includes("<strong>"));
  assert.ok(out.includes("**unclosed bold"));
});

test("a code block never interprets its contents", () => {
  const out = html("```\n**not bold** and https://x.test\n```");
  assert.ok(!out.includes("<strong>"));
  assert.ok(!out.includes("<a "));
  assert.match(out, /<pre[^>]*>/);
});

test("quotes and lists parse into their own blocks", () => {
  const blocks = parsePostBody("> quoted\n\n- one\n- two");
  assert.equal(blocks[0].kind, "quote");
  assert.equal(blocks[1].kind, "list");
  assert.deepEqual(blocks[1].lines, ["one", "two"]);
});

test("an empty body produces no blocks and does not throw", () => {
  assert.deepEqual(parsePostBody(""), []);
  assert.equal(html(""), "");
});
