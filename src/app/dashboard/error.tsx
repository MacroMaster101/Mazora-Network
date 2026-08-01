"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} code="PLAYER PORTAL ERROR" title="Your dashboard could not sync." returnHref="/dashboard" returnLabel="Dashboard home" compact />;
}