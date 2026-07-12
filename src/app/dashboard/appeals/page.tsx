import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "My Appeals" };

export default function AppealsPage() {
  return (
    <>
      <DashHeader title="Ban appeals" subtitle="Appeals you've submitted and their status." />
      <DashEmpty
        icon={<Gavel size={24} />}
        title="No appeals submitted"
        message="If you've been punished and think it was a mistake, you can submit an appeal for a moderator to review."
        cta={{ label: "Submit an appeal", href: "/support/appeal" }}
      />
    </>
  );
}
