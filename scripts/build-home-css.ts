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

async function extractStyleCandidates(files: string[]): Promise<string> {
  const candidates = new Set(["html", "body", "main", "section", "header", "footer", "nav", "a", "button", "img"]);

  for (const file of files) {
    const sourceText = await fs.readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const preserveAllStrings = file.endsWith(`${path.sep}accent.ts`);

    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        candidates.add(node.tagName.getText(sourceFile).split(".").pop()!.toLowerCase());
      }

      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile);
        candidates.add(name);
        if ((name === "className" || name === "height") && node.initializer) {
          collectLiteralTokens(node.initializer, candidates);
        }
      }

      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(sourceFile);
        if (/^(?:cn|clsx|classNames)$/.test(callee) || callee.includes("classList.")) {
          node.arguments.forEach((argument) => collectLiteralTokens(argument, candidates));
        }
      }

      if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
        const name = node.name.getText(sourceFile);
        if (/(?:class|style)/i.test(name)) collectLiteralTokens(node, candidates);
      }

      if (preserveAllStrings && ts.isStringLiteralLike(node)) collectLiteralTokens(node, candidates);
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
      defaultExtractor: (source) => source.match(/[A-Za-z0-9-_:/.[\]%]+/g) ?? [],
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
