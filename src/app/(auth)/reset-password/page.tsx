import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  redirect("/?auth=reset-password");
}
