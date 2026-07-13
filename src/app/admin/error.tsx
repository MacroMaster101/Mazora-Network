"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} code="CONSOLE ERROR" title="The network console stalled." compact />;
}