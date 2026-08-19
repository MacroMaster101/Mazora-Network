import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getEditableRules } from "@/lib/data/admin-overview";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";
import { RulesEditor } from "@/components/admin/rules-editor";

export const metadata: Metadata = { title: "Rules · Admin" };

export default async function AdminRulesPage() {
  await requireRole("administrator", "/admin/rules");
  const categories = await getEditableRules();

  if (!categories) {
    return (
      <>
        <DashHeader title="Rules" subtitle="Edit the public rulebook." />
        <AdminPlaceholder
          icon={<ScrollText size={24} />}
          title="Rules service unavailable"
          message="Unable to load the rulebook. Please verify the network connection and try again."
        />
      </>
    );
  }

  const ruleCount = categories.reduce((n, c) => n + c.rules.length, 0);

  return (
    <>
      <DashHeader
        title="Rules"
        subtitle={`${categories.length} categories · ${ruleCount} rules · edits publish immediately`}
      />
      {categories.length === 0 ? (
        <AdminPlaceholder
          icon={<ScrollText size={24} />}
          title="The rulebook is empty"
          message="Create a category to start writing rules, or run the rules seed to load the baseline set."
          technical={false}
        />
      ) : (
        <RulesEditor categories={categories} />
      )}
    </>
  );
}
