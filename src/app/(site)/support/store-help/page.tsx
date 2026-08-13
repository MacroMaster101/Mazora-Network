import { publicPageMetadata } from "@/lib/seo";
import { DiscordTicketGuide } from "@/components/shared";
import { getSupportCard } from "@/lib/data/support-settings";

export const metadata = publicPageMetadata({
  title: "Payment & Store Help",
  description: "Get private Discord support for Mazora Network store and payment questions.",
  path: "/support/store-help",
});

export default async function StoreHelpPage() {
  const page = (await getSupportCard("payment")).page!;
  return (
    <DiscordTicketGuide {...page} />
  );
}
