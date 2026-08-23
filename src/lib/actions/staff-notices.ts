"use server";

import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId, hasAtLeast } from "@/lib/auth";
import { canManageModule, MAZORA_BOT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { listStaffAccounts } from "@/lib/data/accounts";
import { getDb, schema } from "@/lib/db/client";
import {
  getDiscordBotToken,
  fetchGuildMember,
  getDiscordGuildId,
  searchGuildMembers,
  sendBotDirectMessage,
  type GuildMemberMatch,
} from "@/lib/discord";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import {
  renderStaffNotice,
  validateStaffNotice,
  type StaffNoticeTemplate,
} from "@/lib/staff-notices";

/** Shared gate: a signed-in session that may manage the bot console. */
async function authorize(): Promise<
  { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>>; actorId: string } | { ok: false; message: string }
> {
  const session = await getSession();
  const actorId = await getSessionUserId();
  if (!session || !actorId) return { ok: false, message: "Your session has expired." };
  if (!(await canManageModule(MAZORA_BOT_PERMISSION_KEY, session, actorId))) {
    return { ok: false, message: "Not authorized." };
  }
  return { ok: true, session, actorId };
}

/**
 * Find guild members whose username or nickname starts with `query`.
 *
 * Prefix-only, because that is what Discord's search endpoint does. Gated on
 * the same permission as the console and rate-limited, since it is an
 * authenticated proxy onto a Discord API call made with the bot token.
 */
export async function searchDiscordMembers(
  query: string,
): Promise<{ ok: true; members: GuildMemberMatch[] } | { ok: false; message: string }> {
  const auth = await authorize();
  if (!auth.ok) return { ok: false, message: auth.message };

  const trimmed = query.trim();
  // Two characters keeps a single keystroke from sweeping the whole guild.
  if (trimmed.length < 2) return { ok: true, members: [] };

  // The composer searches as the operator types (debounced), so the ceiling is
  // higher than a click-to-search flow would need. 90/min still bounds a stuck
  // client, while a person typing a name at speed never reaches it.
  const limit = await rateLimitShared(await actionClientKey("discord-member-search", auth.actorId), {
    limit: 90,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ok: false, message: "Too many searches. Wait a moment." };

  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  if (!token) return { ok: false, message: "The Discord bot is not configured." };
  if (!guildId) return { ok: false, message: "DISCORD_GUILD_ID is not configured, so members cannot be searched." };

  const direct = await searchGuildMembers(token, guildId, trimmed).catch(() => null);
  if (!direct) return { ok: false, message: "Discord did not respond to the search." };

  let members = direct;

  // Discord matches a prefix of the WHOLE username or nickname, so "Kasun
  // Sanjaya" is found by "kasun" but not by "sanjaya" — verified against the
  // live guild. When a multi-word query finds nothing, retry each word on its
  // own and merge, which rescues the common case of typing the words in the
  // wrong order ("sanjaya kasun"). Only as a fallback: running it always would
  // flood the results of a query that already matched.
  const words = trimmed.split(/\s+/).filter((word) => word.length >= 2);
  if (members.length === 0 && words.length > 1) {
    const batches = await Promise.all(
      // Capped at three so one long query cannot fan out into many API calls.
      words.slice(0, 3).map((word) => searchGuildMembers(token, guildId, word).catch(() => null)),
    );
    const seen = new Set<string>();
    members = batches.flatMap((batch) => batch ?? []).filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    });
  }

  // A DM to a bot always fails; dropping them here beats a confusing error later.
  return { ok: true, members: members.filter((member) => !member.bot) };
}

/**
 * DM a Discord guild member a notice.
 *
 * Deliberately does NOT change anyone's rank — that stays on /admin/users.
 *
 * Any template may go to any member of the guild. The recipient does not need
 * a site account: the requirement that "terminated" and "promotion" recipients
 * hold a linked staff account blocked promoting someone who had not linked one
 * yet, which is exactly when a promotion notice is most likely.
 *
 * Termination still requires the SENDER to be an owner, matching the bar
 * changeUserRole sets for a demotion: the authority to tell someone they are
 * fired should not be lower than the authority to fire them. With the recipient
 * check gone, the preview-and-confirm step is what guards against picking the
 * wrong person.
 */
