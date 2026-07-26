import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  return <AccountSettings loginNext="/dashboard/settings" />;
}
