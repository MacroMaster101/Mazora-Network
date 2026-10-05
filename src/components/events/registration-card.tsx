"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/app-link";
import { CalendarClock, CheckCircle2, Link2, LogIn } from "lucide-react";
import { useToast } from "@/components/ui";
import { Countdown } from "@/components/shared/countdown";
import { leaveEventAction, registerForEventAction } from "@/lib/actions/event-registrations";
import type { EventStatus } from "@/lib/types";
import type { ViewerRegistration } from "@/lib/data/event-registrations";
import { cn } from "@/lib/utils";
import { LocalTime } from "./local-time";

/**
 * The sticky sign-up box on an event page: when it starts, how many places are
 * left, and the one action that applies to this viewer.
 */
export function RegistrationCard({
  eventId,
  slug,
  status,
  startISO,
  endISO,
  joined,
  maxParticipants,
  viewer,
}: {
  eventId: string;
  slug: string;
  status: EventStatus;
  startISO: string;
  endISO: string;
  joined: number;
  maxParticipants: number;
  viewer: ViewerRegistration;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const open = status === "upcoming" || status === "live";
  const left = Math.max(0, maxParticipants - joined);
  const full = left === 0;
  const fill = maxParticipants > 0 ? Math.min(100, (joined / maxParticipants) * 100) : 0;
  const hasEnd = endISO !== startISO;

  const run = (action: typeof registerForEventAction) =>
    startTransition(async () => {
      const result = await action({ eventId });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });

  return (
    <div className="panel event-register-card p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-bright">
          <CalendarClock size={19} />
        </span>
        <div className="min-w-0 text-sm">
          <p className="text-muted">{status === "live" ? "Started" : status === "upcoming" ? "Starts" : "Ran from"}</p>
          <LocalTime iso={startISO} className="block font-semibold text-ink" />
          {hasEnd && (
            <p className="mt-1 text-muted">
              Ends <LocalTime iso={endISO} />
            </p>
          )}
        </div>
      </div>

      {status === "upcoming" && <Countdown to={startISO} big className="mt-5 justify-between" />}

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-ink">
            {joined} {joined === 1 ? "player" : "players"} registered
          </span>
          <span className="text-muted">{full ? "Full" : `${left} ${left === 1 ? "spot" : "spots"} left`}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", full ? "bg-gold" : "bg-accent")}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>

      <div className="mt-6">
        {!open ? (
          <p className="rounded-xl bg-ink/5 px-4 py-3 text-center text-sm text-muted">
            {status === "cancelled" ? "This event was cancelled." : "This event has ended. Registration is closed."}
          </p>
        ) : viewer.registered ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
              <CheckCircle2 size={17} className="shrink-0" />
              You&apos;re registered as {viewer.minecraftUsername ?? "your Minecraft account"}
            </p>
            <button type="button" disabled={pending} onClick={() => run(leaveEventAction)} className="btn btn-ghost btn-sm w-full">
              {pending ? "Leaving…" : "Leave event"}
            </button>
          </div>
        ) : !viewer.signedIn ? (
          <Link href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`} className="btn btn-primary w-full">
            <LogIn size={16} /> Sign in to register
          </Link>
        ) : !viewer.minecraftUsername ? (
          <div className="space-y-2">
            <Link href="/dashboard/minecraft" className="btn btn-primary w-full">
              <Link2 size={16} /> Link your Minecraft account
            </Link>
            <p className="text-center text-xs text-muted">Your Minecraft name is how you appear on the player list.</p>
          </div>
        ) : full ? (
          <button type="button" disabled className="btn btn-ghost w-full">
            Event full
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(registerForEventAction)} className="btn btn-primary w-full">
            {pending ? "Registering…" : `Register as ${viewer.minecraftUsername}`}
          </button>
        )}
      </div>
    </div>
  );
}
