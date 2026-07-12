import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getEvents } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { fmtDate } from "@/lib/utils";
import type { EventItem } from "@/lib/types";

export const metadata: Metadata = { title: "Events · Admin" };

export default async function AdminEventsPage() {
  const events = await getEvents();
  const columns: Column<EventItem>[] = [
    { header: "Event", cell: (e) => <span className="font-semibold">{e.title}</span> },
    { header: "Mode", cell: (e) => <span className="text-muted">{e.mode}</span> },
    { header: "Status", cell: (e) => <span className="capitalize text-muted">{e.status}</span> },
    { header: "Registered", cell: (e) => <span className="telemetry">{e.joined}/{e.maxParticipants}</span> },
    { header: "Starts", align: "right", cell: (e) => <span className="telemetry text-muted">{fmtDate(e.startISO)}</span> },
  ];
  return (
    <>
      <DashHeader
        title="Events"
        subtitle={`${events.length} events`}
        action={
          <button className="btn btn-primary btn-sm opacity-60" disabled title="Enabled with the database">
            <Plus size={15} /> New event
          </button>
        }
      />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={events} />
    </>
  );
}
