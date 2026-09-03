"use server";

import { revalidatePath } from "next/cache";
import { canGrantRank, canManageRank, getSession, getSessionUserId, hasAtLeast, STAFF_ROLES } from "@/lib/auth";
import { canManageModule, MAZORA_BOT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { listAccounts } from "@/lib/data/accounts";
import { composeNoticeResult } from "@/lib/notice-result";
import { changeUserRole } from "@/lib/actions/roles";
import { getDb, schema } from "@/lib/db/client";
import type { Role } from "@/lib/types";
import {
  addGuildMemberRole,
  getDiscordBotToken,
  fetchGuildMember,
  getDiscordGuildId,
  getGrantableRoleIds,
  listGuildRoles,
  removeGuildMemberRole,
  searchGuildMembers,
  sendBotDirectMessage,
  type GuildMemberMatch,
} from "@/lib/discord";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import {
  MAX_OPENING_LENGTH,
  MAX_TITLE_LENGTH,
  renderStaffNotice,
  staffNoticeText,
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
  /**
   * Optional site rank to apply alongside the notice. Honoured only for the
   * promotion and termination templates — see the guard below.
   */
  newRole?: Role;
  /**
   * Per-send wording edits made in the composer's preview. Plain text with no
   * authority attached — anyone who may send a notice may already write
   * arbitrary text in the reason — so these are length-capped and trimmed, not
   * permission-checked. The reply footer is not overridable.
   */
  titleOverride?: string;
  openingOverride?: string;
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
  const accounts = await listAccounts();
  const siteAccount = (accounts ?? []).find((account) => account.discordUserIds.includes(input.discordUserId)) ?? null;

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
    siteAccount?.displayName ??
    siteAccount?.username ??
    discordMember?.displayName ??
    discordMember?.username ??
    "there";
  const titleOverride = (input.titleOverride ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  const openingOverride = (input.openingOverride ?? "").trim().slice(0, MAX_OPENING_LENGTH);
  const edited = Boolean(titleOverride || openingOverride);

  const notice = {
    template: input.template,
    username: recipientName,
    reason: input.reason,
    customTitle: input.customTitle,
    // Blank falls through to the template inside the renderer.
    titleOverride,
    openingOverride,
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

  /*
    Deliver to the site inbox too, when the recipient has an account. Best
    effort and independent of the DM: a Discord outage must not cost the
    recipient the only other copy of the message, and neither failure blocks
    the audit row below.
  */
  /*
    Apply the requested rank change.

    Deliberately gated on the template: newRole arrives from the browser, and
    without this a crafted request could attach a promotion to a Warning.
    changeUserRole re-checks authority itself — owner+, not self, canManageRank
    and canGrantRank — so this is a scope guard, not the security one.

    Runs AFTER the DM so a rank failure cannot cost the message, and its result
    is reported rather than swallowed: a promotion whose rank did not move is
    not a success.
  */
  let rankOutcome: { ok: boolean; to: string; reason?: string } | null = null;
  const rankAllowed = input.template === "promotion" || input.template === "terminated";
  if (input.newRole && rankAllowed) {
    if (!siteAccount) {
      rankOutcome = { ok: false, to: input.newRole, reason: "They have no linked site account." };
    } else {
      const changed = await changeUserRole({ userId: siteAccount.userId, newRole: input.newRole }).catch(
        (error: unknown) => ({
          ok: false,
          message: error instanceof Error ? error.message : "The rank change failed.",
        }),
      );
      rankOutcome = { ok: changed.ok, to: input.newRole, reason: changed.ok ? undefined : changed.message };
    }
  }

  let inboxed = false;
  if (siteAccount) {
    const text = staffNoticeText(notice);
    const inboxDb = getDb();
    if (inboxDb) {
      try {
        await inboxDb.insert(schema.notifications).values({
          userId: siteAccount.userId,
          title: text.title,
          message: text.message,
          category: "system",
          sender: "mazora",
          href: null,
        });
        inboxed = true;
      } catch (error) {
        console.error("Staff notice inbox insert failed", error);
      }
    }
  }

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
        targetId: siteAccount?.userId ?? null,
        metadata: {
          template: input.template,
          // The custom template's title is operator-written and is what the
          // recipient reads as the headline. Without it here, a custom notice
          // titled "Staff Position Terminated" is indistinguishable in the log
          // from any other custom message.
          customTitle: input.template === "custom" ? (input.customTitle ?? "").trim().slice(0, 120) : null,
          reason: input.reason.trim().slice(0, 1000),
          delivered,
          inboxed,
          // Recorded even when null, so the log distinguishes "no rank change
          // requested" from "requested and refused".
          // Marks a notice that did NOT use the standard template wording, so a
          // surprising message can be traced afterwards.
          edited,
          rankRequested: input.newRole ?? null,
          rankApplied: rankOutcome?.ok ?? null,
          // Falls back to the Discord username so the audit log names a
          // recipient even when they have no site account — which is now
          // the common case. Previously every such row showed a bare dash.
          username: siteAccount?.username ?? discordMember?.username ?? null,
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

  return composeNoticeResult({ delivered, rank: rankOutcome });
}

export interface RecipientContext {
  ok: boolean;
  message?: string;
  /** Null when the recipient has no site account — the common case. */
  account: { userId: string; username: string; role: Role } | null;
  /** Ranks the actor may grant. Empty when they may not manage this account. */
  grantableRanks: Role[];
  /** Allowlisted roles, with whether the recipient currently holds each. */
  discordRoles: { id: string; name: string; held: boolean }[];
}

/**
 * Everything the composer needs about one recipient once they are picked.
 *
 * Deliberately a separate action rather than extra fields on
 * searchDiscordMembers: search returns up to twenty-five people and resolving a
 * site account for each would mean listing every auth user per keystroke.
 */
export async function getRecipientContext(discordUserId: string): Promise<RecipientContext> {
  const empty: RecipientContext = { ok: false, account: null, grantableRanks: [], discordRoles: [] };

  const auth = await authorize();
  if (!auth.ok) return { ...empty, message: auth.message };
  const { session, actorId } = auth;

  if (!/^\d{17,20}$/.test(discordUserId)) {
    return { ...empty, message: "That is not a valid Discord user." };
  }

  // Fires whenever a recipient is picked (two Discord calls plus a full
  // listAccounts() sweep), so it needs its own, more generous ceiling than a
  // mutation — but a stuck client must still not be able to hammer it.
  const limit = await rateLimitShared(await actionClientKey("recipient-context", actorId), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ...empty, message: "Too many requests. Wait a moment." };

  const accounts = await listAccounts();
  const matched = (accounts ?? []).find((account) => account.discordUserIds.includes(discordUserId)) ?? null;

  // An actor may not touch their own rank, nor anyone at or above them.
  const isSelf = matched?.userId === auth.actorId;
  const manageable = matched !== null && !isSelf && canManageRank(session.role, matched.role);
  // Candidates must match changeUserRole's ASSIGNABLE list exactly
  // (src/lib/actions/roles.ts:10-20) — that list is what the server actually
  // enforces, and it deliberately omits "guest". ROLES starts with "guest",
  // and canGrantRank(anyone, "guest") is always true, so filtering ROLES
  // offered a rank that changeUserRole would always reject as "Invalid role."
  const grantableRanks = manageable
    ? (["member", "sponsor", "vip", ...STAFF_ROLES] as Role[]).filter((role) =>
        canGrantRank(session.role, role),
      )
    : [];

  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  const allowlist = getGrantableRoleIds();

  let discordRoles: RecipientContext["discordRoles"] = [];
  if (token && guildId && allowlist.length > 0) {
    const [lookup, guildRoles] = await Promise.all([
      fetchGuildMember(token, guildId, discordUserId),
      listGuildRoles(token, guildId),
    ]);
    // Only offer the control when membership is actually confirmed. A Discord
    // outage (`lookup === null`) or a departed member (`lookup.member ===
    // null`) must render nothing here — the existing UI gating already hides
    // an empty array — rather than a control that always fails with a
    // misleading hierarchy error.
    if (lookup?.member) {
      const held = new Set(lookup.member.roles ?? []);
      discordRoles = (guildRoles ?? [])
        .filter((role) => allowlist.includes(role.id))
        .map((role) => ({ id: role.id, name: role.name, held: held.has(role.id) }));
    }
  }

  return {
    ok: true,
    account: matched ? { userId: matched.userId, username: matched.username, role: matched.role } : null,
    grantableRanks,
    discordRoles,
  };
}

/**
 * Add or remove one allowlisted Discord role.
 *
 * The allowlist is re-checked here, not just in the UI: the role id arrives
 * from the browser, and the dropdown is not a security boundary. Discord's own
 * hierarchy is a second limit that this cannot bypass — it refuses any role at
 * or above the bot's highest, server-side.
 */
export async function setRecipientDiscordRole(input: {
  discordUserId: string;
  roleId: string;
  grant: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const auth = await authorize();
  if (!auth.ok) return { ok: false, message: auth.message };
  const { session, actorId } = auth;

  if (!/^\d{17,20}$/.test(input.discordUserId)) {
    return { ok: false, message: "That is not a valid Discord user." };
  }
  if (!getGrantableRoleIds().includes(input.roleId)) {
    return { ok: false, message: "That role cannot be granted from here." };
  }

  // A mutation, so it gets the same ceiling as sending a staff notice.
  const limit = await rateLimitShared(await actionClientKey("discord-role", actorId), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.ok) return { ok: false, message: "Too many changes. Wait a moment and try again." };

  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  if (!token || !guildId) return { ok: false, message: "The Discord bot is not configured." };

  const applied = input.grant
    ? await addGuildMemberRole(token, guildId, input.discordUserId, input.roleId)
    : await removeGuildMemberRole(token, guildId, input.discordUserId, input.roleId);

  const db = getDb();
  if (db) {
    try {
      await db.insert(schema.auditLogs).values({
        actorId,
        action: "discord.role",
        targetType: "discord_user",
        targetId: input.discordUserId,
        metadata: { roleId: input.roleId, granted: input.grant, applied, by: session.username },
      });
    } catch (error) {
      console.error("Discord role audit insert failed", error);
    }
  }

  if (!applied) {
    // Almost always Discord's hierarchy rule: the bot cannot manage a role at
    // or above its own highest, whatever the allowlist says.
    return { ok: false, message: "Discord refused that change. Check the bot's role is above it." };
  }

  // Without this, "Recent bot activity" keeps showing stale data until the
  // next unrelated navigation, so an operator cannot see the change they just
  // made — matches sendStaffNotice's revalidation below.
  revalidatePath("/admin/mazora-bot");

  return { ok: true, message: input.grant ? "Role added." : "Role removed." };
}
