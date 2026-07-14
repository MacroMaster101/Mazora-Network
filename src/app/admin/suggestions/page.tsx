import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Suggestions · Admin" };

export default async function AdminSuggestionsPage() {
  await requireRole("helper", "/admin/suggestions");
  return (
    <>
      <DashHeader title="Suggestions" subtitle="Review community ideas." />
      <AdminPlaceholder
        icon={<Lightbulb size={24} />}
        title="No suggestions yet"
        message="Community suggestions and their upvotes appear here with status controls once the database is connected."
      />
    </>
  );
}
