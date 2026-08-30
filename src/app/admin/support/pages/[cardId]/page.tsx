import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SUPPORT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getSupportCards } from "@/lib/data/support-settings";
import { saveSupportCardsAction } from "@/lib/actions/support-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportCardDetailEditor } from "@/components/admin/support-card-detail-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Support page details · Admin" };

export default async function AdminSupportCardDetailsPage({ params }: { params: Promise<{ cardId: string }> }) {
  await requireModuleAccess(SUPPORT_PERMISSION_KEY, "/admin/support/pages");
  const { cardId } = await params;
  // The suggestions card has its own dedicated editor. Its managed-page fields
  // (ticket type, preparation checklist, privacy note) are never rendered by
  // /support/suggestions — that route draws the board instead — so the shared
  // editor here would offer three sections that cannot change the page. Send
  // staff to the editor that only shows what actually applies, whichever door
  // they came through.
  if (decodeURIComponent(cardId) === "suggestions") redirect("/admin/suggestions/page-edit");

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
