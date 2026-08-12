import type { Metadata } from "next";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata: Metadata = {
  title: "Report a Bug",
  description: "Report a Minecraft server or website bug privately to the Mazora team.",
};

export default async function ReportBugPage() {
  const page = (await getSupportCard("report-bug")).page!;
  return (
    <DiscordTicketGuide {...page} />
  );
}
