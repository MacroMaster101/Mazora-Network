import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";
import {
  fetchGuildMember,
  getDiscordBotToken,
  getDiscordGuildId,
  sendBotDirectMessage,
} from "@/lib/discord";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import { listAllAuthUsers } from "@/lib/data/accounts";
import { rateLimitShared } from "@/lib/rate-limit";
import type { Role } from "@/lib/types";
import {
  renderStaffNotice,
  suggestionsFor,
  validateStaffNotice,
  STAFF_NOTICE_TEMPLATES,
  type StaffNoticeTemplate,
} from "@/lib/staff-notices";

/**
 * `/staff-notice` slash command handler.
 *
 * The Discord-side twin of `sendStaffNotice` in `src/lib/actions/staff-notices.ts`
 * (the admin page's composer). Kept in its own module rather than inline in the
 * interactions route so that route stays a dispatch, not a second implementation.
 *
 * Deliberately avoids importing `@/lib/auth`: it pulls in `next/headers`, which
 * this module — invoked from a webhook handler, not a request with cookies —
 * has no use for. Anything needed from there is imported from its leaf module.
 */

interface CommandOption {
  name?: string;
  value?: unknown;
  /** Set by Discord on the option the user is currently typing into. */
  focused?: boolean;
}

interface CommandInteraction {
  data?: { name?: string; options?: CommandOption[] };
  member?: { roles?: string[]; user?: { id?: string; username?: string } };
}

/**
 * Roles permitted to run /staff-notice.
 *
 * Deliberately not DISCORD_STORE_STAFF_ROLE_ID: confirming a store order and
 * terminating a colleague are different levels of authority and must not share
 * one role. Unset means the command refuses, mirroring staffCheck.
 */
function noticeRoleIds(): string[] {
  return (process.env.DISCORD_STAFF_NOTICE_ROLE_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{17,20}$/.test(id));
}

function optionValue(options: CommandOption[] | undefined, name: string): string {
  const found = options?.find((option) => option.name === name);
  return typeof found?.value === "string" ? found.value : "";
}

/**
 * Discord id -> site account, so the audit row can name a real user. Returning
 * null is a normal outcome, not an error: most recipients have no site account.
 *
 * Uses `listAllAuthUsers`, which pages through every account rather than a
 * single capped `listUsers` call. A bare `listUsers({ page: 1, perPage: N })`
 * silently drops every account past the cap — this repo already shipped that
 * bug once (see the comment on `listAllAuthUsers` in
 * `src/lib/data/accounts.ts`): past 200 accounts, staff created after the
 * cut-off vanished from the Users board, the public team page and the
 * player directory's role lookup. Here the failure mode would be a genuinely
 * linked staff member silently treated as unlinked and refused.
 *
 * Reads `provider_id ?? sub`, matching every other identity reader in the
 * repo (`src/lib/auth/index.ts`, `src/lib/data/accounts.ts`) rather than
 * `provider_id` alone.
 */
async function findAccountByDiscordId(
  discordId: string,
): Promise<{ userId: string; username: string; role: Role } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { users, error } = await listAllAuthUsers(admin);
  if (error) return null;

  for (const user of users) {
    const identity = pickDiscordIdentity(user.identities);
    const raw = String(
      (identity?.identity_data as Record<string, unknown> | undefined)?.provider_id ??
        (identity?.identity_data as Record<string, unknown> | undefined)?.sub ??
        "",
    ).trim();
    if (raw === discordId) {
      return {
        userId: user.id,
        username: String(user.user_metadata?.username ?? user.email?.split("@")[0] ?? "unknown"),
        role: (user.app_metadata?.role as Role | undefined) ?? "member",
      };
    }
  }
  return null;
}

