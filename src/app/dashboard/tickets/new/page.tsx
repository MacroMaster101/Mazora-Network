import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportForm, type FieldConfig } from "@/components/shared/support-form";
import { submitTicket } from "@/lib/actions/support";

export const metadata: Metadata = { title: "New Ticket" };

const fields: FieldConfig[] = [
  { name: "subject", label: "Subject", required: true, placeholder: "Short summary of your issue" },
  { name: "category", label: "Category", type: "select", required: true, options: ["General", "Technical", "Account", "Minecraft Server", "Store", "Payment", "Other"] },
  { name: "priority", label: "Priority", type: "select", required: true, options: ["Low", "Normal", "High", "Urgent"] },
  { name: "message", label: "Describe your issue", type: "textarea", required: true, placeholder: "Give us as much detail as you can…" },
];

export default function NewTicketPage() {
  return (
    <>
      <Link href="/dashboard/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to tickets
      </Link>
      <DashHeader title="Open a support ticket" subtitle="Tell us what's going on and we'll help." />
      <div className="max-w-2xl">
        <SupportForm action={submitTicket} fields={fields} submitLabel="Open ticket" />
      </div>
    </>
  );
}
