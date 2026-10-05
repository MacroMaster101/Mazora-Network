import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicBucketObjectUrl } from "@/lib/storage-url";
import { MAX_IMAGE_BYTES } from "@/lib/suggestion-image-rules";

/*
  Bounds on what the server reads, fetches and keeps. Most of the modules here
  are "server-only" or "use server" and cannot be imported by a plain node test,
  so those are checked from their source; the middleware matcher is a plain
  pattern and is run for real.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/* ---- early size checks on uploads ---------------------------------------- */

test("the shared upload ceiling matches the one the image store enforces", () => {
  assert.equal(MAX_IMAGE_BYTES, 8 * 1024 * 1024);
  assert.match(read("../news/image-store.ts"), /const MAX_IMAGE_BYTES = 8 \* 1024 \* 1024;/);
});

for (const path of ["../suggestions/image-store.ts", "../forums/image-store.ts", "../actions/gallery.ts"]) {
  test(`${path.replace("../", "")} checks a file's size before reading it into memory`, () => {
    const source = read(path);
    assert.match(source, /import \{[^}]*\bMAX_IMAGE_BYTES\b[^}]*\} from "@\/lib\/suggestion-image-rules";/);

    const buffered = source.indexOf("await file.arrayBuffer()");
    const checked = source.indexOf("file.size > MAX_IMAGE_BYTES");
    assert.ok(buffered > 0, "expected the file to be read");
    assert.ok(checked > 0 && checked < buffered, "the size check must come before arrayBuffer()");
    // One read of the file, so one check is enough to cover it.
    assert.equal(source.split("file.arrayBuffer()").length - 1, 1);
    assert.doesNotMatch(source, /file\.size > 8 \* 1024 \* 1024/, "use the shared constant, not a second number");
  });
}

/* ---- gallery: which storage links are kept without a copy ---------------- */

test("the gallery and creator editors keep a link as-is only when it is in the public image bucket", () => {
  // One rule, in one place: on our storage origin first, then one bucket's public path.
  const rule = read("../storage-url.ts");
  const bucketRule = rule.slice(rule.indexOf("export function isPublicBucketObjectUrl("));
  assert.match(bucketRule, /if \(!bucket \|\| !isSupabaseStorageObjectUrl\(value, supabaseUrl\)\) return false;/);
  assert.match(bucketRule, /new URL\(value\)\.pathname\.startsWith\(`\/storage\/v1\/object\/public\/\$\{bucket\}\/`\)/);
  const store = read("../news/image-store.ts");
  assert.match(store, /export const NEWS_IMAGE_BUCKET = "news-images";/);
  assert.match(
    store,
    /export function isOwnPublicImageUrl\(url: string\): boolean \{\s*return isPublicBucketObjectUrl\(url, process\.env\.NEXT_PUBLIC_SUPABASE_URL, NEWS_IMAGE_BUCKET\);\s*\}/,
  );

  // Anything else falls through to the re-host, and a failed re-host is refused.
  const gallery = read("../actions/gallery.ts");
  const resolve = gallery.slice(gallery.indexOf("async function resolveGalleryImage("));
  assert.ok(resolve.indexOf("if (isOwnPublicImageUrl(rawLink)) return { url: rawLink };") > 0);
  assert.ok(resolve.indexOf("if (isOwnPublicImageUrl(rawLink)) return { url: rawLink };") < resolve.indexOf("await rehostImageFromUrl(rawLink"));
  assert.match(resolve, /That image link could not be downloaded\./);

  const creators = read("../actions/content-creators.ts");
  const kept = creators.indexOf("if (isOwnPublicImageUrl(rawLink)) return { url: rawLink };");
  assert.ok(kept > 0 && kept < creators.indexOf("await rehostImageFromUrl(rawLink, keyBase)"));
  assert.match(creators, /That image link could not be downloaded\./);

  // Neither file keeps the looser "anywhere on the storage origin" check.
  for (const source of [gallery, creators]) assert.doesNotMatch(source, /isSupabaseStorageObjectUrl/);
});