export async function handleStaffNoticeCommand(
  interaction: CommandInteraction,
): Promise<{ content: string }> {
  const allowed = noticeRoleIds();
  if (allowed.length === 0) {
    return { content: "Staff notices are disabled until DISCORD_STAFF_NOTICE_ROLE_ID is configured." };
  }
  const roles = interaction.member?.roles;
  if (!Array.isArray(roles) || !roles.some((role) => allowed.includes(role))) {
    return { content: "You don't have permission to send staff notices." };
  }

  const options = interaction.data?.options;
  const targetDiscordId = optionValue(options, "user");
  const rawTemplate = optionValue(options, "template");
  const reason = optionValue(options, "reason");
  const customTitle = optionValue(options, "title");

  if (!/^\d{17,20}$/.test(targetDiscordId)) return { content: "That is not a valid Discord user." };
  if (!STAFF_NOTICE_TEMPLATES.includes(rawTemplate as StaffNoticeTemplate)) {
    return { content: "Unknown template." };
  }
  const template = rawTemplate as StaffNoticeTemplate;

  // Termination is owner-gated on the web (sendStaffNotice requires
  // hasAtLeast(session.role, "owner")). Rather than add a second Discord role
  // variable that could drift from the site's rank ladder — which is the
  // authority on who may fire someone — the slash command refuses this
  // template outright and points the operator at the console that enforces
  // the real check.
  if (template === "terminated") {
    return { content: "Termination notices must be sent from the admin console at /admin/mazora-bot." };
  }

  // A stuck retry (or a malicious client replaying the interaction body) must
  // not be able to spam someone's DMs. Mirrors the web action's 10/min limit,
  // keyed on the invoking Discord user rather than an IP, since this handler
  // never sees a Request.
  const invokerDiscordId = interaction.member?.user?.id;
  const limit = await rateLimitShared(`staff-notice-discord:${invokerDiscordId ?? "unknown"}`, {
    limit: 10,
    windowMs: 60_000,
  });
  // RateLimitVerdict's field is `ok`, not `allowed` (src/lib/rate-limit.ts:34).
  if (!limit.ok) return { content: "Too many notices. Wait a moment and try again." };

  const account = await findAccountByDiscordId(targetDiscordId);

  // No recipient gate: any template may be sent to any guild member. The
  // account lookup below is only for naming them and attributing the audit
  // row — a recipient with no site account is normal, not an error.

  // Same fallback chain as the web action: site account name, then the
  // Discord display name, then "there". Without the Discord lookup a notice to
  // anyone without a site account opens "Hi there", which is how the first
  // real test message went out.
  const guildId = getDiscordGuildId();
  const token0 = getDiscordBotToken();
  const discordMember =
    guildId && token0 ? (await fetchGuildMember(token0, guildId, targetDiscordId))?.member ?? null : null;

  const notice = {
    template,
    username: account?.username ?? discordMember?.displayName ?? discordMember?.username ?? "there",
    reason,
    customTitle: customTitle || undefined,
  };
  const valid = validateStaffNotice(notice);
  if (!valid.ok) return { content: valid.message };

  const token = getDiscordBotToken();
  if (!token) return { content: "The Discord bot is not configured." };

  // botRequest (src/lib/discord.ts) is a raw fetch with AbortSignal.timeout and
  // no catch of its own, so a network error or timeout rejects. Guarded here
  // the same way the two pre-existing call sites in
  // src/app/api/discord/interactions/route.ts are, so a Discord outage cannot
  // throw past the audit write below.
  const delivered = await sendBotDirectMessage(token, targetDiscordId, renderStaffNotice(notice)).catch(
    () => false,
  );

  // The invoker is looked up too so the audit row can carry a real site
  // actorId, not just a mutable Discord display name.
  const invokerAccount = invokerDiscordId ? await findAccountByDiscordId(invokerDiscordId) : null;

  const db = getDb();
  if (db) {
    try {
      await db.insert(schema.auditLogs).values({
        actorId: invokerAccount?.userId ?? null,
        action: "staff.notice",
        targetType: "user",
        targetId: account?.userId ?? null,
        metadata: {
          template,
          // See the matching comment in actions/staff-notices.ts: the custom
          // title is the headline the recipient reads, so it belongs in the log.
          customTitle: template === "custom" ? customTitle.trim().slice(0, 120) : null,
          reason: reason.trim().slice(0, 1000),
          delivered,
          via: "slash-command",
          discordUserId: targetDiscordId,
          discordActorId: invokerDiscordId ?? null,
          // `username` and `by` are the two keys readBotActivity (Task 6)
          // renders. Without them a slash-command notice shows up in the
          // console with a blank recipient and no actor.
          username: account?.username ?? discordMember?.username ?? null,
          by: interaction.member?.user?.username ?? "discord",
        },
      });
    } catch (error) {
      console.error("Slash-command staff notice audit write failed", error);
    }
  }

  return {
    content: delivered
      ? `Notice sent to <@${targetDiscordId}>.`
      : `Discord refused the DM to <@${targetDiscordId}>. They may have DMs disabled.`,
  };
}

/**
 * Serve Discord autocomplete for the `reason` option.
 *
 * The admin page shows suggested reasons as clickable chips; without this the
 * slash command offered a bare text box and none of that wording, so the two
 * surfaces produced differently-worded notices for the same situation. Both now
 * read `SUGGESTED_REASONS` from `@/lib/staff-notices`.
 *
 * Discord gives an autocomplete interaction the same 3-second budget as a
 * command, so this does no I/O at all — it is a filter over an in-memory list
 * and must stay that way.
 *
 * Gated on the same role as the command itself. The suggestions are not
 * sensitive, but someone who cannot run the command has no business being
 * offered its wording.
 */
export function handleStaffNoticeAutocomplete(
  interaction: CommandInteraction,
): { choices: { name: string; value: string }[] } {
  const allowed = noticeRoleIds();
  const roles = interaction.member?.roles;
  const permitted =
    allowed.length > 0 && Array.isArray(roles) && roles.some((role) => allowed.includes(role));
  if (!permitted) return { choices: [] };

  const options = interaction.data?.options ?? [];
  const focused = options.find((option) => option.focused);
  if (focused?.name !== "reason") return { choices: [] };

  const template = optionValue(options, "template");
  const typed = typeof focused.value === "string" ? focused.value : "";

  return {
    // Discord rejects a response with more than 25 choices, and truncates a
    // name over 100 characters. The suggestion list is tested against both
    // limits, so these are belt-and-braces rather than the real guard.
    choices: suggestionsFor(template, typed)
      .slice(0, 25)
      .map((suggestion) => ({
        name: suggestion.slice(0, 100),
        value: suggestion.slice(0, 100),
      })),
  };
}
