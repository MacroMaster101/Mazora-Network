import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  redirect("/?auth=register");
}
