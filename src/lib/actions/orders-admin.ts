"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId, hasAtLeast } from "@/lib/auth";
import { canManageOrders } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";

export type OrderAdminResult = { ok: boolean; message: string };

const idSchema = z.string().uuid();
const decisionSchema = z.enum(["confirmed", "rejected"]);

async function orderEditor() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await canManageOrders(session, userId)) ? session : null;
}

function refreshOrders() {
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/purchases");
  revalidatePath("/admin/account/purchases");
}

export async function updateOrderDecisionAction(
  orderId: string,
  decision: "confirmed" | "rejected",
): Promise<OrderAdminResult> {
  const session = await orderEditor();
  if (!session) return { ok: false, message: "You do not have permission to manage orders." };

  const parsedId = idSchema.safeParse(orderId);
  const parsedDecision = decisionSchema.safeParse(decision);
  if (!parsedId.success || !parsedDecision.success) return { ok: false, message: "Invalid order action." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const allowedFrom = decision === "confirmed"
    ? ["pending", "awaiting_discord_join"]
    : ["pending", "awaiting_discord_join", "confirmed"];

  try {
    const updated = await db.transaction(async (tx) => {
      const [order] = await tx
        .update(schema.orders)
        .set({
          status: decision,
          handledBy: session.username,
          handledAt: new Date(),
        })
        .where(and(eq(schema.orders.id, parsedId.data), inArray(schema.orders.status, allowedFrom)))
        .returning({ id: schema.orders.id, reference: schema.orders.reference });

      if (!order) return null;

      await tx.insert(schema.auditLogs).values({
        action: decision === "confirmed" ? "order.accept" : "order.decline",
        targetType: "order",
        targetId: order.id,
        metadata: { reference: order.reference, by: session.username },
      });
      return order;
    });

    if (!updated) {
      return {
        ok: false,
        message: "This order was already completed, declined, or changed by another staff member.",
      };
    }

    refreshOrders();
    return {
      ok: true,
      message: decision === "confirmed" ? "Order accepted and marked in progress." : "Order declined.",
    };
  } catch (error) {
    console.error("Failed to update order from admin:", error);
    return { ok: false, message: "The order could not be updated." };
  }
}

export async function deleteOrderAction(orderId: string, confirmation: string): Promise<OrderAdminResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only Owner or IT can permanently delete order records." };
  }

  const parsedId = idSchema.safeParse(orderId);
  if (!parsedId.success) return { ok: false, message: "Invalid order." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: schema.orders.id, reference: schema.orders.reference, status: schema.orders.status })
        .from(schema.orders)
        .where(eq(schema.orders.id, parsedId.data))
        .limit(1);
      if (!order) return { ok: false as const, message: "That order no longer exists." };

      const reference = order.reference ?? "";
      if (!reference || confirmation.trim() !== reference) {
        return { ok: false as const, message: "Type the order reference exactly to confirm deletion." };
      }

      await tx.delete(schema.orders).where(eq(schema.orders.id, order.id));
      await tx.insert(schema.auditLogs).values({
        action: "order.delete",
        targetType: "order",
        targetId: null,
        metadata: { reference, previousStatus: order.status, by: session.username },
      });
      return { ok: true as const, reference };
    });

    if (!outcome.ok) return outcome;
    refreshOrders();
    return { ok: true, message: `${outcome.reference} was permanently deleted.` };
  } catch (error) {
    console.error("Failed to delete order from admin:", error);
    return { ok: false, message: "The order could not be deleted." };
  }
}
