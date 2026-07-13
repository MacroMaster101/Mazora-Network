import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  redirect("/?auth=forgot-password");
}
