"use client";

import { ErrorScreen } from "@/components/shared/error-screen";
import { useAdminDiagnostics } from "@/components/admin/admin-diagnostics-context";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const showDiagnostics = useAdminDiagnostics();

  return (
    <ErrorScreen
      error={showDiagnostics ? error : undefined}
      reset={reset}
      code="ADMIN CONSOLE ERROR"
      title="This admin page could not load."
      copy={showDiagnostics ? error.message || "An unexpected console error stopped this dashboard." : "A temporary site error interrupted this staff page. Try again, or return to the control room without losing your work."}
      returnHref="/admin"
      returnLabel="Control room"
      compact
    />
  );
}