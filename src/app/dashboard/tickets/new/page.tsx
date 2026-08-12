import { redirect } from "next/navigation";

export default function LegacyNewTicketPage() {
  redirect("/support/ticket");
}
