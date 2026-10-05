import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, Gamepad2, Gift, Trophy, Users } from "lucide-react";
import { getEvent } from "@/lib/data/content";
import { getPageContent } from "@/lib/data/page-content";
import { getEventRegistrants, getViewerRegistration } from "@/lib/data/event-registrations";
import { getSession, getSessionUserId } from "@/lib/auth";
import { publicPageMetadata } from "@/lib/seo";
import { isRouteLaunchGated } from "@/lib/launch";
import { BackLink, MinecraftAvatar } from "@/components/shared";
import { EventCoverMedia } from "@/components/events/event-cover-media";
import { LocalTime } from "@/components/events/local-time";
import { PlayerSlots } from "@/components/events/player-slots";
import { RegistrationCard } from "@/components/events/registration-card";
import { EVENT_STATUS_LABEL } from "@/components/events/status";
import "@/styles/events.css";

/**
 * Per-request rendering. While prerendered this route returned HTTP 500
 * (DYNAMIC_SERVER_USAGE) for every slug: getEvents() is still empty, so
 * generateStaticParams produced no params and the on-demand render collided
 * with the cookie-reading layout above it. Rendering per request makes unknown
 * slugs a clean 404. It also keeps the player list and the viewer's own
 * registration current.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found", robots: { index: false, follow: false } };
  // See the game-mode detail route: bare title/description inherits the root
  // layout's entire openGraph block, so every event shared the homepage unfurl.
  return publicPageMetadata({
    title: event.title,
    description: event.description,
    path: `/events/${slug}`,
  });
}

export default async function EventDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  // A suspended account has no session, so it is treated as signed out here too.
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  const viewerId = session && userId ? userId : null;
  const [registrants, viewer, copy] = await Promise.all([
    getEventRegistrants(event.id),
    getViewerRegistration(event.id, viewerId),
    getPageContent("events"),
  ]);
  const open = event.status === "upcoming" || event.status === "live";

  return (
    <>
      <section className="shell pt-8 sm:pt-12">
        <BackLink href="/events" label="All events" className="mb-5" />
        <div className="event-cover-card">
          <EventCoverMedia imageUrl={event.imageUrl} sizes="(min-width: 1280px) 1400px, 100vw" priority />
          <div className="event-cover-body">
            <div className="event-cover-tags">
              <span className="event-cover-tag" data-tone={event.status}>
                {event.status === "live" && <span className="event-cover-live-dot" />}
                {EVENT_STATUS_LABEL[event.status]}
              </span>
              <span className="event-cover-tag">
                <Gamepad2 size={14} /> {event.mode}
              </span>
            </div>
            <h1 className="event-cover-title">{event.title}</h1>
            {event.description && <p className="event-cover-lead">{event.description}</p>}
            <div className="event-cover-meta">
              <span>
                <CalendarDays size={16} /> <LocalTime iso={event.startISO} />
              </span>
              <span>
                <Users size={16} /> {event.joined} of {event.maxParticipants} players
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="shell grid items-start gap-6 pb-20 pt-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-6">
          <PlayerSlots
            registrants={registrants}
            maxParticipants={event.maxParticipants}
            viewerName={viewer.registered ? viewer.minecraftUsername : null}
            open={open}
            profilesOpen={!isRouteLaunchGated("/players/profile")}
            title={copy.playersTitle}
            emptyMessage={copy.playersEmpty}
          />

          {event.winners && event.winners.length > 0 && (
            <section className="panel p-6" aria-labelledby="event-winners">
              <h2 id="event-winners" className="flex items-center gap-2 font-display text-xl font-bold">
                <Trophy size={20} className="text-gold" /> Winners
              </h2>
              <div className="mt-4 space-y-3">
                {event.winners.map((w) => (
                  <div key={w.username} className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
                    <span className="telemetry text-xl font-bold">{["🥇", "🥈", "🥉"][w.place - 1]}</span>
                    <MinecraftAvatar username={w.username} size={40} />
                    <div className="flex-1">
                      <Link href={`/players/${w.username}`} className="font-semibold hover:text-accent-bright">
                        {w.username}
                      </Link>
                      <p className="text-xs text-muted">{w.prize}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel grid gap-6 p-6 sm:grid-cols-2" aria-label="How to take part">
            {event.requirements.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold">{copy.requirementsTitle}</h2>
                <ul className="mt-3 space-y-2">
                  {event.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                      <Check size={17} className="mt-0.5 shrink-0 text-accent-bright" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h2 className="font-display text-lg font-bold">{copy.rulesTitle}</h2>
              <ul className="mt-3 space-y-2">
                {event.rules.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <aside className="event-register-sticky space-y-6">
          <RegistrationCard
            eventId={event.id}
            slug={event.slug}
            status={event.status}
            startISO={event.startISO}
            endISO={event.endISO}
            joined={event.joined}
            maxParticipants={event.maxParticipants}
            viewer={viewer}
          />
          {event.rewards.length > 0 && (
            <section className="panel p-6" aria-labelledby="event-rewards">
              <h2 id="event-rewards" className="flex items-center gap-2 font-display text-lg font-bold">
                <Gift size={18} className="text-gold" /> {copy.rewardsTitle}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {event.rewards.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {r}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </section>
    </>
  );
}
