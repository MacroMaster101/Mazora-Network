import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="glass p-7 sm:p-8">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function DemoAuthNote() {
  return (
    <p className="mt-4 text-center text-xs text-muted">
      Preview build — sign in with any details to explore. Use <span className="telemetry text-ink">admin</span> or{" "}
      <span className="telemetry text-ink">owner</span> as the username to preview staff dashboards.
    </p>
  );
}
