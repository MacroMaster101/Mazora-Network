import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { DashEmpty } from "@/components/dashboard/dash-ui";

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

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

/** Simple read-only admin table. */
export function AdminTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
            {columns.map((c) => (
              <th key={c.header} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-ink/[0.02]">
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
