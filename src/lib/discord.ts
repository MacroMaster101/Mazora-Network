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
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
  /*
    Seconds to cache a GET for. Everything here defaults to no-store because
    most of these calls are writes, and a cached write is nonsense — but a
    read that renders a public page should not put Discord's REST API on the
    critical path of every request. Opt in per call site.
  */
  revalidateSeconds?: number,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const cacheOptions =
    method === "GET" && revalidateSeconds !== undefined
      ? { next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" as const };

  const response = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bot ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...cacheOptions,
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

/**
 * Every role permitted to action store orders, from a comma-separated list.
 *
 * A single id still works — the list exists because a server usually has more
 * than one rank that should be able to run the shop. Owners and management
 * could previously see the order buttons (their roles can read the staff
 * channel) but every click was refused, because authorisation only ever matched
 * one id. Administrator is deliberately NOT treated as a pass: on most servers
 * several bot roles carry it.
 */
export function getStoreStaffRoleIds(): string[] {
  const raw = process.env.DISCORD_STORE_STAFF_ROLE_ID?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter((id) => /^\d{17,20}$/.test(id)))];
}

/**
 * The primary staff role: the first configured id.
 *
 * Used where exactly one role makes sense — the @mention on a new order. Extra
 * roles gain access and permission without also being pinged on every order.
 */
