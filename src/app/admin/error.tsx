"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] min-h-svh overflow-y-auto bg-[rgb(var(--base))]">
      <ErrorScreen
        error={error}
        reset={reset}
        code="ADMIN SYSTEM ERROR"
        title="This admin page could not load."
        copy="An unexpected issue interrupted this staff dashboard page. Try refreshing, or return to the Control Room."
        returnHref="/admin"
        returnLabel="Control room"
        compact
      />
    </div>
  );
}
