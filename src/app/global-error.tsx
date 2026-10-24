"use client";

import { GlobalErrorCard } from "@/components/shared/global-error-card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#08060e", color: "#f9f7fc", fontFamily: "system-ui, sans-serif" }}>
        <GlobalErrorCard digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}