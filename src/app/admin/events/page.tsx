import type { Metadata } from "next";
import { EVENTS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getDb, schema } from "@/lib/db/client";
import { asc } from "drizzle-orm";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { EventsManager, type AdminEventData } from "@/components/admin/events-manager";

export const metadata: Metadata = { title: "Events · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEventsPage() {
  await requireModuleAccess(EVENTS_PERMISSION_KEY, "/admin/events");

  const db = getDb();
  let events: AdminEventData[] = [];

  if (db) {
    try {
      const rows = await db.select().from(schema.events).orderBy(asc(schema.events.startAt));
      events = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description ?? "",
        gameMode: r.gameMode || "Survival SMP",
        status: (r.status as AdminEventData["status"]) || "upcoming",
        startAt: r.startAt instanceof Date ? r.startAt.toISOString() : String(r.startAt),
        endAt: r.endAt ? (r.endAt instanceof Date ? r.endAt.toISOString() : String(r.endAt)) : undefined,
        maxParticipants: r.maxParticipants ?? 100,
        rewards: Array.isArray(r.rewards) ? (r.rewards as string[]) : [],
      }));
    } catch (e) {
      console.error("Failed to load admin events", e);
    }
  }

  return (
    <div className="space-y-6">
      <DashHeader
        title="Events & Tournaments"
        subtitle="Manage upcoming server competitions, schedules, reward packages, and participant caps."
      />
      <EventsManager initialEvents={events} />
    </div>
  );
}
