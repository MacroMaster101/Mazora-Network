import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscordTicketGuide } from "@/components/shared";
import { findSupportCard } from "@/lib/data/support-settings";

type PageProps = { params: Promise<{ cardId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cardId } = await params;
  const card = await findSupportCard(decodeURIComponent(cardId));
  // Without an explicit canonical this page inherits the /support layout's
  // `alternates.canonical: "/support"`, which told crawlers every card page
  // was a duplicate of the hub and should be dropped from the index.
  return card?.page
    ? {
        title: card.page.title,
        description: card.page.lead,
        alternates: { canonical: `/support/${cardId}` },
        openGraph: {
          title: card.page.title,
          description: card.page.lead,
          url: `/support/${cardId}`,
        },
      }
    : { title: "Support option", robots: { index: false, follow: false } };
}

export default async function ManagedSupportDetailPage({ params }: PageProps) {
  const { cardId } = await params;
  const card = await findSupportCard(decodeURIComponent(cardId));
  if (!card?.enabled || !card.page) notFound();

  return <DiscordTicketGuide {...card.page} />;
}
