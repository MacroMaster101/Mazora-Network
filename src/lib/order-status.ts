/**
 * Pure store-order shapes and labels with no server-only dependencies (no
 * database client, no "server-only"). Safe to import from Client Components.
 * The repositories that actually read and write orders live in
 * "@/lib/data/orders", which must never be imported from client code.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "awaiting_discord_join"
  /** Ticket closed by staff: the order was delivered, not merely accepted. */
  | "completed";

export interface OrderLine {
  name: string;
  quantity: number;
  price: number;
}

export interface StoreOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  total: number;
  minecraftUsername: string | null;
  discordUsername: string | null;
  discordId: string | null;
  notes: string | null;
  handledBy: string | null;
  handledAt: string | null;
  ticketChannelId: string | null;
  createdAt: string;
  items: OrderLine[];
}

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "rejected",
  "awaiting_discord_join",
  "completed",
];

export function toOrderStatus(value: string | null): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "pending";
}

/** Human label for a status, shared by the member and admin views. */
export function orderStatusLabel(status: OrderStatus): string {
  if (status === "completed") return "Completed";
  if (status === "confirmed") return "Confirmed";
  if (status === "rejected") return "Declined";
  if (status === "awaiting_discord_join") return "Awaiting Discord join";
  return "Awaiting staff review";
}
