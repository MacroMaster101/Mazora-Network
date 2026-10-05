import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManagePlay } from "@/lib/auth/permissions";
import { getPatchUpdates } from "@/lib/data/patches";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Reads recent messages from a Discord channel and renders them as patch notes.
 * Only reachable by staff who may edit the Play page, only for a
 * server-approved channel, and only ever called from the Play page editor in
 * the admin panel.
 *
 * The check is the Play module permission, the same one /admin/play and
 * savePlayConfigAction use. It used to be a fixed "administrator or above",
 * which disagreed with the editor both ways: staff granted Play could open the
 * editor but its sync button always failed, and an administrator the owner had
 * removed from Play could still call this directly.
 *
 * The permission check is not optional. `channelId` is caller-supplied and is handed
 * to the Discord API using the *bot* token, so an unauthenticated caller could
 * otherwise read any channel the bot can see — order tickets, closed-ticket
 * transcripts and staff channels included. `getPatchUpdates` also drops its
 * patch-keyword filter whenever an explicit channel id is passed, so those
 * messages come back verbatim rather than filtered.
 */
export async function GET(request: Request) {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !(await canManagePlay(session, userId))) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("channelId")?.trim();
  if (requested && !/^\d{17,20}$/.test(requested)) {
    return NextResponse.json(
      { ok: false, error: "invalid_channel_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const approvedChannelIds = new Set(
    [process.env.DISCORD_PATCH_CHANNEL_ID, process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  // No channelId means "use the configured one". It is resolved here and passed
  // explicitly, because getPatchUpdates() only skips its patch-keyword filter
  // for an explicit channel: this sync must import every message from the
  // channel, as it did when the editor always sent an id. The resolved id is
  // one of the allowlisted env channels, so the allowlist still holds. With
  // neither set there is nothing to read.
  const configuredChannelId =
    process.env.DISCORD_PATCH_CHANNEL_ID?.trim() ||
    process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID?.trim() ||
    "";
  const channelId = requested || configuredChannelId;
  if (!channelId) {
    return NextResponse.json(
      { ok: false, error: "no_channel_configured" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (requested && !approvedChannelIds.has(requested)) {
    return NextResponse.json(
      { ok: false, error: "channel_not_approved" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const patches = await getPatchUpdates(channelId);
    revalidatePath("/play");
    revalidatePath("/admin/play");
    revalidatePath("/admin/pages");
    return NextResponse.json(
      { ok: true, channelId: requested ?? null, patches },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    // The underlying error can carry Discord API detail, so it is logged rather
    // than returned to the caller.
    console.error("Discord patch sync failed", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch channel patches" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