test("the bucket path rule accepts our public objects and nothing beside them", () => {
  // The rule itself, on an invented project URL.
  const project = "https://abcdefghijklmnop.supabase.example";
  const kept = (value: string) => isPublicBucketObjectUrl(value, project, "news-images");
  assert.equal(isPublicBucketObjectUrl(`${project}/storage/v1/object/public/news-images/x.webp`, "", "news-images"), false);
  assert.equal(isPublicBucketObjectUrl(`${project}/storage/v1/object/public//x.webp`, project, ""), false);

  assert.equal(kept(`${project}/storage/v1/object/public/news-images/gallery/submit-1.webp`), true);
  for (const other of [
    `${project}/storage/v1/object/public/avatars/00000000-0000-3000-8000-000000000001.webp`,
    `${project}/storage/v1/object/sign/news-images/gallery/submit-1.webp?token=x`,
    `${project}/storage/v1/object/authenticated/news-images/gallery/submit-1.webp`,
    `${project}/storage/v1/object/public/news-images-private/x.webp`,
    `${project}/storage/v1/object/public/news-images/../avatars/x.webp`,
    `${project}/storage/v1/object/public/news-images/%2e%2e/avatars/x.webp`,
    `${project}.evil.example/storage/v1/object/public/news-images/x.webp`,
  ]) {
    assert.equal(kept(other), false, other);
  }
});

/* ---- skin body route ------------------------------------------------------ */

