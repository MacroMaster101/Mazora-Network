"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} compact />;
}