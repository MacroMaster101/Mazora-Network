import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/*
  The repository is public, so no real Discord server/channel id, invite code or
  webhook address may be hardcoded. Production supplies them through env vars
  (and Admin → Settings); the fallbacks in code must stay neutral.

  The scan covers every folder a committed text file can live in, not only the
  application source: an id pasted into a migration, a seed script, a workflow
  or the README is exactly as public as one in a component.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Obvious fakes already used in tests and docs. Add only values that are plainly made up. */
const FAKE_SNOWFLAKES = new Set([
  "111111111111111111",
  "222222222222222222",
  "123456789012345678",
  "1234567890123456789",
  "12345678901234567890",
  "12345678901234567",
  "12345678901234568",
  "234567890123456789",
]);

/** Placeholder invite "codes" that are fine to show in UI hints, docs and tests. */
const PLACEHOLDER_INVITES = new Set(["your-invite", "your-invite-code", "example", "notreally"]);

/*
  Dependency folders and build output are not ours to scan. Dot-folders inside a
  walked folder are skipped as a group: they are local tool state (.next,
  supabase/.temp), never committed. `.github` is walked because it is named as a
  root below, not found on the way down.
*/
const SKIPPED_DIRS = new Set(["node_modules"]);

/*
  Lockfiles are full of long digit runs that are not ids (integrity hashes,
  resolved versions) and nobody writes a Discord id into one by hand.
*/
const SKIPPED_FILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"]);

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name) || SKIPPED_FILES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".")) walk(full, extensions, out);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/*
  Files are picked by extension, so images and other binaries (public/images,
  the design concepts under docs/) are never opened.
*/
const WALKED: Record<string, string[]> = {
  src: [".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".txt", ".md"],
  docs: [".md"],
  supabase: [".sql", ".toml", ".json", ".md"],
  scripts: [".ts", ".js", ".mjs", ".json", ".sql", ".sh", ".md"],
  ".github": [".yml", ".yaml", ".md", ".json"],
  // Text only: the images in here are skipped by extension.
  public: [".txt", ".json", ".xml", ".webmanifest"],
};

/*
  The repo root is read one level deep and by name or extension only. `.env`
  and its siblings hold the real ids on a developer's machine and are
  gitignored; `.env.example` is the one that is committed.
*/
const ROOT_EXTENSIONS = [".md", ".json", ".ts", ".mjs", ".cjs", ".js", ".yml", ".yaml", ".toml"];
const ROOT_FILES = new Set([".env.example"]);

function rootFiles(): string[] {
  return readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !SKIPPED_FILES.has(entry.name))
    .filter((entry) => ROOT_FILES.has(entry.name) || ROOT_EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(REPO_ROOT, entry.name));
}

const SOURCES = [
  ...Object.entries(WALKED).flatMap(([dir, extensions]) => walk(join(REPO_ROOT, dir), extensions)),
  ...rootFiles(),
];

/** Repo-relative with forward slashes, so messages and checks read the same on every OS. */
const label = (file: string) => relative(REPO_ROOT, file).replaceAll("\\", "/");

// (?<!\d)/(?!\d) rather than \b: an id glued to word characters (channel_805...)
// has no word boundary but is still an id.
const SNOWFLAKE = /(?<!\d)\d{17,20}(?!\d)/g;
// Case-insensitive: hostnames are, and "Discord.GG/..." is the same invite.
const INVITE = /(?:discord\.gg|dsc\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]+)/gi;
// A webhook address is a credential: anyone holding it can post to the channel.
const WEBHOOK = /discord(?:app)?\.com\/api\/webhooks\/([A-Za-z0-9_-]+)/gi;

/**
 * Everything in `text` that looks like a real Discord identifier.
 *
 * No number is excused for being "probably something else". When this was
 * widened to supabase/, scripts/, .github/ and the root files, the only 17-20
 * digit runs in any of them were the fakes listed above, so there is nothing to
 * carve out. If a legitimate long number ever appears (a nanosecond timestamp,
 * a bigint in SQL), exclude that one file or pattern here with the reason,
 * rather than loosening the pattern for every file.
 */
