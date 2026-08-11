"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDiscordIdentity, getSessionUserId } from "@/lib/auth";
import { getGameModes, getProducts } from "@/lib/data/content";
import { getStoreCategoryConfigs } from "@/lib/data/store-categories";
import { getDb, schema } from "@/lib/db/client";
import {
  getDiscordBotConfig,
  getDiscordBotToken,
  getDiscordGuildId,
  getDiscordInviteUrl,
  getStoreStaffRoleId,
  isGuildMember,
  sendBotChannelMessage,
} from "@/lib/discord";
import { throttleAuthAction } from "@/lib/rate-limit";
import { usd } from "@/lib/utils";

export interface StoreRequestResult {
  ok: boolean;
  message?: string;
  reference?: string;
  errors?: Record<string, string>;
}

const contactSchema = z.object({
  minecraftUsername: z
    .string()
    .trim()
    .min(3, "Enter your Minecraft username.")
    .max(16, "Minecraft usernames are at most 16 characters.")
    .regex(/^[A-Za-z0-9_]+$/, "Use only letters, numbers and underscores."),
  notes: z.string().trim().max(500, "Keep notes under 500 characters.").optional(),
  agreement: z.literal("yes", { errorMap: () => ({ message: "Confirm that this is a manual order request." }) }),
  website: z.string().max(0),
});

const itemsSchema = z
  .array(
    z.object({
      slug: z.string().min(1).max(100),
      qty: z.number().int().min(1).max(20),
    }),
  )
  .min(1, "Your cart is empty.")
  .max(20, "Your cart contains too many different products.");

