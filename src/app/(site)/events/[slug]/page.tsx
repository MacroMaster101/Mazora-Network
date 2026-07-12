import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Gift, Trophy, Users } from "lucide-react";
import { getEvent, getEvents } from "@/lib/data/content";
import { fmtDate } from "@/lib/utils";
import { Countdown, Icon, MinecraftAvatar, Reveal } from "@/components/shared";
import { accentStyles, coverGradient } from "@/components/shared/accent";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found" };
  return { title: event.title, description: event.description };
}

const statusTone = {
  live: "border-danger/50 text-danger bg-danger/10",
  upcoming: "border-accent/50 text-accent-bright bg-accent/10",
  completed: "border-line-strong text-muted bg-ink/5",
};

export default async function EventDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  const accent = accentStyles[event.accent];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line" style={{ backgroundImage: coverGradient(event.accent) }}>
        <div className="absolute inset-0 opacity-[0.12] [background:linear-gradient(rgb(var(--ink)/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--ink)/0.5)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="shell relative py-14 sm:py-20">
          <Link href="/events" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> All events
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase", statusTone[event.status])}>
              {event.status === "live" && <span className="dot animate-pulse" />}
              {event.status}
            </span>
            <span className="chip">{event.mode}</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-line-strong bg-black/30 ${accent.text}`}>
              <Icon name={event.icon} size={28} />
            </span>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{event.title}</h1>
          </div>
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted">{event.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="telemetry text-muted">{fmtDate(event.startISO)}</span>
            {event.status === "upcoming" && <Countdown to={event.startISO} big />}
          </div>
        </div>
      </section>

      <section className="section shell grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {event.requirements.length > 0 && (
            <Reveal className="panel p-6">
              <h2 className="font-display text-xl font-bold">Entry requirements</h2>
              <ul className="mt-4 space-y-2">
                {event.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                    <Check size={17} className="mt-0.5 shrink-0 text-accent-bright" /> {r}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          <Reveal className="panel p-6">
            <h2 className="font-display text-xl font-bold">Rules</h2>
            <ul className="mt-4 space-y-2">
              {event.rules.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {r}
                </li>
              ))}
            </ul>
          </Reveal>

          {event.winners && (
            <Reveal className="panel p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
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
            </Reveal>
          )}
        </div>

        <Reveal delay={0.05} className="space-y-6">
          <div className="glass p-6">
            <div className="flex items-center gap-2 text-gold">
              <Gift size={18} />
              <h2 className="font-display text-lg font-bold">Rewards</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {event.rewards.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-muted">
                <Users size={16} /> Registered
              </span>
              <span className="telemetry font-semibold">
                {event.joined}/{event.maxParticipants}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/5">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (event.joined / event.maxParticipants) * 100)}%` }} />
            </div>
            {event.status === "upcoming" ? (
              <Link href="/dashboard/events" className="btn btn-primary mt-5 w-full">
                Register to compete
              </Link>
            ) : (
              <p className="mt-5 text-center text-xs text-muted">
                {event.status === "live" ? "This event is live now." : "This event has ended."}
              </p>
            )}
          </div>
        </Reveal>
      </section>
    </>
  );
}