test("the skin body route never buffers an upstream body it has not measured", () => {
  const source = read("../../app/api/minecraft/skin/[username]/body/route.ts");
  assert.doesNotMatch(source, /await upstream\.(text|arrayBuffer|json)\(\)/);

  const reader = source.slice(source.indexOf("async function readSkinBody("), source.indexOf("export async function GET("));
  // Early exit on a declared size, then the running total decides.
  assert.match(reader, /Number\.isFinite\(declared\) && declared > SKIN_MAX_BYTES/);
  assert.match(reader, /total \+= value\.byteLength;\s*if \(total > SKIN_MAX_BYTES\) \{\s*await reader\.cancel\(\)/);
  assert.ok(reader.indexOf("total > SKIN_MAX_BYTES") < reader.indexOf("chunks.push(value)"), "check before keeping the chunk");

  // The origin pin and the refusal to follow redirects are untouched.
  assert.match(source, /isSupabaseStorageObjectUrl\(linked\.rawSkinUrl, process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/);
  assert.match(source, /fetch\(linked\.rawSkinUrl, \{ cache: "no-store", redirect: "error" \}\)/);
});

/* ---- YouTube channel lookup ---------------------------------------------- */

test("the YouTube lookup follows redirects by hand and re-checks every hop", () => {
  const source = read("../youtube-profile.ts");
  assert.match(source, /redirect: "manual",/);
  assert.doesNotMatch(source, /await response\.(text|arrayBuffer|json)\(\)/);

  const resolve = source.slice(source.indexOf("export async function resolveYouTubeProfileImage("));
  // The link and each redirect target go through the same host rule.
  assert.match(resolve, /if \(!isYouTubePageUrl\(url\)\) return null;/);
  assert.match(resolve, /const next = new URL\(location, url\);\s*if \(!isYouTubePageUrl\(next\)\) return null;/);
  assert.match(resolve, /for \(let hop = 0; hop <= MAX_REDIRECTS; hop \+= 1\)/);
  assert.match(source, /url\.protocol === "https:" && url\.port === "" && YOUTUBE_HOSTS\.has\(url\.hostname\)/);
  assert.match(source, /const YOUTUBE_HOSTS = new Set\(\["youtube\.com", "www\.youtube\.com", "m\.youtube\.com"\]\);/);

  // One timer covers every hop and the body.
  assert.match(resolve, /const timer = setTimeout\(\(\) => controller\.abort\(\), LOOKUP_TIMEOUT_MS\);/);
  assert.match(resolve, /signal: controller\.signal,/);
  assert.match(resolve, /finally \{\s*clearTimeout\(timer\);/);
});

test("the YouTube lookup starts on www so the common case needs no uncached redirect", () => {
  const source = read("../youtube-profile.ts");
  assert.match(source, /const CANONICAL_YOUTUBE_HOST = "www\.youtube\.com";/);
  const resolve = source.slice(source.indexOf("export async function resolveYouTubeProfileImage("));
  // After the host rule has accepted the link, and before the first request.
  const check = resolve.indexOf("if (!isYouTubePageUrl(url)) return null;");
  const rewrite = resolve.indexOf("url.hostname = CANONICAL_YOUTUBE_HOST;");
  assert.ok(check > 0 && rewrite > check && rewrite < resolve.indexOf("await fetch(url,"));
  // Once only: a redirect target is followed as sent, and still re-checked.
  assert.equal(resolve.match(/CANONICAL_YOUTUBE_HOST/g)?.length, 1);
  assert.ok(rewrite < resolve.indexOf("for (let hop = 0;"));

  // What that assignment does to each host the rule accepts.
  for (const host of ["youtube.com", "m.youtube.com", "www.youtube.com"]) {
    const url = new URL(`https://${host}/@ExampleChannel?view=1`);
    url.hostname = "www.youtube.com";
    assert.equal(url.href, "https://www.youtube.com/@ExampleChannel?view=1");
  }
});

test("the YouTube lookup stops reading at the page cap", () => {
  const source = read("../youtube-profile.ts");
  const reader = source.slice(source.indexOf("async function readPageText("), source.indexOf("export async function resolveYouTubeProfileImage("));
  assert.match(source, /const MAX_PAGE_BYTES = 3_000_000;/);
  assert.match(reader, /Number\.isFinite\(declared\) && declared > MAX_PAGE_BYTES/);
  assert.match(reader, /total \+= value\.byteLength;\s*if \(total > MAX_PAGE_BYTES\) \{\s*controller\.abort\(\);\s*return null;/);
  assert.ok(reader.indexOf("total > MAX_PAGE_BYTES") < reader.indexOf("decoder.decode(value"), "check before keeping the chunk");
});

/* ---- middleware matcher --------------------------------------------------- */

function middlewareMatcher(): RegExp {
  const raw = read("../../middleware.ts").match(/matcher: \["(.+)"\]/)?.[1];
  assert.ok(raw, "expected a single matcher string");
  // The source is a TypeScript string literal; JSON reads its escapes the same way.
  return new RegExp(`^${JSON.parse(`"${raw}"`) as string}$`);
}

test("middleware runs on page routes even when the last segment looks like an image", () => {
  const matcher = middlewareMatcher();
  for (const path of [
    "/",
    "/play",
    "/players/Steve_42",
    "/players/Steve_42.png",
    "/news/some-article.webp",
    "/admin/orders/REF-1.jpg",
    "/dashboard/tickets/abc.svg",
    "/api/minecraft/skin/Steve_42/body",
    "/imagesx",
  ]) {
    assert.equal(matcher.test(path), true, path);
  }
});

test("middleware still skips real static assets", () => {
  const matcher = middlewareMatcher();
  for (const path of [
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/icon.png",
    "/images/mazora-logo.webp",
    "/images/world/deep/backdrop.png",
  ]) {
    assert.equal(matcher.test(path), false, path);
  }
});

test("every image in public/ sits where the matcher skips it", () => {
  // The matcher skips /images/** and single-segment image paths. An image
  // anywhere else in public/ would be served through middleware.
  const image = /\.(svg|png|jpe?g|gif|webp)$/i;
  const publicDir = join(REPO_ROOT, "public");
  const misplaced: string[] = [];
  const visit = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (path !== "/images") visit(join(dir, entry.name), path);
      } else if (image.test(entry.name) && prefix !== "") {
        misplaced.push(path);
      }
    }
  };
  if (existsSync(publicDir)) visit(publicDir, "");
  assert.deepEqual(misplaced, [], "keep images under public/images (or the root of public/)");
});

/* ---- configuration and fallbacks ------------------------------------------ */

test(".env.example describes the remote image allowlist as it behaves", () => {
  const env = readFileSync(join(REPO_ROOT, ".env.example"), "utf8");
  const start = env.lastIndexOf("\n\n", env.indexOf("REMOTE_IMAGE_HOST_ALLOWLIST="));
  const comment = env.slice(start, env.indexOf("REMOTE_IMAGE_HOST_ALLOWLIST="));
  assert.match(comment, /Empty \(the default\) means ANY public host is accepted/);
  assert.doesNotMatch(comment, /arbitrary hosts are refused/);

  // And that is what the code does: no list, no hostname restriction.
  assert.match(read("../news/image-store.ts"), /if \(configured\.length === 0\) return true;/);
});

test("the TikTok link is the bare profile, with no share-tracking parameters", () => {
  const href = read("../site.ts").match(/label: "TikTok", href: "([^"]+)"/)?.[1];
  assert.ok(href, "expected a TikTok link");
  const url = new URL(href);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.match(url.pathname, /^\/@[\w.]+$/);
});

