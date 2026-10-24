import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSupportEmail, supportMailto } from "@/lib/support-contact";
import { checkEnvironment } from "@/lib/env";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("support contact", () => {
  test("accepts a plain address and trims it", () => {
    assert.equal(parseSupportEmail("  support@example.com "), "support@example.com");
  });

  test("anything else means no address, and the line is hidden", () => {
    for (const value of [undefined, "", "   ", "support", "support@example", "a b@example.com", "<x>@example.com", "support@example.com?cc=x@example.com"]) {
      assert.equal(parseSupportEmail(value), null, String(value));
    }
  });

  test("the mail subject carries only a well-formed incident code", () => {
    assert.equal(supportMailto("support@example.com"), "mailto:support@example.com?subject=Mazora%20site%20problem");
    assert.equal(
      supportMailto("support@example.com", "1234567890"),
      "mailto:support@example.com?subject=Mazora%20site%20problem%20(incident%201234567890)",
    );
    assert.equal(supportMailto("support@example.com", "x&body=hello"), "mailto:support@example.com?subject=Mazora%20site%20problem");
  });

  test("the address comes from the environment, never from source", () => {
    assert.match(read("../support-contact.ts"), /parseSupportEmail\(process\.env\.NEXT_PUBLIC_SUPPORT_EMAIL\)/);
    const srcRoot = fileURLToPath(new URL("../../", import.meta.url));
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path);
        return /\.(tsx?|css)$/.test(name) ? [path] : [];
      });
    })(srcRoot);
    const hardcoded = files.filter((file) => /mailto:[\w.+-]+@|[\w.+-]+@(gmail|outlook|hotmail|yahoo|proton)\./i.test(readFileSync(file, "utf8")));
    assert.deepEqual(hardcoded, []);
  });

  test("the environment check validates the address", () => {
    assert.deepEqual(checkEnvironment({ NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.com" }, { production: false }), []);
    const problems = checkEnvironment({ NEXT_PUBLIC_SUPPORT_EMAIL: "not-an-address" }, { production: false });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^NEXT_PUBLIC_SUPPORT_EMAIL /);
  });

  test("error screens offer the address with the incident code; the 404 does not", () => {
    const screen = read("../../components/shared/error-screen.tsx");
    assert.match(screen, /kind === "error" && supportEmail && \(/);
    assert.match(screen, /supportMailto\(supportEmail, error\?\.digest\)/);
    assert.doesNotMatch(screen, /error\.message|error\.stack/);
    const card = read("../../components/shared/global-error-card.tsx");
    assert.match(card, /supportMailto\(supportEmail, digest\)/);
    assert.doesNotMatch(card, /message|stack/);
  });
});

describe("outage notice", () => {
  test("the layout shows it only while the database is down", () => {
    const layout = read("../../app/layout.tsx");
    assert.match(layout, /isDatabaseDown\(\),/);
    assert.match(layout, /\{databaseDown && <ServiceNotice \/>\}/);
  });

  test("a down answer is cached, not thrown, and a missing cache shows no notice", () => {
    const health = read("../data/service-health.ts");
    assert.match(health, /\(await probeDatabase\(PROBE_TIMEOUT_MS\)\) === "down"/);
    assert.match(health, /revalidate: OUTAGE_CHECK_SECONDS/);
    assert.match(health, /catch \{[\s\S]*?return false;/);
  });

  test("the notice says what to expect, never why it failed", () => {
    const notice = read("../../components/shared/service-notice.tsx");
    const markup = notice.slice(notice.indexOf("return ("));
    assert.doesNotMatch(markup, /supabase|vercel|quota|limit|error|database|\{error|digest/i);
    assert.match(markup, /Your account and progress are safe/);
  });

  test("the error preview is development only", () => {
    const page = read("../../app/dev/error-preview/page.tsx");
    assert.match(page, /if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
  });
});
