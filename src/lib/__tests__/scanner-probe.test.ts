import assert from "node:assert/strict";
import test from "node:test";
import { isScannerProbe } from "@/lib/scanner-probe";
import { primaryNav, footerNav, legalNav } from "@/lib/site";

test("scanner probes are recognised", () => {
  for (const path of [
    "/wp-admin/install.php", "/wp-login.php", "/xmlrpc.php", "/index.php", "/.git/config", "/.env",
    "/.env.production", "/api/.env", "/.aws/credentials", "/phpmyadmin/", "/cgi-bin/luci", "/vendor/phpunit/x",
    "/backup.sql", "/%2e%2egit/config", "/%E0%A4%A",
    "/_profiler/phpinfo", "/admin/phpinfo", "/_ignition/execute-solution", "/telescope/requests", "/server-status",
  ]) {
    assert.equal(isScannerProbe(path), true, path);
  }
});

test("real site paths are never treated as probes", () => {
  const sitePaths = [
    "/", "/play", "/store", "/store/vip-rank", "/rules", "/api/status", "/api/health", "/api/presence",
    "/api/bot/presence-config", "/sitemap.xml", "/robots.txt", "/llms.txt", "/manifest.webmanifest",
    "/.well-known/security.txt", "/images/mazora-logo.webp", "/_next/static/chunks/app.js", "/auth/callback",
    "/admin/roles", "/news/some-article", "/players/Steve",
  ];
  const navPaths = [
    ...primaryNav.flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])]),
    ...Object.values(footerNav).flat().map((link) => link.href),
    ...legalNav.map((link) => link.href),
  ].filter((href): href is string => typeof href === "string" && href.startsWith("/"));
  for (const path of [...sitePaths, ...navPaths]) assert.equal(isScannerProbe(path), false, path);
});
