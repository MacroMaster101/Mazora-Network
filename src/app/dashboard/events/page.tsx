import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Event Registrations" };

export default function DashEventsPage() {
  return (
    <>
      <DashHeader title="Event registrations" subtitle="Events you've signed up for." />
      <DashEmpty
        icon={<CalendarDays size={24} />}
        title="You're not registered for any events"
        message="Sign up for tournaments and build competitions — your registrations and results appear here."
        cta={{ label: "Browse events", href: "/events" }}
      />
    </>
  );
}
