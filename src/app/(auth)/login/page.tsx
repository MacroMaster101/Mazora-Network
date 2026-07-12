import type { Metadata } from "next";
import { AuthCard, DemoAuthNote } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthCard title="Welcome back" subtitle="Log in to your Mazora account.">
        <LoginForm next={next} />
      </AuthCard>
      <DemoAuthNote />
    </>
  );
}