test("with no patch notes anywhere, visitors get an empty list, not invented ones", () => {
  const source = read("../data/patches.ts");
  // The sample notes are gone from the module the public page reads.
  assert.doesNotMatch(source, /SAMPLE_PATCH_UPDATES|sample-patch-|Sample Update|"Example: /);
  const fetcher = source.slice(source.indexOf("export async function getPatchUpdates("));
  assert.match(fetcher, /\n  return \[\];\n}\s*$/);

  // The public card says so in one neutral line and renders no rows.
  const card = read("../../components/shared/unified-server-stats-card.tsx");
  assert.match(card, /\{patches\.length === 0 && <p className="text-sm text-muted">No updates posted yet\.<\/p>\}/);
  assert.doesNotMatch(card, /Sample Update|Example: /);
});

test("the admin editor's preview patch notes are plainly samples", () => {
  // The editor is the only place sample notes remain: an admin preview with
  // nothing to show yet. Every line has to say it is an example.
  const editor = read("../../components/admin/play-page-editor.tsx");
  const fallback = editor.slice(editor.indexOf("const FALLBACK_PATCHES"), editor.indexOf("const FALLBACK_FAQS"));
  assert.equal((fallback.match(/\bid: "sample-patch-\d+"/g) ?? []).length, 3);
  assert.equal((fallback.match(/version: "Sample Update \d+"/g) ?? []).length, 3);
  assert.equal((fallback.match(/author: "Mazora Team"/g) ?? []).length, 3);
  const lines = [
    ...[...fallback.matchAll(/^\s*"([^"]+)",?$/gm)].map((match) => match[1]),
    ...[...fallback.matchAll(/changes: \["([^"]+)"\]/g)].map((match) => match[1]),
  ];
  assert.ok(lines.length >= 9, `expected the fallback change lines, found ${lines.length}`);
  for (const line of lines) {
    assert.match(line, /^Example: /, line);
  }
  // The "one per line" placeholder is example text too.
  const placeholder = editor.match(/placeholder="(- [^"]+)"/)?.[1] ?? "";
  for (const line of placeholder.split("&#10;")) assert.match(line, /^- Example: /, line);
});

test("the image fields in the admin editors offer only what the save accepts", () => {
  // Both saves take a site path or an https link of at most 500 characters. A
  // file read in the browser becomes a data: URL, which can never pass.
  for (const path of ["../../components/admin/store-welcome-editor.tsx", "../../components/admin/site-settings-editor.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /readAsDataURL|new FileReader|type="file"/, path);
  }
  assert.doesNotMatch(read("../../components/admin/store-welcome-editor.tsx"), /placeholder="[^"]*(base64|http URL)/);
  for (const path of ["../actions/store-settings.ts", "../actions/site-settings.ts"]) {
    assert.match(read(path), /\.max\(500, "Image URL must be under 500 characters\."\)\s*\.refine\(isSafeLink,/, path);
  }
});

/* ---- CI ------------------------------------------------------------------- */

test("every third-party action in the workflows is pinned to a full commit", () => {
  const dir = join(REPO_ROOT, ".github", "workflows");
  const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(files.length > 0, "expected workflow files");

  let pinned = 0;
  for (const name of files) {
    for (const line of readFileSync(join(dir, name), "utf8").split("\n")) {
      const uses = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/);
      if (!uses) continue;
      // An action in this repository (./path) is covered by the checkout itself.
      if (uses[1].startsWith("./")) continue;
      assert.match(uses[1], /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${name}: pin ${uses[1]} to a commit`);
      assert.match(uses[2], /^\s*# v\d+\.\d+\.\d+\s*$/, `${name}: say which version ${uses[1]} is`);
      pinned += 1;
    }
  }
  assert.ok(pinned >= 2, `expected the pinned actions in ci.yml, found ${pinned}`);
});
