import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Confirm email" };

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const params = new URLSearchParams({ auth: "confirm-email" });
  if (tokenHash) params.set("token_hash", tokenHash);
  if (type) params.set("type", type);
  redirect(`/?${params.toString()}`);
}