export function getStoreStaffRoleId(): string | null {
  return getStoreStaffRoleIds()[0] ?? null;
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

/**
 * Membership check that also returns who the member is.
 *
 * Same single request `isGuildMember` makes — that one discards the body and
 * answers only yes/no/unknown. Callers that need to address the person by name
 * would otherwise have to make a second identical call, or fall back to a
 * generic greeting: the first staff notice sent in anger opened "Hi there"
 * because the recipient had no site account and nothing else carried a name.
 *
 * Deliberately uncached, unlike `isGuildMember`'s fast path: a display name is
 * worth re-reading, and every caller here is a deliberate one-off action.
 *
 * Returns `null` when Discord could not answer, so a transient failure stays
 * distinguishable from "not a member" (which is `{ member: null }`).
 */
export async function fetchGuildMember(
  token: string,
  guildId: string,
  userId: string,
): Promise<{ member: GuildMemberMatch | null } | null> {
  try {
    const res = await botRequest(token, `/guilds/${guildId}/members/${userId}`, undefined, "GET");
    if (res.status === 404) return { member: null };
    if (!res.ok) {
      console.error("Discord guild member fetch failed", res.status, res.json);
      return null;
    }
    const row = res.json as {
      nick?: string | null;
      user?: { id?: string; username?: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
    } | null;
    const user = row?.user;
    if (!user?.id || !user.username) return null;
    const display = row?.nick ?? user.global_name ?? null;
    return {
      member: {
        id: user.id,
        username: user.username,
        displayName: display && display !== user.username ? display : null,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
          : null,
        bot: user.bot === true,
      },
    };
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
  /** Staff roles granted access alongside the buyer. */
  staffRoleIds?: string[];
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
  // Every configured staff role, not just the primary: whoever may action an
  // order must also be able to read the ticket it belongs to.
  for (const roleId of options.staffRoleIds ?? []) {
    overwrites.push({ id: roleId, type: 0, allow: TICKET_MEMBER_PERMISSIONS, deny: "0" });
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

/** Permanently deletes a ticket channel after its transcript is archived. */
export async function deleteChannel(token: string, channelId: string): Promise<boolean> {
  const res = await botRequest(token, `/channels/${channelId}`, undefined, "DELETE");
  if (!res.ok) console.error("Discord channel deletion failed", res.status, res.json);
  return res.ok;
}

/** Channel receiving a transcript when an order ticket is closed. Optional. */
export function getTicketLogsChannelId(): string | null {
  const id = process.env.DISCORD_TICKET_LOGS_CHANNEL_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

/** Public channel where completed purchases are announced. Optional. */
export function getBuyersChannelId(): string | null {
  const id = process.env.DISCORD_BUYERS_CHANNEL_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

/**
 * Banner shown on purchase announcements.
 *
 * Served from the site's own assets rather than a configured URL: the artwork
 * ships with the repo, so there is nothing to set up and nothing to break when
 * an external host expires. Discord fetches it over HTTP, which means it only
 * resolves once the site is deployed — but the announcement is triggered by a
 * Discord button, and those never reach a localhost dev server either, so the
 * whole flow is deployed-only regardless.
 */
export function getPurchaseBannerUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!base) return null;
  try {
    const url = new URL("/images/mazora-purchase.webp", base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/*
  closedChannelName / reopenedChannelName / renameChannel /
  setTicketMemberAccess were removed: they belonged to a ticket rename+reopen
  flow that was superseded by the archival flow the interactions route uses.
  None of them had a caller anywhere in the codebase.
*/

/** A single channel, used to read a ticket's current name. */
export async function fetchChannel(
  token: string,
  channelId: string,
): Promise<{ id: string; name: string } | null> {
  const res = await botRequest(token, `/channels/${channelId}`, undefined, "GET");
  const data = res.json as { id?: string; name?: string } | null;
  if (!res.ok || !data?.id || !data.name) {
    console.error("Discord channel fetch failed", res.status, res.json);
    return null;
  }
  return { id: data.id, name: data.name };
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

export interface GuildMemberMatch {
  /** Discord user id (snowflake). */
  id: string;
  /** Discord username, e.g. "kavisha". */
  username: string;
  /** Server nickname, or the global display name, when either differs. */
  displayName: string | null;
  avatarUrl: string | null;
  bot: boolean;
}

/**
 * Search the guild's members by username or nickname.
 *
 * Discord's search is a PREFIX match on username or nickname — "kav" finds
 * "kavisha", "visha" does not. That is the endpoint's behaviour, not a
 * limitation of this wrapper, and the UI says so.
 *
 * This deliberately uses the search endpoint rather than listing members:
 * "Search Guild Members" works with a plain bot token, whereas "List Guild
 * Members" requires the GUILD_MEMBERS privileged intent, which this
 * application does not hold and should not need for a lookup.
 *
 * Bots are returned but flagged, so callers can refuse to DM them — a DM to a
 * bot always fails, and failing early gives a better message than Discord's.
 */
export async function searchGuildMembers(
  token: string,
  guildId: string,
  query: string,
  limit = 10,
): Promise<GuildMemberMatch[] | null> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    query: trimmed,
    limit: String(Math.min(Math.max(limit, 1), 25)),
  });
  const res = await botRequest(
    token,
    `/guilds/${guildId}/members/search?${params}`,
    undefined,
    "GET",
  );
  if (!res.ok) {
    console.error("Discord member search failed", res.status, res.json);
    return null;
  }

  const rows = (res.json ?? []) as {
    nick?: string | null;
    user?: { id?: string; username?: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  }[];
  if (!Array.isArray(rows)) return null;

  return rows.flatMap((row) => {
    const user = row.user;
    if (!user?.id || !user.username) return [];
    const display = row.nick ?? user.global_name ?? null;
    return [
      {
        id: user.id,
        username: user.username,
        displayName: display && display !== user.username ? display : null,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
          : null,
        bot: user.bot === true,
      },
    ];
  });
}

/** Guild roles used to turn Discord role ids on an announcement into a public label. */
export async function fetchGuildRoles(
  token: string,
  guildId: string,
  revalidateSeconds?: number,
): Promise<DiscordRole[] | null> {
  try {
    const res = await botRequest(token, "/guilds/" + guildId + "/roles", undefined, "GET", revalidateSeconds);
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
  /** Page renders should pass a window; incremental cursor reads must not. */
  revalidateSeconds?: number,
): Promise<DiscordMessage[] | null> {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) });
  if (afterId) params.set("after", afterId);
  try {
    const res = await botRequest(token, `/channels/${channelId}/messages?${params}`, undefined, "GET", revalidateSeconds);
    if (!res.ok || !Array.isArray(res.json)) return null;
    return res.json as DiscordMessage[];
  } catch {
    return null;
  }
}

/**
 * A channel's whole history, oldest first.
 *
 * Discord returns at most 100 messages newest-first, so this walks backwards
 * with `before` until the channel runs out. `maxMessages` is a stop so a
 * pathologically long ticket cannot spin the request forever — the transcript
 * says when it was truncated rather than silently losing the start.
 */
export async function fetchAllChannelMessages(
  token: string,
  channelId: string,
  maxMessages = 1000,
): Promise<{ messages: DiscordMessage[]; truncated: boolean } | null> {
  const collected: DiscordMessage[] = [];
  let before: string | undefined;

  try {
    while (collected.length < maxMessages) {
      const params = new URLSearchParams({ limit: "100" });
      if (before) params.set("before", before);

      const res = await botRequest(token, `/channels/${channelId}/messages?${params}`, undefined, "GET");
      if (!res.ok || !Array.isArray(res.json)) return null;

      const batch = res.json as DiscordMessage[];
      if (batch.length === 0) break;

      collected.push(...batch);
      before = batch[batch.length - 1]?.id;
      if (batch.length < 100) break;
    }
  } catch (error) {
    console.error("Discord history fetch failed", error);
    return null;
  }

  const truncated = collected.length >= maxMessages;
  // Newest-first from the API; a transcript reads oldest-first.
  return { messages: collected.slice(0, maxMessages).reverse(), truncated };
}

/**
 * Posts a message with a file attached.
 *
 * Needs multipart rather than the JSON helper: Discord takes the message body
 * as a `payload_json` part alongside the file itself. The Content-Type header
 * is deliberately not set — fetch has to generate the multipart boundary.
 */
export async function postChannelMessageWithFile(
  token: string,
  channelId: string,
  payload: Record<string, unknown>,
  file: { name: string; contents: string; type?: string },
): Promise<boolean> {
  try {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append(
      "files[0]",
      new Blob([file.contents], { type: file.type ?? "text/plain; charset=utf-8" }),
      file.name,
    );

    const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.error(
        "Discord file message failed",
        response.status,
        await response.text().catch(() => ""),
      );
    }
    return response.ok;
  } catch (error) {
    console.error("Discord file message failed", error);
    return false;
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
