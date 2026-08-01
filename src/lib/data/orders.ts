import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { toOrderStatus, type OrderStatus, type StoreOrder } from "@/lib/order-status";

/**
 * Store order repositories.
 *
 * Orders are placed through the site and actioned by staff in Discord, so the
 * row here is the durable record of something that also lives as a Discord
 * message. The reference is what ties the two together.
 *
 * Shapes and labels live in "@/lib/order-status" so Client Components can use
 * them without dragging the database client into the browser bundle.
 */

type OrderRow = typeof schema.orders.$inferSelect;
type ItemRow = typeof schema.orderItems.$inferSelect;

function toOrder(row: OrderRow, items: ItemRow[]): StoreOrder {
  return {
    id: row.id,
    reference: row.reference ?? "—",
    status: toOrderStatus(row.status),
    total: Number(row.totalAmount ?? 0),
    minecraftUsername: row.minecraftUsername,
    discordUsername: row.discordUsername,
    discordId: row.discordId,
    notes: row.notes,
    handledBy: row.handledBy,
    handledAt: row.handledAt ? row.handledAt.toISOString() : null,
    ticketChannelId: row.ticketChannelId,
    createdAt: row.createdAt.toISOString(),
    items: items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: Number(item.price ?? 0),
    })),
  };
}

/**
 * Loads orders and their line items. Items are fetched in one query and grouped
 * in memory rather than per order, so the list does not fan out into N+1
 * queries as order volume grows.
 */
async function attachItems(rows: OrderRow[]): Promise<StoreOrder[]> {
  const db = getDb();
  if (!db || rows.length === 0) return rows.map((row) => toOrder(row, []));

  const ids = rows.map((row) => row.id);
  const items = await db.select().from(schema.orderItems);
  const byOrder = new Map<string, ItemRow[]>();
  for (const item of items) {
    if (!ids.includes(item.orderId)) continue;
    const list = byOrder.get(item.orderId) ?? [];
    list.push(item);
    byOrder.set(item.orderId, list);
  }
  return rows.map((row) => toOrder(row, byOrder.get(row.id) ?? []));
}

/** Every order, newest first. Admin only — callers must authorize first. */
export async function getAllOrders(): Promise<StoreOrder[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
    return await attachItems(rows);
  } catch (error) {
    console.error("Failed to load orders:", error);
    return [];
  }
}

/** Orders belonging to one account, newest first. */
export async function getOrdersForUser(userId: string): Promise<StoreOrder[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(desc(schema.orders.createdAt));
    return await attachItems(rows);
  } catch (error) {
    console.error("Failed to load orders for user:", error);
    return [];
  }
}

/**
 * Records a staff decision made in Discord. Matched on the public reference,
 * which is the only identifier the Discord message carries.
 */
export async function markOrderDecision(
  reference: string,
  status: OrderStatus,
  handledBy: string,
  ticketChannelId?: string | null,
): Promise<void> {
  const db = getDb();
  if (!db || !reference) return;
  try {
    await db
      .update(schema.orders)
      .set({
        status,
        handledBy,
        handledAt: new Date(),
        ...(ticketChannelId ? { ticketChannelId } : {}),
      })
      .where(eq(schema.orders.reference, reference));
  } catch (error) {
    console.error("Failed to record order decision:", error);
  }
}
