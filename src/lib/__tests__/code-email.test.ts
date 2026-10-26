import assert from "node:assert/strict";
import test from "node:test";
import { buildCodeEmail, type CodeEmailPurpose } from "@/lib/email/code-email";

const purposes: CodeEmailPurpose[] = ["two-factor-sign-in", "account-change", "account-deletion"];

test("every code email uses the branded layout and shows the code in both parts", () => {
  for (const purpose of purposes) {
    const mail = buildCodeEmail({ purpose, code: "123456", origin: "https://example.com/", support: "help@example.com" });
    assert.ok(mail.html.startsWith("<!doctype html>"), purpose);
    assert.match(mail.html, /src="https:\/\/example\.com\/images\/email\/mazora-logo-light\.png"/);
    assert.ok(mail.html.includes(">123456</p>"), purpose);
    assert.ok(mail.text.includes("Your code: 123456"), purpose);
    assert.ok(/10 minutes/.test(mail.text), purpose);
    assert.ok(mail.text.includes("Questions? help@example.com"), purpose);
  }
});

test("the sign-in code keeps its subject and says what to do if it wasn't them", () => {
  const mail = buildCodeEmail({ purpose: "two-factor-sign-in", code: "123456", origin: "https://example.com", support: null });
  assert.equal(mail.subject, "Your Mazora sign-in verification code");
  assert.ok(/change your password/i.test(mail.text));
  assert.equal(mail.text.includes("Questions?"), false);
});

test("deletion and account-change codes keep their own subjects", () => {
  assert.equal(buildCodeEmail({ purpose: "account-deletion", code: "123456", origin: "https://example.com", support: null }).subject, "Confirm your account deletion");
  assert.equal(buildCodeEmail({ purpose: "account-change", code: "123456", origin: "https://example.com", support: null }).subject, "Confirm it's you");
});