export async function sendStaffNotice(input: {
  /** Discord user id. The recipient need not have a site account. */
  discordUserId: string;
  template: StaffNoticeTemplate;
  reason: string;
  customTitle?: string;
}): Promise<{ ok: boolean; message: string }> {
  const auth = await authorize();
  if (!auth.ok) return { ok: false, message: auth.message };
  const { session, actorId } = auth;

  if (!/^\d{17,20}$/.test(input.discordUserId)) {
    return { ok: false, message: "That is not a valid Discord user." };
  }
  if (input.template === "terminated" && !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only an owner can send a termination notice." };
  }

  // A stuck button must not be able to spam someone's DMs.
  const limit = await rateLimitShared(await actionClientKey("staff-notice", actorId), {
    limit: 10,
    windowMs: 60_000,
  });
  // RateLimitVerdict's field is `ok`, not `allowed` (src/lib/rate-limit.ts:34).
  if (!limit.ok) return { ok: false, message: "Too many notices. Wait a moment and try again." };

  // May be null: most recipients of a warning are ordinary community members.
  const staff = await listStaffAccounts();
  const staffAccount = (staff ?? []).find((account) => account.discordUserId === input.discordUserId) ?? null;

  const token = getDiscordBotToken();
  if (!token) return { ok: false, message: "The Discord bot is not configured." };

  const guildId = getDiscordGuildId();
  // One request does two jobs: it proves the recipient shares a guild with the
  // bot (the real boundary on who is reachable at all) AND returns their
  // display name. `null` means Discord did not answer — only an explicit
  // "not a member" blocks, so an outage cannot stop every notice.
  const lookup = guildId ? await fetchGuildMember(token, guildId, input.discordUserId) : null;
  if (lookup && lookup.member === null) {
    return { ok: false, message: "That user is not in the Discord server." };
  }
  const discordMember = lookup?.member ?? null;

  // Prefer the site account's name when there is one, then the Discord display
  // name. "there" is the last resort: without the Discord fallback every notice
  // to an ordinary member — which is most of them now — opened "Hi there".
  const recipientName =
    staffAccount?.displayName ??
    staffAccount?.username ??
    discordMember?.displayName ??
    discordMember?.username ??
    "there";
  const notice = {
    template: input.template,
    username: recipientName,
    reason: input.reason,
    customTitle: input.customTitle,
  };
  const valid = validateStaffNotice(notice);
  if (!valid.ok) return { ok: false, message: valid.message };

  // botRequest (src/lib/discord.ts) is a raw fetch with AbortSignal.timeout and
  // no catch of its own, so a network error or timeout rejects rather than
  // resolving false. Unguarded, a Discord outage would throw here, replace the
  // admin console with the error page, lose the reason the operator typed, and
  // skip the audit insert below entirely. Matches the pre-existing call sites in
  // src/app/api/discord/interactions/route.ts, which both end .catch(() => false).
  const delivered = await sendBotDirectMessage(token, input.discordUserId, renderStaffNotice(notice)).catch(
    () => false,
  );

  // Audited whether or not delivery succeeded: an attempted notice is a fact
  // about what staff did, independent of Discord's cooperation. targetId is null
  // for a recipient with no site account, which is now the common case.
  const db = getDb();
  if (db) {
    try {
      await db.insert(schema.auditLogs).values({
        actorId,
        action: "staff.notice",
        targetType: "user",
        targetId: staffAccount?.userId ?? null,
        metadata: {
          template: input.template,
          // The custom template's title is operator-written and is what the
          // recipient reads as the headline. Without it here, a custom notice
          // titled "Staff Position Terminated" is indistinguishable in the log
          // from any other custom message.
          customTitle: input.template === "custom" ? (input.customTitle ?? "").trim().slice(0, 120) : null,
          reason: input.reason.trim().slice(0, 1000),
          delivered,
          // Falls back to the Discord username so the audit log names a
          // recipient even when they have no site account — which is now
          // the common case. Previously every such row showed a bare dash.
          username: staffAccount?.username ?? discordMember?.username ?? null,
          discordUserId: input.discordUserId,
          by: session.username,
        },
      });
    } catch (error) {
      console.error("Staff notice audit write failed", error);
    }
  }

  // Without this, "Recent bot activity" keeps showing stale data until the next
  // unrelated navigation, so an operator cannot see the notice they just sent.
  revalidatePath("/admin/mazora-bot");

  return delivered
    ? { ok: true, message: "Notice sent." }
    : { ok: false, message: "Discord refused the DM. They may have direct messages disabled." };
}
