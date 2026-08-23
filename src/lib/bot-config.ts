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

export interface BotVarSpec {
  name: string;
  kind: BotVarKind;
  label: string;
  /** What degrades when this is unset. Sourced from the runtime's own fallbacks. */
  impact: string;
}

export const BOT_VAR_SPECS: readonly BotVarSpec[] = [
  {
    name: "DISCORD_BOT_TOKEN",
    kind: "text",
    label: "Bot token",
    impact: "Without it the bot cannot post, DM, or read channels. Store orders fall back to webhook delivery with no Confirm/Reject buttons.",
  },
  {
    name: "DISCORD_APP_PUBLIC_KEY",
    kind: "hex64",
    label: "App public key",
    impact: "Button clicks and slash commands cannot be verified, so the interactions endpoint refuses every request.",
  },
  {
    name: "DISCORD_GUILD_ID",
    kind: "snowflake",
    label: "Guild id",
    impact: "Membership checks at checkout are skipped and order ticket channels cannot be created.",
  },
  {
    name: "DISCORD_ORDERS_CHANNEL_ID",
    kind: "snowflake",
    label: "Orders channel",
    impact: "New store orders are not posted for staff to action.",
  },
  {
    name: "DISCORD_STORE_WEBHOOK_URL",
    kind: "url",
    label: "Store webhook (fallback)",
    impact: "No fallback delivery if the bot path is unavailable.",
  },
  {
    name: "DISCORD_STORE_STAFF_ROLE_ID",
    kind: "snowflake-list",
    label: "Store staff role(s)",
    impact: "Order actions are refused outright — a valid Discord signature alone can never action an order.",
  },
  {
    name: "DISCORD_STORE_TICKETS_CATEGORY_ID",
    kind: "snowflake",
    label: "Ticket category",
    impact: "Confirmed orders fall back to a DM-only flow with no private ticket channel.",
  },
  {
    name: "DISCORD_TICKET_LOGS_CHANNEL_ID",
    kind: "snowflake",
    label: "Ticket logs channel",
    impact: "Closed ticket transcripts are not archived.",
  },
  {
    name: "DISCORD_BUYERS_CHANNEL_ID",
    kind: "snowflake",
    label: "Buyers channel",
    impact: "Completed purchases are not announced publicly.",
  },
  {
    name: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID",
    kind: "snowflake",
    label: "Announcements channel",
    impact: "The daily news sync has nothing to import from.",
  },
  {
    name: "DISCORD_PATCH_CHANNEL_ID",
    kind: "snowflake",
    label: "Patch notes channel",
    impact: "The Play page editor cannot pull patch notes.",
  },
  {
    name: "DISCORD_STAFF_NOTICE_ROLE_ID",
    kind: "snowflake-list",
    label: "Staff notice role(s)",
    impact: "The /staff-notice slash command refuses to run. The admin page is unaffected.",
  },
  {
    name: "DISCORD_APPLICATION_ID",
    kind: "snowflake",
    label: "Application id",
    // Ops-time rather than runtime: nothing the site serves reads it. Listed
    // anyway because without it there is no way to register the slash command,
    // and its absence is otherwise invisible until the script fails.
    impact: "`npm run discord:commands` cannot register the slash commands. Nothing the site serves is affected.",
  },
] as const;
