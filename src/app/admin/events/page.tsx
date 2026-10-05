import type { Metadata } from "next";
import { EVENTS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getDb, schema } from "@/lib/db/client";
import { asc, eq } from "drizzle-orm";
import { getRegistrationCounts } from "@/lib/data/event-registrations";
import { effectiveEventStatus } from "@/lib/events/status";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { EventsManager, type AdminEventData, type RewardStoreItem } from "@/components/admin/events-manager";

export const metadata: Metadata = { title: "Events · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEventsPage() {
  await requireModuleAccess(EVENTS_PERMISSION_KEY, "/admin/events");

  const db = getDb();
  let events: AdminEventData[] = [];
  let gameModes: string[] = [];
  let storeItems: RewardStoreItem[] = [];

  if (db) {
    try {
      const rows = await db.select().from(schema.events).orderBy(asc(schema.events.startAt));
      const registered = await getRegistrationCounts(rows.map((r) => r.id));
      events = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description ?? "",
        imageUrl: r.imageUrl ?? null,
        gameMode: r.gameMode || "Survival SMP",
        status: (r.status as AdminEventData["status"]) || "upcoming",
        liveStatus: effectiveEventStatus(r),
        startAt: r.startAt instanceof Date ? r.startAt.toISOString() : String(r.startAt),
        endAt: r.endAt ? (r.endAt instanceof Date ? r.endAt.toISOString() : String(r.endAt)) : undefined,
        maxParticipants: r.maxParticipants ?? 100,
        registered: registered.get(r.id) ?? 0,
        rewards: Array.isArray(r.rewards) ? (r.rewards as string[]) : [],
      }));
    } catch (e) {
      console.error("Failed to load admin events", e);
    }
    try {
      const modes = await db
        .select({ name: schema.gameModes.name })
        .from(schema.gameModes)
        .orderBy(asc(schema.gameModes.sortOrder));
      gameModes = modes.map((m) => m.name);
    } catch (e) {
      console.error("Failed to load game modes for events", e);
    }
    try {
      storeItems = await db
        .select({ name: schema.products.name, category: schema.products.category })
        .from(schema.products)
        .where(eq(schema.products.enabled, true))
        .orderBy(asc(schema.products.category), asc(schema.products.sortOrder));
    } catch (e) {
      console.error("Failed to load store items for event rewards", e);
    }
  }

  return (
    <div className="space-y-6">
      <DashHeader
        title="Events & Tournaments"
        subtitle="Manage upcoming server competitions, schedules, reward packages, and participant caps."
      />
      <EventsManager initialEvents={events} gameModes={gameModes} storeItems={storeItems} />
    </div>
  );
}
