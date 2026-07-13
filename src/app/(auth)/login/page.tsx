import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const params = new URLSearchParams({ auth: "login" });
  if (next) params.set("next", next);
  if (error) params.set("error", error);
  redirect(`/?${params.toString()}`);
}
