"use client";

import { ErrorScreen } from "@/components/shared/error-screen";
import { useAdminDiagnostics } from "@/components/admin/admin-diagnostics-context";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const showDiagnostics = useAdminDiagnostics();

  return (
    <ErrorScreen
      error={showDiagnostics ? error : undefined}
      reset={reset}
      code={showDiagnostics ? "CONSOLE ERROR" : "STAFF TOOL"}
      title={showDiagnostics ? "The network console stalled." : "This staff tool is coming soon."}
      copy={
        showDiagnostics
          ? error.message || "An unexpected console error stopped this dashboard."
          : "This area is not available for your staff role yet. You can safely return to the control room."
      }
      compact
    />
  );
}