import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <DashHeader title="Notifications" subtitle="Ticket replies, appeal decisions, rewards and more." />
      <DashEmpty
        icon={<Bell size={24} />}
        title="You're all caught up"
        message="Notifications about your tickets, appeals, purchases and rewards will show up here."
      />
    </>
  );
}
