import "server-only";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Server-side Discord helpers for the store order flow.
 *
 * Two delivery paths exist:
 *  - Bot (preferred): posts the order embed through the bot API so the message
 *    can carry Confirm/Reject buttons, and DMs the player on staff decisions.
 *  - Webhook (fallback): plain embed, no buttons. Used when the bot variables
 *    are not configured.
 */

const DISCORD_API = "https://discord.com/api/v10";

export interface DiscordBotConfig {
  token: string;
  ordersChannelId: string;
}

export function getDiscordBotConfig(): DiscordBotConfig | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const ordersChannelId = process.env.DISCORD_ORDERS_CHANNEL_ID?.trim();
  if (!token || !ordersChannelId || !/^\d{17,20}$/.test(ordersChannelId)) return null;
  return { token, ordersChannelId };
}

export function getDiscordAppPublicKey(): string | null {
  const key = process.env.DISCORD_APP_PUBLIC_KEY?.trim();
  return key && /^[0-9a-fA-F]{64}$/.test(key) ? key : null;
}

async function botRequest(
  token: string,
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST",
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bot ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const json = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, json };
}

/** Posts a message to a channel as the bot. Returns true when Discord accepted it. */
export async function sendBotChannelMessage(
  config: DiscordBotConfig,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const result = await botRequest(config.token, `/channels/${config.ordersChannelId}/messages`, payload);
  if (!result.ok) console.error("Discord bot channel message failed", result.status, result.json);
  return result.ok;
}

/**
 * Sends a direct message to a Discord user. Fails (returns false) when the
 * user shares no server with the bot or has DMs from server members disabled.
 */
export async function sendBotDirectMessage(
  token: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const channel = await botRequest(token, "/users/@me/channels", { recipient_id: userId });
  const channelId = (channel.json as { id?: string } | null)?.id;
  if (!channel.ok || !channelId) {
    console.error("Discord DM channel could not be opened", channel.status, channel.json);
    return false;
  }
  const message = await botRequest(token, `/channels/${channelId}/messages`, payload);
  if (!message.ok) console.error("Discord DM send failed", message.status, message.json);
  return message.ok;
}

/** Bot token on its own — news sync must not require the orders channel to be set. */
export function getDiscordBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  return token ? token : null;
}

export function getDiscordGuildId(): string | null {
  const id = process.env.DISCORD_GUILD_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

export function getAnnouncementsChannelId(): string | null {
  const id = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

export interface DiscordMessage {
  id: string;
  type: number;
  content: string;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  member?: { nick?: string | null; avatar?: string | null; roles?: string[] };
  attachments: { url: string; content_type?: string | null }[];
  timestamp: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  position: number;
}

/** Guild roles used to turn Discord role ids on an announcement into a public label. */
export async function fetchGuildRoles(token: string, guildId: string): Promise<DiscordRole[] | null> {
  try {
    const res = await botRequest(token, "/guilds/" + guildId + "/roles", undefined, "GET");
    if (!res.ok || !Array.isArray(res.json)) return null;
    return (res.json as DiscordRole[]).filter((role) => role && typeof role.id === "string");
  } catch {
    return null;
  }
}

/**
 * Newest-first channel messages. `afterId` asks Discord for messages posted
 * after that id, which is how the importer resumes. Returns null on failure so
 * callers can distinguish "error" from "nothing new".
 */
export async function fetchChannelMessages(
  token: string,
  channelId: string,
  afterId?: string,
  limit = 25,
): Promise<DiscordMessage[] | null> {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) });
  if (afterId) params.set("after", afterId);
  try {
    const res = await botRequest(token, `/channels/${channelId}/messages?${params}`, undefined, "GET");
    if (!res.ok || !Array.isArray(res.json)) return null;
    return res.json as DiscordMessage[];
  } catch {
    return null;
  }
}

// Ed25519 public keys from the Discord developer portal are raw 32-byte keys;
// node:crypto wants them wrapped in a DER SPKI envelope.
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Verifies a Discord interaction request signature (Ed25519). */
export function verifyDiscordSignature(
  publicKeyHex: string,
  timestamp: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + rawBody, "utf8"),
      key,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * A single message by id. Used to recover an announcement's original artwork:
 * the Discord CDN link stored at import time expires, but the message itself
 * persists, so the attachment can always be fetched again on demand.
 */
export async function fetchChannelMessage(
  token: string,
  channelId: string,
  messageId: string,
): Promise<DiscordMessage | null> {
  try {
    const res = await botRequest(token, `/channels/${channelId}/messages/${messageId}`, undefined, "GET");
    if (!res.ok || !res.json || typeof res.json !== "object") return null;
    return res.json as DiscordMessage;
  } catch {
    return null;
  }
}
