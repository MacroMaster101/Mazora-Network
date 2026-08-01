import { NextResponse } from "next/server";
import { getDiscordIdentity } from "@/lib/auth";
import { getDiscordBotToken, getDiscordGuildId, getDiscordInviteUrl, isGuildMember } from "@/lib/discord";

/**
 * Discord identity of the current visitor, for pre-filling the order form.
 *
 * Also reports whether they have joined the Mazora server: signing in with
 * Discord does not put anyone in the guild, and a buyer who is not in it can
 * neither be DM'd nor added to their order ticket, so checkout asks them to
 * join first. `inGuild` is true when membership cannot be determined, so a
 * Discord outage never blocks orders.
 */
export async function GET() {
  const discord = await getDiscordIdentity();
  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();

  let inGuild = true;
  if (discord?.id && token && guildId) {
    inGuild = (await isGuildMember(token, guildId, discord.id)) !== false;
  }

  return NextResponse.json(
    { discord, inGuild, inviteUrl: getDiscordInviteUrl() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
