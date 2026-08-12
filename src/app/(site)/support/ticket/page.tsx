import type { Metadata } from "next";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata: Metadata = {
  title: "Open a Support Ticket",
  description: "Open a private Discord ticket with the Mazora Network support team.",
};

export default async function SupportTicketPage() {
  const page = (await getSupportCard("ticket")).page!;
  return (
    <DiscordTicketGuide
      {...page}
    />
  );
}
