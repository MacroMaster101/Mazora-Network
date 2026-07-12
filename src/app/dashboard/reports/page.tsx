import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "My Reports" };

export default function ReportsPage() {
  return (
    <>
      <DashHeader title="Reports" subtitle="Player and bug reports you've submitted." />
      <DashEmpty
        icon={<ShieldAlert size={24} />}
        title="No reports submitted"
        message="Reports you file stay private — only you and staff can see them. Thanks for helping keep the network fair."
        cta={{ label: "Report a player", href: "/support/report-player" }}
      />
    </>
  );
}
