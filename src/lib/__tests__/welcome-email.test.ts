import assert from "node:assert/strict";
import test from "node:test";
import { buildWelcomeEmail, greetingFor } from "../email/welcome-email.js";

test("greets by name when there is one, and still reads properly when there is not", () => {
  // Most members arrive through Google or Discord, where a display name is
  // usual but not guaranteed. "Hi ," would be worse than no name at all.
  assert.equal(greetingFor("KaviYa"), "Hi KaviYa,");
  assert.equal(greetingFor("  KaviYa  "), "Hi KaviYa,");
  assert.equal(greetingFor(""), "Hi there,");
  assert.equal(greetingFor("   "), "Hi there,");
  assert.equal(greetingFor(null), "Hi there,");
  assert.equal(greetingFor(undefined), "Hi there,");
});

test("a name from an OAuth profile cannot break the markup", () => {
  // The display name comes from Google or Discord — text this project did not
  // author — so it is escaped before it reaches the HTML body.
  const mail = buildWelcomeEmail({
    name: '<img src=x onerror="alert(1)">',
    origin: "https://mazora.us",
  });

  assert.ok(!mail.html.includes("<img"));
  assert.ok(mail.html.includes("&lt;img"));
  assert.ok(!mail.html.includes("onerror=\""));
});

test("both a text and an HTML part are produced", () => {
  // A text/plain alternative matters for deliverability: HTML-only mail is a
  // common spam signal, and some clients show nothing without it.
  const mail = buildWelcomeEmail({ name: "KaviYa", origin: "https://mazora.us" });

  assert.ok(mail.text.length > 0);
  assert.ok(mail.html.length > 0);
  assert.ok(!mail.text.includes("<"), "the text part must not contain markup");
  assert.equal(mail.subject, "Welcome to Mazora Network");
});

test("the dashboard link is built cleanly whatever the origin looks like", () => {
  for (const origin of ["https://mazora.us", "https://mazora.us/", "https://mazora.us///"]) {
    const mail = buildWelcomeEmail({ name: "KaviYa", origin });
    assert.ok(mail.html.includes("https://mazora.us/dashboard"), `bad link for origin ${origin}`);
    assert.ok(mail.text.includes("https://mazora.us/dashboard"));
    assert.ok(!mail.html.includes("mazora.us//dashboard"));
  }
});

test("no Supabase template variables survive into the sent message", () => {
  // The design was adapted from the Supabase confirmation template, which uses
  // Go-template tags. Supabase expands those; Resend does not, so any left
  // behind would reach the member as literal "{{ .Token }}" text.
  const mail = buildWelcomeEmail({ name: "KaviYa", origin: "https://mazora.us" });
  assert.ok(!mail.html.includes("{{"), "an unexpanded template tag reached the HTML");
  assert.ok(!mail.text.includes("{{"));
  assert.ok(!/\.Token|\.SiteURL|\.TokenHash/.test(mail.html));
});

test("it says why the recipient got it", () => {
  // An unsolicited-looking email with no explanation is what gets a sending
  // domain reported, which would take the auth emails down with it.
  const mail = buildWelcomeEmail({ name: null, origin: "https://mazora.us" });
  assert.ok(/receiving this because/i.test(mail.text));
  assert.ok(/receiving this because/i.test(mail.html));
});
