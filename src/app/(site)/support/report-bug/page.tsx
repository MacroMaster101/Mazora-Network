import { publicPageMetadata } from "@/lib/seo";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Report a Bug",
  description: "Report a Minecraft server or website bug privately to the Mazora team.",
  path: "/support/report-bug",
});

export default async function ReportBugPage() {
  const page = (await getSupportCard("report-bug")).page!;
  return (
    <DiscordTicketGuide {...page} />
  );
}