function discordLookalikes(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(SNOWFLAKE)) {
    if (!FAKE_SNOWFLAKES.has(match[0])) found.push(match[0]);
  }
  for (const match of text.matchAll(INVITE)) {
    if (!PLACEHOLDER_INVITES.has(match[1].toLowerCase())) found.push(match[0]);
  }
  for (const match of text.matchAll(WEBHOOK)) {
    // A real webhook id is all digits, so "webhooks/<id>/<token>" in a doc is
    // not a hit; a numeric one is, unless it is one of the fakes.
    if (/^\d+$/.test(match[1]) && !FAKE_SNOWFLAKES.has(match[1])) found.push(match[0]);
  }
  return found;
}

test("the walk covers every folder that can carry a committed text file", () => {
  const files = SOURCES.map(label);
  assert.ok(files.length > 300, `expected a repo-wide walk, found ${files.length} files`);

  for (const [what, pattern] of [
    ["application source", /^src\/.+\.tsx?$/],
    ["stylesheets", /^src\/.+\.css$/],
    ["docs", /^docs\/.+\.md$/],
    ["database migrations", /^supabase\/migrations\/.+\.sql$/],
    ["supabase config", /^supabase\/config\.toml$/],
    ["scripts", /^scripts\/.+\.ts$/],
    ["workflows", /^\.github\/workflows\/.+\.yml$/],
    ["root markdown", /^README\.md$/],
    ["the env template", /^\.env\.example$/],
    ["root config", /^package\.json$/],
    ["root config modules", /^next\.config\.ts$/],
  ] as const) {
    assert.ok(files.some((file) => pattern.test(file)), `the walk misses ${what}`);
  }
});

