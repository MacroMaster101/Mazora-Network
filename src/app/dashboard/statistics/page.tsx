import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Statistics" };

export default async function StatisticsPage() {
  await requireSession("/dashboard/statistics");

  return (
    <>
      <DashHeader title="Your statistics" subtitle="Minecraft statistics will arrive with account linking." />
      <DashEmpty
        icon={<BarChart3 size={24} />}
        title="Statistics are coming soon"
        message="Player linking and live server statistics are currently unavailable. We will announce them when the integration is ready."
      />
    </>
  );
}