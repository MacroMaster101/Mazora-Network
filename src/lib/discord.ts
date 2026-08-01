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
  method: "GET" | "POST" | "PATCH" = "POST",
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

/**
 * Private category the bot creates one ticket channel per confirmed order in.
 * When unset, confirmations fall back to the DM-only flow.
 */
export function getStoreTicketsCategoryId(): string | null {
  const id = process.env.DISCORD_STORE_TICKETS_CATEGORY_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

export function getStoreStaffRoleId(): string | null {
  const id = process.env.DISCORD_STORE_STAFF_ROLE_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

/** Public invite shown to buyers who have not joined the server yet. */
export function getDiscordInviteUrl(): string {
  return process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() || "https://discord.gg/ZPrzyGpMyt";
}

/** Deep link to a channel, used to send buyers straight into their order ticket. */
export function channelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

/**
 * Short-lived positive cache for membership lookups.
 *
 * Only "yes" is cached, and only for a couple of minutes: a buyer who just
 * joined must not be told to join again, but someone who leaves or is banned
 * has to lose access quickly. Membership is deliberately never remembered on
 * the account — a stale "they joined once" flag would let an order be confirmed
 * for someone who is no longer reachable, which is the exact failure the check
 * exists to prevent.
 */
const memberCache = new Map<string, number>();
const MEMBER_CACHE_MS = 2 * 60 * 1000;

/**
 * Whether a Discord user is a member of the guild.
 * Returns null when Discord could not answer, so callers can tell "not joined"
 * apart from "we don't know" and avoid blocking an order on a transient error.
 */
export async function isGuildMember(
  token: string,
  guildId: string,
  userId: string,
  options?: { fresh?: boolean },
): Promise<boolean | null> {
  const cacheKey = `${guildId}:${userId}`;
  const cachedUntil = memberCache.get(cacheKey);
  // `fresh` skips the cache for decisions that actually grant something — a
  // stale "yes" there would open a ticket for someone who has already left.
  if (!options?.fresh && cachedUntil && cachedUntil > Date.now()) return true;

  try {
    const res = await botRequest(token, `/guilds/${guildId}/members/${userId}`, undefined, "GET");
    if (res.ok) {
      memberCache.set(cacheKey, Date.now() + MEMBER_CACHE_MS);
      return true;
    }
    if (res.status === 404) {
      memberCache.delete(cacheKey);
      return false;
    }
    console.error("Discord guild member lookup failed", res.status, res.json);
    return null;
  } catch {
    return null;
  }
}

// VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY | ADD_REACTIONS
const TICKET_MEMBER_PERMISSIONS = String(
  (1 << 10) | (1 << 11) | (1 << 14) | (1 << 15) | (1 << 16) | (1 << 6),
);
const VIEW_CHANNEL = String(1 << 10);

/** Discord channel names are lowercase kebab-case and capped at 100 characters. */
function ticketChannelName(reference: string, username: string): string {
  const slug = `order-${reference}-${username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (slug || "order-ticket").slice(0, 100);
}

export interface StoreTicketOptions {
  token: string;
  guildId: string;
  categoryId: string;
  reference: string;
  /** Buyer's Discord id — granted access to the new channel. */
  customerId: string;
  customerName: string;
  /** Optional staff role granted access alongside the buyer. */
  staffRoleId?: string | null;
  /** The bot's own application id, so it keeps access to a private channel. */
  botApplicationId?: string | null;
}

/**
 * Creates the private per-order ticket channel: hidden from @everyone, visible
 * to the buyer, the store-staff role and the bot. Returns null when Discord
 * refuses (missing Manage Channels, wrong category id, category full…).
 */
export async function createStoreTicketChannel(
  options: StoreTicketOptions,
): Promise<{ id: string } | null> {
  const overwrites: { id: string; type: number; allow: string; deny: string }[] = [
    // type 0 = role. The @everyone role always shares the guild's id.
    { id: options.guildId, type: 0, allow: "0", deny: VIEW_CHANNEL },
    // type 1 = member.
    { id: options.customerId, type: 1, allow: TICKET_MEMBER_PERMISSIONS, deny: "0" },
  ];
  if (options.staffRoleId) {
    overwrites.push({ id: options.staffRoleId, type: 0, allow: TICKET_MEMBER_PERMISSIONS, deny: "0" });
  }
  if (options.botApplicationId) {
    overwrites.push({ id: options.botApplicationId, type: 1, allow: TICKET_MEMBER_PERMISSIONS, deny: "0" });
  }

  const res = await botRequest(options.token, `/guilds/${options.guildId}/channels`, {
    name: ticketChannelName(options.reference, options.customerName),
    type: 0,
    parent_id: options.categoryId,
    topic: `Mazora store order ${options.reference} · buyer ${options.customerName}`.slice(0, 1024),
    permission_overwrites: overwrites,
  });

  const id = (res.json as { id?: string } | null)?.id;
  if (!res.ok || !id) {
    console.error("Discord ticket channel could not be created", res.status, res.json);
    return null;
  }
  return { id };
}

/** Posts to an arbitrary channel as the bot (ticket channels, not just orders). */
export async function postChannelMessage(
  token: string,
  channelId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const res = await botRequest(token, `/channels/${channelId}/messages`, payload);
  if (!res.ok) console.error("Discord channel message failed", res.status, res.json);
  return res.ok;
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
