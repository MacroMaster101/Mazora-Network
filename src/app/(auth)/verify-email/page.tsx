import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const params = new URLSearchParams({ auth: "verify-email" });
  if (email) params.set("email", email);
  redirect(`/?${params.toString()}`);
}