test("the walk leaves out dependencies, build output, lockfiles, images and local env files", () => {
  for (const file of SOURCES.map(label)) {
    assert.doesNotMatch(file, /(^|\/)node_modules\//, file);
    assert.doesNotMatch(file, /(^|\/)\.next[^/]*\//, file);
    assert.doesNotMatch(file, /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/, file);
    assert.doesNotMatch(file, /\.(png|jpe?g|gif|webp|ico|svg|woff2?)$/i, file);
    // .env.example is committed and scanned; .env, .env.local and friends are not.
    assert.ok(!/(^|\/)\.env/.test(file) || file === ".env.example", file);
  }
});

test("no committed text file contains a Discord-looking id, invite or webhook other than a known fake", () => {
  const offenders: string[] = [];
  for (const file of SOURCES) {
    const text = readFileSync(file, "utf8");
    if (text.includes("\0")) continue; // binary content behind a text extension
    for (const hit of discordLookalikes(text)) offenders.push(`${label(file)}: ${hit}`);
  }
  assert.deepEqual(
    offenders,
    [],
    "17-20 digit numbers look like real Discord ids, and invite codes and webhook addresses belong in env/settings; use an obvious fake",
  );
});

test("the scan flags a real-looking id, invite or webhook wherever it is written", () => {
  // Built by concatenation so this file does not trip its own scan.
  const id = "8" + "0".repeat(5) + "4".repeat(12);
  const code = "AbCd" + "Ef1";
  const hook = "discord.com/api/" + "webhooks/";

  // One sample in the style of each walked folder.
  for (const sample of [
    `const channelId = "${id}";`, // src
    `insert into settings (key, value) values ('guild', '${id}');`, // supabase
    `DISCORD_GUILD_ID=${id}`, // .env.example
    `          GUILD: ${id}`, // .github
    `Ask in <#${id}> or join https://discord.gg/${code}.`, // docs and root markdown
    `await seed({ invite: "https://dsc.gg/${code}" });`, // scripts
    `https://${hook}${id}/${"t".repeat(20)}`,
    `https://ptb.discordapp.com/api/${"webhooks/"}${id}/abc`,
  ]) {
    assert.ok(discordLookalikes(sample).length > 0, sample);
  }

  // The fakes and placeholders the repo is meant to use stay quiet.
  for (const sample of [
    'const channelId = "111111111111111111";',
    "DISCORD_GUILD_ID=123456789012345678",
    "https://discord.gg/your-invite",
    `https://${hook}123456789012345678/your-token`,
    `https://${hook}YOUR_WEBHOOK_ID/YOUR_TOKEN`,
    "created_at_ns bigint, -- 16 digits: 1700000000000000",
  ]) {
    assert.deepEqual(discordLookalikes(sample), [], sample);
  }
});

test("the invite pattern catches every real-looking form, in any letter case", () => {
  // Built by concatenation so this file does not trip its own scan.
  const code = "AbCd" + "Ef1";
  for (const sample of [
    `discord.gg/${code}`,
    `https://discord.com/invite/${code}`,
    `https://discordapp.com/invite/${code}`,
    `https://Discord.GG/${code}`,
    `HTTPS://DISCORD.COM/INVITE/${code}`,
    `dsc.gg/${code}`,
    `https://DSC.gg/${code}`,
  ]) {
    const match = [...sample.matchAll(INVITE)][0];
    assert.ok(match && !PLACEHOLDER_INVITES.has(match[1].toLowerCase()), sample);
  }
  for (const sample of [
    "https://discord.gg/your-invite",
    "discord.gg/your-invite-code",
    "https://discord.gg/…",
    "discord.gg/example",
    "https://Discord.gg/Your-Invite",
  ]) {
    const match = [...sample.matchAll(INVITE)][0];
    assert.ok(!match || PLACEHOLDER_INVITES.has(match[1].toLowerCase()), sample);
  }
});

test("the webhook pattern catches a webhook address on any Discord host", () => {
  const hook = "/api/" + "webhooks/";
  const id = "9" + "1".repeat(4) + "5".repeat(13);
  for (const host of ["discord.com", "discordapp.com", "canary.discord.com", "DISCORD.COM"]) {
    const sample = `https://${host}${hook}${id}/token`;
    assert.equal([...sample.matchAll(WEBHOOK)].length, 1, sample);
  }
  // Prose about webhooks, with no address in it, is not a hit.
  assert.equal([..."Create a webhook under Integrations → Webhooks.".matchAll(WEBHOOK)].length, 0);
});

test("the snowflake pattern catches ids glued to word characters", () => {
  assert.equal("channel_123456789012345678x".match(SNOWFLAKE)?.length, 1);
  assert.equal("x123456789012345678".match(SNOWFLAKE)?.length, 1);
  assert.equal("123456789012345678901".match(SNOWFLAKE), null, "21 digits is not a snowflake");
});

test("site.ts falls back to neutral values, treating a blank env value as unset", () => {
  const source = read("../site.ts");
  assert.match(source, /NEXT_PUBLIC_DISCORD_INVITE_URL\?\.trim\(\) \|\| "https:\/\/discord\.com"/);
  assert.match(source, /NEXT_PUBLIC_DISCORD_SUPPORT_TICKETS_URL\?\.trim\(\) \|\| ""/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_DISCORD_\w+ \?\?/, "`??` would keep an empty env value");
});

test("the Discord page reads the guild id from the server env and only renders the widget when valid", () => {
  const source = read("../../app/(site)/discord/page.tsx");
  assert.match(source, /getDiscordGuildId\(\)/);
  assert.match(source, /guildId \?/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_DISCORD_GUILD/);
});

test("the patch channel fallback chain ends with an empty string", () => {
  const source = read("../data/patches.ts");
  assert.match(source, /requestedChannel \|\| patchChannelId \|\| announcementsChannelId \|\| ""/);
  // The env ids are trimmed, matching the route that resolves them.
  assert.match(source, /patchChannelId = process\.env\.DISCORD_PATCH_CHANNEL_ID\?\.trim\(\)/);
  assert.match(source, /announcementsChannelId = process\.env\.DISCORD_ANNOUNCEMENTS_CHANNEL_ID\?\.trim\(\)/);
  assert.match(source, /if \(token && channelId\)/);
});

test("the default play config ships no channel id", () => {
  assert.match(read("../types.ts"), /discordChannelId: ""/);
});
