import { after, NextResponse } from "next/server";
import {
  channelUrl,
  closedChannelName,
  createStoreTicketChannel,
  fetchChannel,
  getBuyersChannelId,
  getPurchaseBannerUrl,
  renameChannel,
  reopenedChannelName,
  setTicketMemberAccess,
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
  /** Present on component clicks — the channel the button lives in. */
  channel_id?: string;
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
async function editOriginalMessage(
  applicationId: string,
  token: string,
  embed: Embed,
  components: unknown[] = [],
): Promise<void> {
  try {
    const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components, allowed_mentions: { parse: [] } }),
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

/**
 * Staff controls for a confirmed order.
 *
 * These live on the order message in the staff-only channel, never in the
 * ticket: Discord shows components to everyone who can read the message, and
 * the buyer can read their own ticket.
 *
 * Close and Announce are deliberately separate. Closing only means the
 * conversation is finished — an order can end without a sale, and announcing
 * "X bought Y" for someone who never paid is worse than not announcing at all.
 */
function orderControls(options: {
  customerId: string;
  reference: string;
  ticketChannelId: string | null;
  closed: boolean;
  announced: boolean;
}): unknown[] {
  const buttons: unknown[] = [];

  if (options.ticketChannelId) {
    buttons.push({
      type: 2,
      style: options.closed ? 3 : 2,
      label: options.closed ? "Reopen ticket" : "Close ticket",
      emoji: { name: options.closed ? "🔓" : "🔒" },
      custom_id: `mzt:${options.closed ? "open" : "close"}:${options.customerId}:${options.reference}:${options.ticketChannelId}`,
    });
  }

  buttons.push({
    type: 2,
    style: 1,
    label: options.announced ? "Announced" : "Announce purchase",
    emoji: { name: options.announced ? "✅" : "📣" },
    // Disabled after use so a second click cannot double-post the same sale.
    disabled: options.announced,
    custom_id: `mzt:announce:${options.customerId}:${options.reference}`,
  });

  return buttons.length ? [{ type: 1, components: buttons }] : [];
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
      // No buttons here on purpose. Discord components are visible to everyone
      // who can read the message, and the buyer can read this channel — a
      // "Close ticket" button they could see but not use was confusing. Staff
      // control the ticket from the order message in the staff-only channel.
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
    orderControls({
      customerId: context.customerId,
      reference: context.reference,
      ticketChannelId: ticketId,
      closed: false,
      announced: false,
    }),
  );
}

interface TicketLifecycleContext {
  applicationId: string;
  interactionToken: string;
  botToken: string;
  channelId: string;
  customerId: string;
  reference: string;
  actorName: string;
  closing: boolean;
  originalEmbed: Embed | undefined;
}

/**
 * Announces a completed purchase in the public buyers channel.
 *
 * Fired on close rather than on confirm: confirming only means staff accepted
 * the request, while closing the ticket is the point at which the items have
 * actually been delivered. Announcing earlier would advertise orders that might
 * still fall through.
 */
