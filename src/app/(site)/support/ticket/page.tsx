import { publicPageMetadata } from "@/lib/seo";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Open a Support Ticket",
  description: "Open a private Discord ticket with the Mazora Network support team.",
  path: "/support/ticket",
});

export default async function SupportTicketPage() {
  const page = (await getSupportCard("ticket")).page!;
  return (
    <DiscordTicketGuide
      {...page}
    />
  );
}
