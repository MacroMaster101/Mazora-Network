import type { Metadata } from "next";
import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "@/components/ui/app-link";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";
import { LocalTime } from "@/components/events/local-time";
import { getSessionUserId } from "@/lib/auth";
import { getMyEventRegistrations } from "@/lib/data/event-registrations";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Event Registrations" };
export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function DashEventsPage() {
  const userId = await getSessionUserId();
  const registrations = userId ? await getMyEventRegistrations(userId) : [];

  return (
    <>
      <DashHeader title="Event registrations" subtitle="Events you've signed up for." />
      {registrations.length === 0 ? (
        <DashEmpty
          icon={<CalendarDays size={24} />}
          title="You're not registered for any events"
          message="Sign up for tournaments and build competitions. Your registrations appear here."
          cta={{ label: "Browse events", href: "/events" }}
        />
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden border-line-strong bg-card/90 shadow-lg dark:bg-card/80">
          {registrations.map((r) => (
            <li key={r.slug}>
              <Link href={`/events/${r.slug}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-accent/5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-bright">
                  <CalendarDays size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    <LocalTime iso={r.startISO} />
                    {r.gameMode ? `, ${r.gameMode}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    r.status === "live"
                      ? "border-danger/40 text-danger"
                      : r.status === "upcoming"
                        ? "border-accent/40 text-accent-bright"
                        : "border-line-strong text-muted",
                  )}
                >
                  {STATUS_TEXT[r.status] ?? r.status}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
