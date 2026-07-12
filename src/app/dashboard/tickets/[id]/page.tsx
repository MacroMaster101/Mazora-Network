import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/dashboard/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to tickets
      </Link>
      <DashHeader title={`Ticket #${id}`} subtitle="Ticket conversation." />
      <DashEmpty
        icon={<MessageSquare size={24} />}
        title="Ticket threads arrive with the database"
        message="Once Supabase is connected, this page shows the full conversation, replies, attachments and status controls."
        cta={{ label: "Back to tickets", href: "/dashboard/tickets" }}
      />
    </>
  );
}
