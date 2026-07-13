import type { ReactNode } from "react";

export function AuthCard({
  kicker = "Player account",
  title,
  subtitle,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="auth-card">
      <div className="auth-card-heading">
        <p className="auth-card-kicker"><span /> {kicker}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="auth-card-body">{children}</div>
    </section>
  );
}
