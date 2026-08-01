import { after, NextResponse } from "next/server";
import {
  channelUrl,
  createStoreTicketChannel,
  getDiscordAppPublicKey,
  getDiscordBotConfig,
  getDiscordGuildId,
  getDiscordInviteUrl,
  getStoreStaffRoleId,
  getStoreTicketsCategoryId,
  isGuildMember,
  postChannelMessage,
  sendBotDirectMessage,
  verifyDiscordSignature,
} from "@/lib/discord";
import { markOrderDecision } from "@/lib/data/orders";

/**
 * Discord interactions endpoint (HTTP-only bot — no gateway process).
 * Set this URL in the Discord developer portal under
 * General Information → Interactions Endpoint URL:
 *   https://<your-domain>/api/discord/interactions
 *
 * Handles the Confirm/Reject buttons on store order messages. Confirming opens
 * a private ticket channel shared by the buyer and staff, posts the order
 * summary in it and DMs the buyer a link; rejecting just DMs the buyer.
 *
 * Discord kills an interaction that is not answered within three seconds, so
 * the click is acknowledged immediately (buttons removed, status "working…")
 * and the slow Discord API calls run in `after()`, which then rewrites the
 * staff message with the real outcome.
 */

const DISCORD_API = "https://discord.com/api/v10";

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

interface Interaction {
  type: number;
  application_id?: string;
  token?: string;
  data?: { custom_id?: string; component_type?: number };
  member?: { user?: { id?: string; username?: string; global_name?: string | null }; roles?: string[] };
  user?: { id?: string; username?: string; global_name?: string | null };
  message?: { embeds?: Embed[] };
}

const MAZORA_AUTHOR = {
  name: "Mazora Network",
  icon_url: "https://mazora.us/images/mazora-logo.webp",
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Ephemeral (flags: 64) reply visible only to the clicking user. */
const ephemeral = (content: string) => json({ type: 4, data: { content, flags: 64 } });

/**
 * Whether the interacting member holds the configured store-staff role.
 *
 * Fails closed: a valid signature only proves the request came from Discord,
 * not that the person who clicked is staff. Without a configured role we cannot
 * tell the two apart, so the action is refused rather than trusting that the
 * message never left a staff-only channel — components can be actioned by
 * anyone who can see them. `member.roles` is only present for in-guild
 * interactions, so DM clicks are refused too.
 */
function staffCheck(interaction: Interaction): { allowed: boolean; reason?: string } {
  const staffRoleId = getStoreStaffRoleId();
  if (!staffRoleId) {
    console.error("DISCORD_STORE_STAFF_ROLE_ID is not configured — order actions refused.");
    return {
      allowed: false,
      reason:
        "Order actions are disabled until a staff role is configured. Ask an administrator to set DISCORD_STORE_STAFF_ROLE_ID.",
    };
  }
  const roles = interaction.member?.roles;
  if (!Array.isArray(roles) || !roles.includes(staffRoleId)) {
    return { allowed: false, reason: "You don't have permission to action Mazora orders." };
  }
  return { allowed: true };
}

function fieldValue(embed: Embed | undefined, name: string): string {
  return embed?.fields?.find((field) => field.name === name)?.value ?? "";
}

/** Replaces (or appends) the Status field so repeated edits don't stack up. */
function withStatus(embed: Embed | undefined, status: string, color: number, footer: string): Embed {
  const fields = (embed?.fields ?? []).filter((field) => field.name !== "Status");
  return {
    ...embed,
    color,
    fields: [...fields, { name: "Status", value: status }],
    footer: { text: footer },
  };
}

/**
 * Rewrites the staff order message once the background work is done. Uses the
 * interaction webhook (no bot token needed) and is valid for 15 minutes.
 */
async function editOriginalMessage(applicationId: string, token: string, embed: Embed): Promise<void> {
  try {
    const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components: [], allowed_mentions: { parse: [] } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Discord original message edit failed", response.status, await response.text().catch(() => ""));
    }
  } catch (error) {
    console.error("Discord original message edit failed", error);
  }
}

interface DecisionContext {
  applicationId: string;
  interactionToken: string;
  botToken: string;
  botApplicationId: string;
  actorName: string;
  customerId: string;
  reference: string;
  originalEmbed: Embed | undefined;
  items: string;
  total: string;
  minecraftUsername: string;
}

