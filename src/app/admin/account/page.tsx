import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AccountSettings } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "My Account · Admin" };

/** A staff member's own account settings, inside the admin shell. */
export default async function AdminAccountPage() {
  await requireRole("helper", "/admin/account");
  return <AccountSettings loginNext="/admin/account" />;
}
