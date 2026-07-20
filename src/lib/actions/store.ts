"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { getDiscordIdentity } from "@/lib/auth";
import { getProducts } from "@/lib/data/content";
import { getDiscordBotConfig, sendBotChannelMessage } from "@/lib/discord";
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

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

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

async function isRateLimited(): Promise<boolean> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || requestHeaders.get("x-real-ip") || "local";
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS;
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

  if (await isRateLimited()) {
    return { ok: false, message: "Too many order requests were sent. Please wait a few minutes and try again." };
  }

  const botConfig = getDiscordBotConfig();
  const webhookUrl = getWebhookUrl();
  if (!botConfig && !webhookUrl) {
    return { ok: false, message: "Discord order requests are not configured yet. Please contact Mazora staff." };
  }

  const products = await getProducts();
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const orderItems = [];

  for (const submitted of submittedItems.data) {
    const product = productBySlug.get(submitted.slug);
    if (!product) return { ok: false, message: "One of the products in your cart is no longer available." };
    const price = product.salePrice ?? product.price;
    orderItems.push({ name: product.name, quantity: submitted.qty, price, lineTotal: price * submitted.qty });
  }

  const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const reference = `MZ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const staffRoleId = process.env.DISCORD_STORE_STAFF_ROLE_ID?.trim();
  const mention = staffRoleId && /^\d{17,20}$/.test(staffRoleId) ? `<@&${staffRoleId}>` : undefined;
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
    allowed_mentions: mention ? { roles: [staffRoleId] } : { parse: [] },
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

  return {
    ok: true,
    reference,
    message: "Your request is with the Mazora team. A staff member will contact you using your preferred method.",
  };
}
