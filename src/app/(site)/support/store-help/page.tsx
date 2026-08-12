import type { Metadata } from "next";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata: Metadata = {
  title: "Payment & Store Help",
  description: "Get private Discord support for Mazora Network store and payment questions.",
};

export default async function StoreHelpPage() {
  const page = (await getSupportCard("payment")).page!;
  return (
    <DiscordTicketGuide {...page} />
  );
}
