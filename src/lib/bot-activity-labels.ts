/**
 * Turn one audit_logs row into the line the bot console shows.
 *
 * Kept out of `data/bot-console.ts` because that module is server-only: the
 * label rules are the part worth testing, and they cannot be reached from a
 * test through a module that imports "server-only". Same split as
 * `discord-roles-shared.ts`.
 */

export interface BotAuditDescription {
  kind: "notice" | "role" | "rank";
  label: string;
  detail: string | null;
  actor: string | null;
  /**
   * Whether the action actually completed.
   *
   * This is what the console needs to show first — a refused role grant read
   * exactly like a successful one when the only difference was a word buried
   * in the label. It means "the operation did what it was asked to do", not
   * "the outcome was favourable": a role deliberately removed is `true`.
   */
  ok: boolean;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Describe a bot-console audit row, or return null if the action is not one
 * this panel reports.
 *
 * `roleName` is resolved by the caller, which has the Discord client; passing
 * it in keeps this function pure. When it is null the raw snowflake is shown
 * rather than nothing, because an unresolvable id is still evidence that
 * something happened.
 */
export function describeBotAuditRow(
  action: string,
  metadata: Record<string, unknown> | null,
  roleName?: string | null,
): BotAuditDescription | null {
  const meta = metadata ?? {};
  const actor = text(meta.by);

  if (action === "staff.notice") {
    return {
      kind: "notice",
      // Written whether or not Discord delivered it, so the flag is the only
      // thing separating "sent" from "attempted and refused".
      label: meta.delivered === false ? "Staff notice failed" : "Staff notice sent",
      detail: text(meta.username),
      actor,
      ok: meta.delivered !== false,
    };
  }

  if (action === "discord.role") {
    // `applied` is Discord's answer, `granted` is what was asked for. A failed
    // grant must never read as a successful one — it is usually the bot's role
    // sitting below the role it was told to hand out.
    const label =
      meta.applied === false
        ? "Discord role change failed"
        : meta.granted === false
          ? "Discord role removed"
          : "Discord role added";

    // Removing a role on purpose is a success. Only Discord refusing the
    // change is a failure.
    return { kind: "role", label, detail: roleName ?? text(meta.roleId), actor, ok: meta.applied !== false };
  }

  if (action === "role.change") {
    const username = text(meta.username);
    const from = text(meta.from);
    const to = text(meta.to);
    const movement = from && to ? `${from} → ${to}` : null;

    return {
      kind: "rank",
      label: "Rank changed",
      detail: [username, movement].filter(Boolean).join(" · ") || null,
      actor,
      // A rank row is only written once the change has been applied.
      ok: true,
    };
  }

  return null;
}
