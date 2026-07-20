import { NextResponse } from "next/server";
import {
  getDiscordAppPublicKey,
  getDiscordBotConfig,
  sendBotDirectMessage,
  verifyDiscordSignature,
} from "@/lib/discord";

/**
 * Discord interactions endpoint (HTTP-only bot — no gateway process).
 * Set this URL in the Discord developer portal under
 * General Information → Interactions Endpoint URL:
 *   https://<your-domain>/api/discord/interactions
 *
 * Handles the Confirm/Reject buttons on store order messages: the player is
 * notified by DM and the staff embed is updated in place.
 */

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
  data?: { custom_id?: string; component_type?: number };
  member?: { user?: { id?: string; username?: string; global_name?: string | null }; roles?: string[] };
  user?: { id?: string; username?: string; global_name?: string | null };
  message?: { embeds?: Embed[] };
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Ephemeral (flags: 64) reply visible only to the clicking user. */
const ephemeral = (content: string) => json({ type: 4, data: { content, flags: 64 } });

/**
 * Whether the interacting member holds the configured store-staff role. When
 * DISCORD_STORE_STAFF_ROLE_ID is set, only members carrying that role may act
 * on order buttons; without it configured, we fall back to Discord's own
 * channel permissions (the orders channel should be staff-only) and allow the
 * action. `member.roles` is only present for in-guild interactions.
 */
function isStaffMember(interaction: Interaction): boolean {
  const staffRoleId = process.env.DISCORD_STORE_STAFF_ROLE_ID?.trim();
  if (!staffRoleId || !/^\d{17,20}$/.test(staffRoleId)) return true;
  const roles = interaction.member?.roles;
  return Array.isArray(roles) && roles.includes(staffRoleId);
}

function fieldValue(embed: Embed | undefined, name: string): string {
  return embed?.fields?.find((field) => field.name === name)?.value ?? "";
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
    if (!isStaffMember(interaction)) {
      return ephemeral("You don't have permission to action Mazora orders.");
    }

    const bot = getDiscordBotConfig();
    const actor = interaction.member?.user ?? interaction.user;
    const actorName = actor?.global_name || actor?.username || "staff";
    const confirmed = action === "confirm";
    const originalEmbed = interaction.message?.embeds?.[0];
    const total = fieldValue(originalEmbed, "Order total");
    const items = fieldValue(originalEmbed, "Items");

    let statusValue = confirmed
      ? `✅ Confirmed by **${actorName}**`
      : `❌ Declined by **${actorName}**`;
    if (bot) {
          const dmPayload = confirmed
            ? {
                embeds: [
                  {
                    author: { name: "Mazora Network", icon_url: "https://mazora.us/images/mazora-logo.webp" },
                    title: "✅ Order Confirmed!",
                    description:
                      `Your Mazora Network order (\`${reference}\`) has just been confirmed by **${actorName}**.\n` +
                      `They will be reaching out to you here shortly to arrange payment and finalize the delivery.\n\n` +
                      (items ? `**Order Summary**\n${items}\n\n` : "") +
                      (total ? `**Total:** ${total}\n` : "") +
                      `_No payment has been taken yet — staff will never ask for card details in chat._`,
                    color: 0x34d399,
                  },
                ],
              }
            : {
                embeds: [
                  {
                    author: { name: "Mazora Network", icon_url: "https://mazora.us/images/mazora-logo.webp" },
                    title: "❌ Order Declined",
                    description:
                      `Your Mazora Network order (\`${reference}\`) was reviewed and declined by **${actorName}**.\n` +
                      `If you believe this is a mistake or have questions, please reach out in the Mazora Discord server.`,
                    color: 0xf87171,
                  },
                ],
              };
      // Wait up to 1.5 seconds to see if the DM delivers so we don't hit the 3s interaction timeout.
      // If the DM is just slow, we don't append a status, but it still sends in the background.
      const dmResult = await Promise.race([
        sendBotDirectMessage(bot.token, discordUserId!, dmPayload).catch(() => false),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 1500)),
      ]);
      
      let dmStatus = "";
      if (dmResult === true) dmStatus = " · player notified by DM";
      else if (dmResult === false) dmStatus = " · ⚠️ DM failed (DMs off)";
      statusValue = confirmed
        ? `✅ Confirmed by **${actorName}**${dmStatus}`
        : `❌ Declined by **${actorName}**${dmStatus}`;
    }

    const updatedEmbed: Embed = {
      ...originalEmbed,
      color: confirmed ? 0x34d399 : 0xf87171,
      fields: [...(originalEmbed?.fields ?? []), { name: "Status", value: statusValue }],
      footer: { text: confirmed ? "Manual store request · Confirmed" : "Manual store request · Rejected" },
    };

    // UPDATE_MESSAGE: swap the embed and drop the buttons on the original post.
    return json({
      type: 7,
      data: {
        embeds: [updatedEmbed],
        components: [],
        allowed_mentions: { parse: [] },
      },
    });
  }

  return json({ error: "unsupported interaction" }, 400);
}
