import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { PurgeCSS } from "purgecss";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const homeEntryFiles = [
  "src/app/layout.tsx",
  "src/app/providers.tsx",
  "src/app/(home)/layout.tsx",
  "src/app/(home)/page.tsx",
];
const overlayEntryFiles = [
  "src/components/auth/auth-dialog-content.tsx",
  "src/components/shared/cart-drawer.tsx",
];

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
// Dynamic imports are intentionally a chunk boundary: their CSS is generated
// into overlays.generated.css and must not leak back into the initial home CSS.
const importPattern = /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;

async function resolveSourceImport(fromFile: string, specifier: string): Promise<string | null> {
  if (!(specifier.startsWith("@/") || specifier.startsWith("."))) return null;

  const unresolved = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);

  const candidates = [
    ...sourceExtensions.map((extension) => `${unresolved}${extension}`),
    ...sourceExtensions.map((extension) => path.join(unresolved, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next supported source extension.
    }
  }
  return null;
}

async function collectSources(entries: string[]): Promise<string[]> {
  const pending = entries.map((file) => path.join(projectRoot, file));
  const visited = new Set<string>();

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = await fs.readFile(file, "utf8");
    importPattern.lastIndex = 0;
    for (const match of source.matchAll(importPattern)) {
      const dependency = await resolveSourceImport(file, match[1]);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return [...visited];
}

function collectLiteralTokens(node: ts.Node, candidates: Set<string>) {
  if (ts.isStringLiteralLike(node)) {
    for (const token of node.text.split(/\s+/)) if (token) candidates.add(token);
  }
  node.forEachChild((child) => collectLiteralTokens(child, candidates));
}

/*
  Every string literal in the graph is a candidate, not just the ones sitting in
  a className. Narrowing this to className/cn() is what silently deleted
  [data-reveal="in"], the :root[data-theme="dark"] theme layer and
  .scroll-header[data-away="true"]: PurgeCSS only keeps an attribute selector
  when BOTH the attribute name and its value appear in the candidate text, and
  those values live in ternaries, setAttribute calls and inline scripts rather
  than in a class string. Keeping the walk (instead of feeding raw file text)
  is still worth it — it drops prose, comments and identifiers — but the filter
  now has to be "is this a string in a file the home page loads", nothing finer.
*/
async function extractStyleCandidates(files: string[]): Promise<string> {
  const candidates = new Set(["html", "body", "main", "section", "header", "footer", "nav", "a", "button", "img"]);

  for (const file of files) {
    const sourceText = await fs.readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        candidates.add(node.tagName.getText(sourceFile).split(".").pop()!.toLowerCase());
      }

      if (ts.isJsxAttribute(node)) candidates.add(node.name.getText(sourceFile));

      if (ts.isStringLiteralLike(node)) collectLiteralTokens(node, candidates);

      // Template literals compose classes from fragments; the raw text keeps
      // both halves of `${base}-suffix` in play.
      if (ts.isTemplateExpression(node)) {
        for (const token of node.getText(sourceFile).split(/\s+/)) if (token) candidates.add(token);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return [...candidates].join(" ");
}

async function buildHomeCss() {
  const inputPath = path.join(sourceRoot, "styles", "globals.css");
  const input = await fs.readFile(inputPath, "utf8");
  const compiled = await postcss([tailwindcss(), autoprefixer()]).process(input, {
    from: inputPath,
  });
  const fullBytes = Buffer.byteLength(compiled.css);

  async function generate(name: string, entries: string[]) {
    const sourceFiles = await collectSources(entries);
    const extractedContent = await extractStyleCandidates(sourceFiles);
    const [purged] = await new PurgeCSS().purge({
      content: [{ raw: extractedContent, extension: "html" }],
      css: [{ raw: compiled.css }],
      /*
        PurgeCSS's own default token pattern. The narrower [A-Za-z0-9-_:/.[]%]+
        set this replaces had no `(`, `,` or `#`, so every arbitrary-value
        utility was truncated at the first paren and then purged — including
        the hero's lg:grid-cols-[minmax(0,1fr)_minmax(280px,390px)_minmax(0,1fr)],
        which is why the three hero panels stacked instead of sitting in a row.
      */
      defaultExtractor: (source) => source.match(/[^<>"'`\s]*[^<>"'`\s:]/g) ?? [],
      safelist: {
        standard: ["dark", "light", "is-active", "is-open", "is-closing"],
      },
      variables: false,
      keyframes: false,
      fontFace: true,
    });
    const outputPath = path.join(sourceRoot, "styles", `${name}.generated.css`);
    const banner = "/* Generated by scripts/build-home-css.ts. Do not edit directly. */\n";
    await fs.writeFile(outputPath, `${banner}${purged.css}\n`, "utf8");
    const bytes = Buffer.byteLength(purged.css);
    console.log(`${name} CSS (${sourceFiles.length} source files): ${fullBytes} -> ${bytes} bytes (${Math.round((1 - bytes / fullBytes) * 100)}% removed)`);
  }

  await Promise.all([
    generate("home", homeEntryFiles),
    generate("overlays", overlayEntryFiles),
  ]);
}

buildHomeCss().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
