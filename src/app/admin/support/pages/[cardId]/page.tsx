import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSupportCards } from "@/lib/data/support-settings";
import { saveSupportCardsAction } from "@/lib/actions/support-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportCardDetailEditor } from "@/components/admin/support-card-detail-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Support page details · Admin" };

export default async function AdminSupportCardDetailsPage({ params }: { params: Promise<{ cardId: string }> }) {
  await requireRole("administrator", "/admin/support/pages");
  const { cardId } = await params;
  const cards = await getSupportCards();
  const card = cards.find((item) => item.id === decodeURIComponent(cardId));
  if (!card) notFound();

  return (
    <div className="admin-store-page">
      <DashHeader title={card.title} subtitle={`${card.badge} · ${card.page ? "managed detail page" : card.external ? "external destination" : "linked route"}`} action={<div className="store-admin-page-actions"><Link href="/admin/support/pages" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> All Support cards</Link><a href={card.href} target={card.external ? "_blank" : undefined} rel={card.external ? "noreferrer" : undefined} className="btn btn-ghost btn-sm">Public destination <ExternalLink size={15} /></a></div>} />
      <SupportCardDetailEditor cards={cards} cardId={card.id} saveAction={saveSupportCardsAction} />
    </div>
  );
}
