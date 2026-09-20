import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDiscordIdentity } from "@/lib/auth";
import { getDiscordBotToken, getDiscordGuildId, getDiscordInviteUrl, isGuildMember } from "@/lib/discord";
import { clientKey, rateLimitShared, retryAfterHeaders } from "@/lib/rate-limit";

/**
 * Discord identity of the current visitor, for pre-filling the order form.
 *
 * Also reports whether they have joined the Mazora server: signing in with
 * Discord does not put anyone in the guild, and a buyer who is not in it can
 * neither be DM'd nor added to their order ticket, so checkout asks them to
 * join first. `inGuild` is true when membership cannot be determined, so a
 * Discord outage never blocks orders.
 */
export async function GET(request: Request) {
  // Bound the auth lookup itself before reading the session. This route also
  // calls Discord for guild membership, so leaving it unlimited lets one
  // signed-in browser spend both Supabase and Discord API quota in a loop.
  const addressLimit = await rateLimitShared(clientKey(request, "discord-self"), {
    limit: 60,
    windowMs: 60_000,
  });
  if (!addressLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: retryAfterHeaders(addressLimit.retryAfter) },
    );
  }

  const discord = await getDiscordIdentity();
  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();

  let inGuild = true;
  if (discord?.id && token && guildId) {
    // A second, account-stable bucket means changing address cannot turn one
    // Discord account into unlimited membership requests. Hash the id before
    // it becomes a Redis key so the rate-limit store contains no raw identity.
    const identity = createHash("sha256").update(discord.id, "utf8").digest("hex").slice(0, 16);
    const accountLimit = await rateLimitShared(`discord-self:identity:${identity}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!accountLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: retryAfterHeaders(accountLimit.retryAfter) },
      );
    }
    inGuild = (await isGuildMember(token, guildId, discord.id)) !== false;
  }

  return NextResponse.json(
    { discord, inGuild, inviteUrl: getDiscordInviteUrl() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
