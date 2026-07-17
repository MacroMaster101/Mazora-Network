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
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(body),
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
