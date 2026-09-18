import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PRESENCE_CHANNEL } from "@/lib/presence-rules";

/**
 * Tell every open roster that who-is-online changed.
 *
 * Sent by the server with the service key over Supabase Realtime's REST
 * endpoint, to a private channel browsers may only listen on (migration 053
 * grants SELECT, no INSERT). The message carries nothing — pages re-read the
 * roster from /api/presence/online, which is what already hides invisible
 * members — so no name, id or status ever travels over the socket.
 *
 * Best-effort and never throws: a missed ping only means pages catch up on
 * their next scheduled refresh.
 */
export async function announcePresenceChange(): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const channel = admin.channel(PRESENCE_CHANNEL, { config: { private: true } });
  try {
    await channel.httpSend("changed", {});
  } catch (error) {
    console.error("Presence announcement failed", error);
  } finally {
    await admin.removeChannel(channel);
  }
}
