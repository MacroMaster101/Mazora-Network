/**
 * Classification of the bot's environment configuration.
 *
 * Pure and value-free: this module never reads process.env and never holds a
 * secret. Callers pass the raw string in and receive a verdict, which is what
 * makes it safe to unit-test and safe to reason about — the console can report
 * on DISCORD_BOT_TOKEN without the token entering any module the client bundles.
 *
 * "malformed" is distinct from "unset" on purpose. A truncated channel id fails
 * exactly like an absent one at runtime, but the fix is different, and the old
 * behaviour gave the operator no way to tell them apart.
 */

export type BotVarStatus = "set" | "unset" | "malformed";
export type BotVarKind = "snowflake" | "snowflake-list" | "hex64" | "url" | "text";

const SNOWFLAKE = /^\d{17,20}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;

export function classifyBotVar(kind: BotVarKind, raw: string | undefined): BotVarStatus {
  const value = raw?.trim() ?? "";
  if (!value) return "unset";

  switch (kind) {
    case "snowflake":
      return SNOWFLAKE.test(value) ? "set" : "malformed";
    case "snowflake-list": {
      const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0) return "unset";
      return parts.every((part) => SNOWFLAKE.test(part)) ? "set" : "malformed";
    }
    case "hex64":
      return HEX64.test(value) ? "set" : "malformed";
    case "url":
      try {
        new URL(value);
        return "set";
      } catch {
        return "malformed";
      }
    case "text":
      return "set";
  }
}
