import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { Metric } from "@/components/admin/control-room";
import { getFormsConfig } from "@/lib/data/forms-config";
import { AdminFormToggleCard } from "@/components/admin/admin-form-toggle";

export const metadata: Metadata = { title: "Appeals & Applications · Admin" };

export default async function AdminAppealsPage() {
  await requireRole("helper", "/admin/appeals");
  const config = await getFormsConfig();

  const activeCount = Object.values(config).filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <DashHeader
        title="Appeals & Applications"
        subtitle="Manage form status, toggle intake availability, and edit Google Form links directly."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Appeals Intake"
          value={config.appeals?.enabled ? "Active" : "Paused"}
          detail="Ban & Mute Form"
          live={config.appeals?.enabled}
        />
        <Metric
          label="Staff Recruitment"
          value={config.staff?.enabled ? "Active" : "Paused"}
          detail="Helper & Mod Roles"
          live={config.staff?.enabled}
        />
        <Metric
          label="Creator Program"
          value={config.creator?.enabled ? "Active" : "Paused"}
          detail="Media Partner Form"
          live={config.creator?.enabled}
        />
        <Metric
          label="Active Forms"
          value={`${activeCount} / 3`}
          detail="Publicly available"
          live={activeCount > 0}
        />
      </div>

      <div className="panel flex items-start gap-4 p-5 rounded-2xl border border-accent/25 bg-card/95 backdrop-blur-xl shadow-lg">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-bright border border-accent/25">
          <KeyRound size={20} />
        </div>
        <div>
          <h4 className="font-display text-sm font-bold text-ink">
            Google Form Responses & Owner Access
          </h4>
          <p className="text-xs text-muted leading-relaxed font-medium mt-1">
            Form submissions are stored inside Google Drive. To view, review, or edit submitted responses, <strong>ask the Google Form owner to invite your Google account as an Editor or Viewer</strong> on the Google Form / Google Sheet.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <AdminFormToggleCard config={config.appeals} iconName="appeals" />
        <AdminFormToggleCard config={config.staff} iconName="staff" />
        <AdminFormToggleCard config={config.creator} iconName="creator" />
      </div>
    </div>
  );
}
