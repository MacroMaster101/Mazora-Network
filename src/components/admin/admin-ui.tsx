import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { DashEmpty } from "@/components/dashboard/dash-ui";

export { AdminTable, type Column } from "./admin-table";

const FRIENDLY_UNAVAILABLE_NOTE =
  "This management tool is coming soon. It will appear here when it is ready for staff use.";

export async function ReadOnlyBanner({ note }: { note?: string }) {
  const session = await getSession();
  const showDiagnostics = session?.role === "it";

  return (
    <div className="glass mb-5 flex items-center gap-3 p-4">
      <Lock size={16} className="shrink-0 text-gold" />
      <p className="text-sm text-muted">
        {showDiagnostics
          ? note ?? "Read-only preview. Creating and editing content activates once the database and audit logging are connected."
          : FRIENDLY_UNAVAILABLE_NOTE}
      </p>
    </div>
  );
}

export async function AdminPlaceholder({
  icon,
  title,
  message,
  technical = true,
  friendlyTitle = "Coming soon",
  friendlyMessage = FRIENDLY_UNAVAILABLE_NOTE,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  technical?: boolean;
  friendlyTitle?: string;
  friendlyMessage?: string;
}) {
  const session = await getSession();
  const showDiagnostics = session?.role === "it";

  return (
    <DashEmpty
      icon={icon}
      title={technical && !showDiagnostics ? friendlyTitle : title}
      message={technical && !showDiagnostics ? friendlyMessage : message}
    />
  );
}
