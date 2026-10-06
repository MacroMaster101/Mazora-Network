import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Run real server modules with isolated environment, clock and external services. */
export function loadServerModule<T>(file: URL, options: {
  env?: Record<string, string>;
  mocks?: Record<string, unknown>;
  globals?: Record<string, unknown>;
} = {}): T {
  const exports = {};
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require: (name: string) => name === "server-only" ? {} : options.mocks?.[name] ?? require(name),
    process: { env: options.env ?? {} },
    URL, Headers, Request, Response, AbortSignal, Buffer,
    console: { error() {}, warn() {}, log() {} },
    ...options.globals,
  });
  return exports as T;
}

/** Minimal atomic Redis model with a controllable TTL clock, no network. */
export function fakeRedis(now: () => number) {
  const values = new Map<string, { value: string; expires: number }>();
  const commands: Array<Array<string | number>> = [];
  const command = async (args: Array<string | number>): Promise<unknown> => {
    commands.push(args);
    const key = String(args[0] === "EVAL" ? args[3] : args[1]);
    const stored = values.get(key);
    if (stored && stored.expires <= now()) values.delete(key);
    if (args[0] === "SET") {
      if (args.includes("NX") && values.has(key)) return null;
      const ttl = Number(args[args.indexOf("PX") + 1]);
      values.set(key, { value: String(args[2]), expires: now() + ttl });
      return "OK";
    }
    if (args[0] === "EVAL") {
      if (values.get(key)?.value !== args[4]) return 0;
      values.delete(key);
      return 1;
    }
    throw new Error("Unexpected fake Redis command");
  };
  return { values, commands, command };
}
