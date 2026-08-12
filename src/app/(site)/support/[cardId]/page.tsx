import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscordTicketGuide } from "@/components/shared";
import { findSupportCard } from "@/lib/data/support-settings";

type PageProps = { params: Promise<{ cardId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cardId } = await params;
  const card = await findSupportCard(decodeURIComponent(cardId));
  return card?.page
    ? { title: card.page.title, description: card.page.lead }
    : { title: "Support option" };
}

export default async function ManagedSupportDetailPage({ params }: PageProps) {
  const { cardId } = await params;
  const card = await findSupportCard(decodeURIComponent(cardId));
  if (!card?.enabled || !card.page) notFound();

  return <DiscordTicketGuide {...card.page} />;
}
