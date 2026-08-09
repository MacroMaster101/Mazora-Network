"use client";

import { ErrorScreen } from "@/components/shared/error-screen";
import "@/styles/globals.css";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