async function announcePurchase(
  botToken: string,
  order: { reference: string; minecraftUsername: string; items: string; total: string; customerId: string },
): Promise<boolean> {
  const channelId = getBuyersChannelId();
  if (!channelId) return false;

  const banner = getPurchaseBannerUrl();
  const rule = "━".repeat(22);
  const date = new Date().toISOString().slice(0, 10);

  const details = [
    rule,
    "🛒 **New Purchase**",
    "",
    `👤 **Customer**: <@${order.customerId}>`,
    order.minecraftUsername ? `🎮 **Minecraft**: ${order.minecraftUsername}` : null,
    order.items ? `📦 **Items**: ${order.items}` : null,
    order.total ? `💰 **Total**: ${order.total}` : null,
    `📅 **Date**: ${date}`,
    rule,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return postChannelMessage(botToken, channelId, {
    // The buyer is named but not pinged: this is a shop-window post, and
    // notifying someone every time their purchase is shown off is noise.
    allowed_mentions: { parse: [] },
    // Two embeds so the banner sits above the details. Discord always renders
    // message content above embeds and attachments below them, so a single
    // embed would put the artwork underneath the text.
    embeds: [
      ...(banner ? [{ color: 0x9b5cff, image: { url: banner } }] : []),
      {
        color: 0x9b5cff,
        description: details,
        footer: { text: `Mazora store · ${order.reference}` },
      },
    ],
  });
}

/**
 * Closes or reopens a ticket.
 *
 * Closing locks the buyer out and renames the channel; nothing is deleted, so
 * the transcript stays readable to staff and reopening is a single click.
 */
async function runTicketLifecycle(context: TicketLifecycleContext): Promise<void> {
  const channel = await fetchChannel(context.botToken, context.channelId);
  const notes: string[] = [];

  const accessChanged = await setTicketMemberAccess(
    context.botToken,
    context.channelId,
    context.customerId,
    !context.closing,
  );
  if (!accessChanged) notes.push("⚠️ buyer access could not be changed");

  if (channel) {
    const nextName = context.closing
      ? closedChannelName(channel.name)
      : reopenedChannelName(channel.name);
    if (nextName !== channel.name) {
      // Discord rate-limits channel renames hard (twice per ten minutes), so a
      // failure here is reported rather than retried — the access change is
      // what actually secures the ticket.
      const renamed = await renameChannel(context.botToken, context.channelId, nextName);
      if (!renamed) notes.push("⚠️ channel could not be renamed (rename rate limit)");
    }
  }

  if (context.closing) {
    // Closing does NOT announce. A ticket can end without a sale — the buyer
    // changed their mind, never paid, or it was a mistake — and posting
    // "X bought Y" for someone who never bought is worse than staying quiet.
    // Announcing is its own button, pressed only when money actually changed
    // hands.
    await markOrderDecision(context.reference, "completed", context.actorName, context.channelId);

    await postChannelMessage(context.botToken, context.channelId, {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          author: MAZORA_AUTHOR,
          title: "🔒 Ticket closed",
          description:
            `Closed by **${context.actorName}**. The buyer no longer has access to this channel.\n` +
            "Staff can reopen it from the order message in the staff channel." +
            (notes.length ? `\n\n${notes.join("\n")}` : ""),
          color: 0x64748b,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } else {
    // Reopening puts the order back to confirmed: it is live again, not done.
    await markOrderDecision(context.reference, "confirmed", context.actorName, context.channelId);

    await postChannelMessage(context.botToken, context.channelId, {
      content: `<@${context.customerId}>`,
      allowed_mentions: { users: [context.customerId] },
      embeds: [
        {
          author: MAZORA_AUTHOR,
          title: "🔓 Ticket reopened",
          description:
            `Reopened by **${context.actorName}**. You have access again — reply here if anything is still outstanding.` +
            (notes.length ? `\n\n${notes.join("\n")}` : ""),
          color: 0x34d399,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Reflect the new state on the staff order message, so the record is readable
  // without opening the ticket and the buttons can tell which state they are in.
  const statusLines = [
    context.closing
      ? `🔒 Ticket closed by **${context.actorName}**`
      : `🔓 Ticket reopened by **${context.actorName}**`,
    `🎟️ Ticket: <#${context.channelId}>`,
    ...notes,
  ];

  await editOriginalMessage(
    context.applicationId,
    context.interactionToken,
    withStatus(
      context.originalEmbed,
      statusLines.join("\n"),
      context.closing ? 0x64748b : 0x34d399,
      context.closing ? "Manual store request · Ticket closed" : "Manual store request · Ticket open",
    ),
    orderControls({
      customerId: context.customerId,
      reference: context.reference,
      ticketChannelId: context.channelId,
      closed: context.closing,
      announced: false,
    }),
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
    // Ticket controls carry the ticket channel id, because they live on the
    // order message in the staff channel — interaction.channel_id would point
    // at that channel, not at the ticket being acted on.
    const [prefix, action, discordUserId, reference, ticketChannelId] = customId.split(":");

    if (prefix === "mzt" && /^\d{17,20}$/.test(discordUserId ?? "")) {
      const staff = staffCheck(interaction);
      if (!staff.allowed) {
        return ephemeral(staff.reason ?? "You don't have permission to action Mazora tickets.");
      }

      const bot = getDiscordBotConfig();
      if (!bot || !interaction.application_id || !interaction.token) {
        return ephemeral("Ticket actions are not configured on the server.");
      }

      const actor = interaction.member?.user ?? interaction.user;
      const actorName = actor?.global_name || actor?.username || "staff";
      const orderEmbed = interaction.message?.embeds?.[0];
      const alreadyClosed = /Ticket closed/i.test(fieldValue(orderEmbed, "Status"));

      // --- Announce: a separate, deliberate act ---------------------------
      if (action === "announce") {
        if (!getBuyersChannelId()) {
          return ephemeral("No buyers channel is configured, so there is nowhere to announce.");
        }

        after(async () => {
          const posted = await announcePurchase(bot.token, {
            reference: reference ?? "",
            minecraftUsername: fieldValue(orderEmbed, "Minecraft username"),
            items: fieldValue(orderEmbed, "Items"),
            total: fieldValue(orderEmbed, "Order total"),
            customerId: discordUserId!,
          }).catch(() => false);
          if (!posted) console.error("Purchase announcement failed", reference);
        });

        // Announce collapses into a disabled "Announced" so the same sale
        // cannot be posted twice by a double click.
        return json({
          type: 7,
          data: {
            components: orderControls({
              customerId: discordUserId!,
              reference: reference ?? "",
              ticketChannelId: ticketChannelId || null,
              closed: alreadyClosed,
              announced: true,
            }),
            allowed_mentions: { parse: [] },
          },
        });
      }

      // --- Close / reopen --------------------------------------------------
      if (!["close", "open"].includes(action)) return json({ type: 6 });
      if (!ticketChannelId || !/^\d{17,20}$/.test(ticketChannelId)) {
        return ephemeral("This order has no ticket channel to act on.");
      }

      const closing = action === "close";

      after(async () => {
        try {
          await runTicketLifecycle({
            applicationId: interaction.application_id!,
            interactionToken: interaction.token!,
            botToken: bot.token,
            channelId: ticketChannelId,
            customerId: discordUserId!,
            reference: reference ?? "",
            actorName,
            closing,
            originalEmbed: orderEmbed,
          });
        } catch (error) {
          console.error("Discord ticket lifecycle failed", error);
        }
      });

      // Swap the button immediately so the ticket cannot be closed twice while
      // the Discord API work is still running.
      return json({
        type: 7,
        data: {
          components: orderControls({
            customerId: discordUserId!,
            reference: reference ?? "",
            ticketChannelId,
            closed: closing,
            // Whether it was announced is not encoded in the button, so the
            // announce control returns to its live state here. Double-posting
            // is still guarded by the disabled swap on the announce click.
            announced: false,
          }),
          allowed_mentions: { parse: [] },
        },
      });
    }

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