/** Neutralises Discord markdown so player-supplied text cannot restyle the embed. */
function escapeMarkdown(value: string): string {
  return value.replace(/[\\*_~`|>]/g, (match) => `\\${match}`);
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function getWebhookUrl(): string | null {
  const raw = process.env.DISCORD_STORE_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const allowedHost = url.hostname === "discord.com" || url.hostname.endsWith(".discord.com");
    if (url.protocol !== "https:" || !allowedHost || !url.pathname.startsWith("/api/webhooks/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function submitStoreRequest(
  _previous: StoreRequestResult,
  formData: FormData,
): Promise<StoreRequestResult> {
  const contact = contactSchema.safeParse({
    minecraftUsername: formData.get("minecraftUsername"),
    notes: formData.get("notes") || undefined,
    agreement: formData.get("agreement"),
    website: formData.get("website") || "",
  });

  if (!contact.success) return { ok: false, errors: fieldErrors(contact.error) };

  // The Discord identity is read from the signed-in session, never from the
  // submitted form: a crafted request must not be able to attach someone
  // else's Discord account (and therefore DM target) to an order.
  const discord = await getDiscordIdentity();
  if (!discord?.id) {
    return { ok: false, errors: { discordId: "Connect your Discord account to place the order." } };
  }

  // Throttle BEFORE the guild lookup below: that call goes out to Discord's API,
  // so checking quota afterwards would let a caller burn Discord rate limit
  // without ever touching ours. Bucketed on the Discord id as well as the
  // address, so players behind one shared connection do not consume each
  // other's checkout budget.
  const throttled = await throttleAuthAction("store-request", {
    limit: 5,
    windowMs: 10 * 60_000,
    identity: discord.id,
  });
  if (throttled) {
    return { ok: false, message: "Too many order requests were sent. Please wait a few minutes and try again." };
  }

  // Being signed in with Discord is not the same as being in the Mazora server.
  // Confirmed orders open a private ticket channel and send a DM, and neither
  // works for a non-member, so the join is required up front instead of the
  // order silently stalling after staff confirms it. A lookup failure (null)
  // is allowed through: a Discord outage must not close the store.
  const botToken = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  if (botToken && guildId && (await isGuildMember(botToken, guildId, discord.id)) === false) {
    return {
      ok: false,
      errors: {
        discordId: `Join the Mazora Discord server first — staff deliver this order in a private ticket there. ${getDiscordInviteUrl()}`,
      },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "Your cart could not be read. Refresh the page and try again." };
  }

  const submittedItems = itemsSchema.safeParse(rawItems);
  if (!submittedItems.success) {
    return { ok: false, message: submittedItems.error.issues[0]?.message ?? "Your cart is invalid." };
  }

  const botConfig = getDiscordBotConfig();
  const webhookUrl = getWebhookUrl();
  if (!botConfig && !webhookUrl) {
    return { ok: false, message: "Discord order requests are not configured yet. Please contact Mazora staff." };
  }

  const [products, modes] = await Promise.all([getProducts(), getGameModes()]);
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const orderItems = [];

  for (const submitted of submittedItems.data) {
    const product = productBySlug.get(submitted.slug);
    if (!product) return { ok: false, message: "One of the products in your cart is no longer available." };
    const modeSlug = product.gameModeSlug ?? "survival-smp";
    const mode = modes.find((item) => item.slug === modeSlug);
    const category = categoryConfigs.find(
      (item) => item.gameModeSlug === modeSlug && item.key === product.category && item.enabled,
    );
    const subcategoryKey = product.subcategory ?? product.billing;
    const subcategoryAvailable = !category?.useSubcategories
      || Boolean(subcategoryKey && category.subcategories.some((item) => item.key === subcategoryKey && item.enabled));
    if (!mode || mode.storeStatus !== "live" || !category || !subcategoryAvailable) {
      return { ok: false, message: "One of the products in your cart is not currently available." };
    }
    const price = product.salePrice ?? product.price;
    orderItems.push({
      productId: product.id,
      name: product.name,
      quantity: submitted.qty,
      price,
      lineTotal: price * submitted.qty,
    });
  }

  const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const reference = `MZ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  // Only the primary role is pinged. The variable may list several roles that
  // are allowed to action orders; @mentioning all of them on every request
  // would turn a permission grant into a notification storm.
  const staffRoleId = getStoreStaffRoleId();
  const mention = staffRoleId ? `<@&${staffRoleId}>` : undefined;
  const itemLines = orderItems
    .map((item) => `**${item.quantity}× ${item.name}** — ${usd(item.lineTotal)} (${usd(item.price)} each)`)
    .join("\n")
    .slice(0, 1024);
  // The ID comes from the session's Discord OAuth identity, so the mention is
  // always verified. It renders as a clickable mention without pinging anyone.
  const discordValue = `@${escapeMarkdown(discord.username)} · <@${discord.id}> ✓ verified`;

  const embed = {
    title: `New manual order · ${reference}`,
    description: "No payment has been collected. Contact the player on Discord, arrange payment manually, then fulfil the items in-game.",
    color: 0x9b5cff,
    fields: [
      { name: "Minecraft username", value: escapeMarkdown(contact.data.minecraftUsername), inline: true },
      { name: "Order total", value: usd(total), inline: true },
      { name: "Discord", value: discordValue },
      { name: "Items", value: itemLines },
      { name: "Player notes", value: escapeMarkdown(contact.data.notes || "None") },
    ],
    footer: { text: "Manual store request · Payment pending" },
    timestamp: new Date().toISOString(),
  };

  const basePayload = {
    content: mention,
    allowed_mentions: staffRoleId ? { roles: [staffRoleId] } : { parse: [] },
    embeds: [embed],
  };

  // Orders get Confirm/Reject buttons when the bot is configured: staff
  // decisions are DM'd to the player automatically by the interactions
  // endpoint. Every order carries a verified Discord ID.
  const components =
    botConfig
      ? [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "Confirm order",
                // The DM target is the verified session Discord ID, never a
                // client-supplied value, so staff decisions reach the real buyer.
                custom_id: `mzo:confirm:${discord.id}:${reference}`,
              },
              {
                type: 2,
                style: 4,
                label: "Reject",
                custom_id: `mzo:reject:${discord.id}:${reference}`,
              },
            ],
          },
        ]
      : undefined;

  let delivered = false;
  if (botConfig) {
    delivered = await sendBotChannelMessage(botConfig, { ...basePayload, components }).catch(() => false);
  }
  if (!delivered && webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, username: "Mazora Store" }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      delivered = response.ok;
      if (!response.ok) throw new Error(`Discord returned ${response.status}`);
    } catch (error) {
      console.error("Failed to send store request to Discord", error);
    }
  }

  if (!delivered) {
    return { ok: false, message: "Discord could not receive your request. Nothing was charged; please try again shortly." };
  }

  // Recorded only after Discord accepted it, so the buyer never sees an order
  // in their history that staff were never told about. The write is best-effort
  // on purpose: the request HAS reached staff at this point, and failing the
  // whole submission over a database hiccup would send the buyer back to
  // re-order something that is already in the staff channel.
  await persistOrder({
    reference,
    total,
    minecraftUsername: contact.data.minecraftUsername,
    notes: contact.data.notes,
    discordId: discord.id,
    discordUsername: discord.username,
    items: orderItems,
  });

  return {
    ok: true,
    reference,
    message: "Your request is with the Mazora team. A staff member will contact you using your preferred method.",
  };
}

interface PersistOrderInput {
  reference: string;
  total: number;
  minecraftUsername: string;
  notes?: string;
  discordId: string;
  discordUsername: string;
  items: { productId?: string; name: string; quantity: number; price: number }[];
}

async function persistOrder(input: PersistOrderInput): Promise<void> {
  try {
    const db = getDb();
    const userId = await getSessionUserId();
    if (!db || !userId) return;

    await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(schema.orders)
        .values({
          userId,
          reference: input.reference,
          totalAmount: input.total.toFixed(2),
          status: "pending",
          minecraftUsername: input.minecraftUsername,
          discordId: input.discordId,
          discordUsername: input.discordUsername,
          notes: input.notes || null,
        })
        .returning({ id: schema.orders.id });

      if (!order) throw new Error("Order insert returned no row.");

      await tx.insert(schema.orderItems).values(
        input.items.map((item) => ({
          orderId: order.id,
          // A product deleted later nulls this column but keeps the line item,
          // so the name snapshot is what history actually renders.
          productId: item.productId ?? null,
          productName: item.name,
          quantity: item.quantity,
          price: item.price.toFixed(2),
        })),
      );
    });
  } catch (error) {
    console.error("Failed to record store order", error);
  }
}