/** Confirm: open the ticket, post the order in it, DM the buyer the link. */
async function runConfirm(context: DecisionContext): Promise<void> {
  const guildId = getDiscordGuildId();
  const categoryId = getStoreTicketsCategoryId();
  const staffRoleId = getStoreStaffRoleId();
  const notes: string[] = [];

  // A buyer who never joined the server cannot be added to a ticket and cannot
  // be DM'd either (the bot shares no guild with them). The order is parked
  // rather than lost, and staff can re-confirm once they join.
  if (guildId) {
    const member = await isGuildMember(context.botToken, guildId, context.customerId, { fresh: true });
    if (member === false) {
      await markOrderDecision(context.reference, "awaiting_discord_join", context.actorName);
      await editOriginalMessage(
        context.applicationId,
        context.interactionToken,
        withStatus(
          context.originalEmbed,
          `⏳ Awaiting Discord join · confirmed by **${context.actorName}**\n` +
            `<@${context.customerId}> is not in the server yet. Ask them to join ${getDiscordInviteUrl()}, ` +
            "then confirm the order again.",
          0xfbbf24,
          "Manual store request · Awaiting Discord join",
        ),
      );
      return;
    }
    if (member === null) notes.push("⚠️ membership could not be verified");
  }

  let ticketId: string | null = null;
  if (guildId && categoryId) {
    const ticket = await createStoreTicketChannel({
      token: context.botToken,
      guildId,
      categoryId,
      reference: context.reference,
      customerId: context.customerId,
      customerName: context.minecraftUsername,
      staffRoleId,
      botApplicationId: context.botApplicationId,
    });
    ticketId = ticket?.id ?? null;
    if (!ticketId) notes.push("⚠️ ticket channel could not be created");
  } else if (!categoryId) {
    notes.push("⚠️ DISCORD_STORE_TICKETS_CATEGORY_ID not set");
  } else {
    notes.push("⚠️ DISCORD_GUILD_ID not set");
  }

  if (ticketId) {
    await postChannelMessage(context.botToken, ticketId, {
      content: `<@${context.customerId}>${staffRoleId ? ` <@&${staffRoleId}>` : ""}`,
      allowed_mentions: {
        users: [context.customerId],
        ...(staffRoleId ? { roles: [staffRoleId] } : {}),
      },
      embeds: [
        {
          author: MAZORA_AUTHOR,
          title: `🎟️ Order ticket · ${context.reference}`,
          description:
            `Hey <@${context.customerId}>, your order was confirmed by **${context.actorName}**.\n` +
            "Payment is arranged here in this private channel and the items are delivered in-game afterwards.\n\n" +
            "_Mazora staff will never ask for card details or account passwords in chat._",
          color: 0x34d399,
          fields: [
            { name: "Minecraft username", value: context.minecraftUsername || "—", inline: true },
            { name: "Order total", value: context.total || "—", inline: true },
            ...(context.items ? [{ name: "Items", value: context.items }] : []),
          ],
          footer: { text: "Mazora store · manual order" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  const link = ticketId && guildId ? channelUrl(guildId, ticketId) : null;
  const dmSent = await sendBotDirectMessage(context.botToken, context.customerId, {
    embeds: [
      {
        author: MAZORA_AUTHOR,
        title: "✅ Order Confirmed!",
        description:
          `Your Mazora Network order (\`${context.reference}\`) has just been confirmed by **${context.actorName}**.\n` +
          (link
            ? `A private ticket has been opened for you — continue there: ${link}\n\n`
            : "A staff member will reach out to you here shortly to arrange payment and finalize the delivery.\n\n") +
          (context.items ? `**Order Summary**\n${context.items}\n\n` : "") +
          (context.total ? `**Total:** ${context.total}\n` : "") +
          "_No payment has been taken yet — staff will never ask for card details in chat._",
        color: 0x34d399,
      },
    ],
  }).catch(() => false);

  if (!dmSent) notes.push("⚠️ DM failed (DMs off)");

  await markOrderDecision(context.reference, "confirmed", context.actorName, ticketId);

  const statusLines = [
    `✅ Confirmed by **${context.actorName}**`,
    ticketId ? `🎟️ Ticket: <#${ticketId}>` : null,
    dmSent ? "📬 Buyer notified by DM" : null,
    ...notes,
  ].filter(Boolean) as string[];

  await editOriginalMessage(
    context.applicationId,
    context.interactionToken,
    withStatus(
      context.originalEmbed,
      statusLines.join("\n"),
      0x34d399,
      ticketId ? "Manual store request · Ticket open" : "Manual store request · Confirmed",
    ),
  );
}

/** Reject: DM the buyer, no ticket is created. */
async function runReject(context: DecisionContext): Promise<void> {
  const dmSent = await sendBotDirectMessage(context.botToken, context.customerId, {
    embeds: [
      {
        author: MAZORA_AUTHOR,
        title: "❌ Order Declined",
        description:
          `Your Mazora Network order (\`${context.reference}\`) was reviewed and declined by **${context.actorName}**.\n` +
          "If you believe this is a mistake or have questions, please reach out in the Mazora Discord server.",
        color: 0xf87171,
      },
    ],
  }).catch(() => false);

  await markOrderDecision(context.reference, "rejected", context.actorName);

  await editOriginalMessage(
    context.applicationId,
    context.interactionToken,
    withStatus(
      context.originalEmbed,
      `❌ Declined by **${context.actorName}**${dmSent ? "\n📬 Buyer notified by DM" : "\n⚠️ DM failed (DMs off)"}`,
      0xf87171,
      "Manual store request · Rejected",
    ),
  );
}

export async function POST(request: Request) {
  const publicKey = getDiscordAppPublicKey();
  if (!publicKey) return json({ error: "interactions not configured" }, 503);

  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();
  if (!signature || !timestamp || !verifyDiscordSignature(publicKey, timestamp, rawBody, signature)) {
    return json({ error: "invalid request signature" }, 401);
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody) as Interaction;
  } catch {
    return json({ error: "invalid payload" }, 400);
  }

  // PING — Discord verifies the endpoint with this when the URL is saved.
  if (interaction.type === 1) return json({ type: 1 });

  // MESSAGE_COMPONENT — a staff member clicked a button.
  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id ?? "";
    const [prefix, action, discordUserId, reference] = customId.split(":");
    if (prefix !== "mzo" || !["confirm", "reject"].includes(action) || !/^\d{17,20}$/.test(discordUserId ?? "")) {
      return json({ type: 6 }); // unknown component: acknowledge silently
    }

    // Only staff may confirm or reject an order. This is enforced here rather
    // than relying solely on who can see the channel, so a leaked or forwarded
    // message component cannot be actioned by a non-staff user.
    const staff = staffCheck(interaction);
    if (!staff.allowed) {
      return ephemeral(staff.reason ?? "You don't have permission to action Mazora orders.");
    }

    const bot = getDiscordBotConfig();
    const actor = interaction.member?.user ?? interaction.user;
    const actorName = actor?.global_name || actor?.username || "staff";
    const confirmed = action === "confirm";
    const originalEmbed = interaction.message?.embeds?.[0];

    if (!bot || !interaction.application_id || !interaction.token) {
      // No bot credentials: record the decision on the message and stop there.
      return json({
        type: 7,
        data: {
          embeds: [
            withStatus(
              originalEmbed,
              confirmed ? `✅ Confirmed by **${actorName}**` : `❌ Declined by **${actorName}**`,
              confirmed ? 0x34d399 : 0xf87171,
              confirmed ? "Manual store request · Confirmed" : "Manual store request · Rejected",
            ),
          ],
          components: [],
          allowed_mentions: { parse: [] },
        },
      });
    }

    const context: DecisionContext = {
      applicationId: interaction.application_id,
      interactionToken: interaction.token,
      botToken: bot.token,
      botApplicationId: interaction.application_id,
      actorName,
      customerId: discordUserId!,
      reference: reference ?? "unknown",
      originalEmbed,
      items: fieldValue(originalEmbed, "Items"),
      total: fieldValue(originalEmbed, "Order total"),
      minecraftUsername: fieldValue(originalEmbed, "Minecraft username"),
    };

    // Runs after the response is flushed, so the three second budget is never
    // at risk. The buttons are already gone below, which also stops a second
    // staff member from creating a duplicate ticket while this runs.
    after(async () => {
      try {
        if (confirmed) await runConfirm(context);
        else await runReject(context);
      } catch (error) {
        console.error("Discord order decision failed", error);
        await editOriginalMessage(
          context.applicationId,
          context.interactionToken,
          withStatus(
            originalEmbed,
            `⚠️ ${confirmed ? "Confirmation" : "Rejection"} by **${actorName}** hit an error. Check the server logs.`,
            0xf87171,
            "Manual store request · Error",
          ),
        );
      }
    });

    // UPDATE_MESSAGE: drop the buttons immediately and show the interim state.
    return json({
      type: 7,
      data: {
        embeds: [
          withStatus(
            originalEmbed,
            confirmed
              ? `⏳ Confirming as **${actorName}** — opening the ticket…`
              : `⏳ Declining as **${actorName}** — notifying the buyer…`,
            0x9b5cff,
            "Manual store request · Working…",
          ),
        ],
        components: [],
        allowed_mentions: { parse: [] },
      },
    });
  }

  return json({ error: "unsupported interaction" }, 400);
}
