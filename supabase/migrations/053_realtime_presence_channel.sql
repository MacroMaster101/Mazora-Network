/*
 * Live "who's online" panels: authorization for the private realtime channel
 * `presence`.
 *
 * The server announces "the roster changed" on that channel with the service
 * key (which bypasses these policies); open /forums pages listen and re-read
 * the roster from /api/presence/online. The pings carry no data — no names,
 * ids or statuses — so reading them reveals nothing the public endpoint does
 * not already show.
 *
 * Browsers therefore get SELECT on this one topic and NOTHING else: there is
 * deliberately no INSERT policy, so no visitor can publish on the channel and
 * make pages refresh or pretend to be anyone. Any other private topic stays
 * closed, as realtime.messages has RLS enabled by Supabase.
 *
 * Takes effect for channels opened with `config: { private: true }`. For the
 * guarantee to hold, the project's Realtime settings should allow private
 * channels only (Dashboard → Realtime → Settings → disable public access),
 * so a client cannot sidestep these rules by opening a public channel of the
 * same name.
 */
begin;

drop policy if exists "presence pings are readable" on realtime.messages;

create policy "presence pings are readable"
  on realtime.messages
  for select
  to anon, authenticated
  using (
    realtime.topic() = 'presence'
    and realtime.messages.extension = 'broadcast'
  );

commit;
