import { publicPageMetadata } from "@/lib/seo";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Report a Player",
  description: "Privately report cheating, harassment, scamming, or other rule-breaking to Mazora staff.",
  path: "/support/report-player",
});

export default async function ReportPlayerPage() {
  const page = (await getSupportCard("report-player")).page!;
  return (
    <DiscordTicketGuide {...page} />
  );
}
