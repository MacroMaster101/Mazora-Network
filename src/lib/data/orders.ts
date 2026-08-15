import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
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
    // Falling back to totalAmount keeps orders placed before migration 021
    // rendering correctly, with a zero discount.
    subtotal: Number(row.subtotalAmount ?? row.totalAmount ?? 0),
    discount: Number(row.discountAmount ?? 0),
    creatorCode: row.creatorCode,
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
 *
 * The query is scoped with `inArray` rather than filtered in JavaScript: an
 * unfiltered select pulled the whole order_items table into the lambda on every
 * render of a member's own purchases page, which grows without bound and costs
 * far more than the handful of rows actually being displayed.
 */
async function attachItems(rows: OrderRow[]): Promise<StoreOrder[]> {
  const db = getDb();
  if (!db || rows.length === 0) return rows.map((row) => toOrder(row, []));

  const ids = rows.map((row) => row.id);
  const items = await db
    .select()
    .from(schema.orderItems)
    .where(inArray(schema.orderItems.orderId, ids));
  const byOrder = new Map<string, ItemRow[]>();
  for (const item of items) {
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
 * Strips the direct identifiers from a member's order history ahead of account
 * deletion, keeping the commercial record itself.
 *
 * Migration 020 is named "retain_anonymized_order_history", but all it does is
 * make `orders.user_id` nullable with ON DELETE SET NULL. Nulling the auth id
 * alone anonymises nothing: the row still carried `discord_id` — a permanent
 * third-party identifier — plus `discord_username`, `minecraft_username` and
 * whatever free text the buyer typed into `notes`. The retained record
 * identified the person as well as it ever had, while the deletion UI told them
 * their data was gone.
 *
 * `reference`, the amounts, `status`, `creator_code` and the line items are
 * deliberately kept — reconciliation and chargeback defence are what the
 * retention exists for, and none of them names anybody.
 *
 * Must run BEFORE the auth user is deleted: afterwards `user_id` is already
 * null and these rows can no longer be found.
 */
export async function anonymiseOrdersForUser(userId: string): Promise<boolean> {
  const db = getDb();
  /*
    No database means no order rows exist to carry identifiers, so there is
    nothing to scrub and the caller should not be blocked. Returning false here
    made the two deletion paths disagree again in a new direction: the
    self-service path refused to delete at all, while the admin path — which
    called this inside its own `if (db)` — skipped straight to deleting the auth
    user. Vacuous success is the honest answer.
  */
  if (!db) return true;
  if (!userId) return false;
  try {
    await db
      .update(schema.orders)
      .set({
        discordId: null,
        discordUsername: null,
        minecraftUsername: null,
        notes: null,
      })
      .where(eq(schema.orders.userId, userId));
    return true;
  } catch (error) {
    console.error("Failed to anonymise order history before account deletion:", error);
    return false;
  }
}

/**
 * Atomically claims an order for confirmation. Returns false when the click
 * should be ignored entirely.
 *
 * Confirm is the one decision carrying expensive, buyer-visible side effects —
 * it opens a private ticket channel and DMs the buyer — so it must run at most
 * once per order. Discord buttons carry no nonce and stay clickable forever, so
 * the same signed interaction can arrive twice from a double-click, a client
 * retry, or a replay inside the signature's five-minute freshness window.
 *
 * An order is always claimable while it is still open. `completed` and
 * `rejected` are excluded on purpose — they are terminal, and a stale message
 * must not drag them backwards.
 *
 * `allowTicketlessRetry` additionally re-opens an order that reached
 * `confirmed` but has no ticket channel recorded, so a Discord outage during
 * ticket creation does not strand it with no way for staff to try again.
 *
 * That allowance MUST be off when no ticket category is configured. In that
 * setup `ticket_channel_id` is never written for any order, so the condition
 * would match forever and every press of Confirm would re-run the flow and DM
 * the buyer again — precisely the duplicate this claim exists to prevent.
 */
export async function claimOrderForConfirm(
  reference: string,
  handledBy: string,
  allowTicketlessRetry: boolean,
): Promise<boolean> {
  const db = getDb();
  if (!db || !reference) return false;
  try {
    const openStatuses = inArray(schema.orders.status, ["pending", "awaiting_discord_join"]);
    const rows = await db
      .update(schema.orders)
      .set({ status: "confirmed", handledBy, handledAt: new Date() })
      .where(
        and(
          eq(schema.orders.reference, reference),
          allowTicketlessRetry
            ? or(
                openStatuses,
                and(eq(schema.orders.status, "confirmed"), isNull(schema.orders.ticketChannelId)),
              )
            : openStatuses,
        ),
      )
      .returning({ id: schema.orders.id });
    return rows.length > 0;
  } catch (error) {
    console.error("Failed to claim order for confirmation:", error);
    return false;
  }
}

/**
 * Records a staff decision made in Discord. Matched on the public reference,
 * which is the only identifier the Discord message carries.
 *
 * Pass `from` to make the transition conditional on the order's current status.
 * Discord buttons live on the message forever and carry no nonce, so the same
 * signed click can arrive twice — from a double-click, a retry, or a replay
 * inside the signature's five-minute freshness window. Matching on `reference`
 * alone let that re-run a terminal order: a second press of Confirm on a
 * `completed` order would drag it back to `confirmed`, overwrite who handled it,
 * and — because the caller never re-read the status — open a *second* ticket
 * channel and send the buyer a *second* DM.
 *
 * Returns whether a row actually changed, so the caller can stop before doing
 * anything with a side effect.
 */
export async function markOrderDecision(
  reference: string,
  status: OrderStatus,
  handledBy: string,
  ticketChannelId?: string | null,
  from?: OrderStatus[],
): Promise<boolean> {
  const db = getDb();
  if (!db || !reference) return false;
  try {
    const rows = await db
      .update(schema.orders)
      .set({
        status,
        handledBy,
        handledAt: new Date(),
        ...(ticketChannelId ? { ticketChannelId } : {}),
      })
      .where(
        from && from.length > 0
          ? and(eq(schema.orders.reference, reference), inArray(schema.orders.status, from))
          : eq(schema.orders.reference, reference),
      )
      .returning({ id: schema.orders.id });
    return rows.length > 0;
  } catch (error) {
    console.error("Failed to record order decision:", error);
    return false;
  }
}
