import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Support Tickets" };

export default function TicketsPage() {
  return (
    <>
      <DashHeader
        title="Support tickets"
        subtitle="Your conversations with the team."
        action={
          <Link href="/dashboard/tickets/new" className="btn btn-primary btn-sm">
            <Plus size={15} /> New ticket
          </Link>
        }
      />
      <DashEmpty
        icon={<Ticket size={24} />}
        title="You haven't opened any tickets yet"
        message="Need help with your account, a purchase or something technical? Open a ticket and we'll get back to you."
        cta={{ label: "Open a ticket", href: "/dashboard/tickets/new" }}
      />
    </>
  );
}
