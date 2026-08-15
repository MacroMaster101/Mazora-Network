import { CheckCircle2, Clock3, PackageCheck, UserPlus, XCircle } from "lucide-react";
import { orderStatusLabel, type OrderStatus, type StoreOrder } from "@/lib/order-status";
import { cn, fmtDate, usd } from "@/lib/utils";

/**
 * One store order, shared by the member purchase history and the staff order
 * list. Staff see the buyer identity block; members do not — it is their own
 * order, so repeating their username back at them is noise.
 */

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "border-warning/35 bg-warning/10 text-warning",
  confirmed: "border-success/35 bg-success/10 text-success",
  // Completed is deliberately calmer than confirmed: a finished order is
  // settled, not something still needing attention.
  completed: "border-accent/35 bg-accent/12 text-accent-bright",
  rejected: "border-danger/35 bg-danger/10 text-danger",
  awaiting_discord_join: "border-warning/35 bg-warning/10 text-warning",
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "completed") return <PackageCheck size={13} aria-hidden="true" />;
  if (status === "confirmed") return <CheckCircle2 size={13} aria-hidden="true" />;
  if (status === "rejected") return <XCircle size={13} aria-hidden="true" />;
  if (status === "awaiting_discord_join") return <UserPlus size={13} aria-hidden="true" />;
  return <Clock3 size={13} aria-hidden="true" />;
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        STATUS_TONE[status],
      )}
    >
      <StatusIcon status={status} />
      {orderStatusLabel(status)}
    </span>
  );
}

export function OrderCard({ order, showBuyer = false }: { order: StoreOrder; showBuyer?: boolean }) {
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="telemetry text-sm font-bold text-accent-bright">{order.reference}</p>
          <p className="mt-1 text-xs text-muted">{fmtDate(order.createdAt)}</p>
        </div>
        <OrderStatusPill status={order.status} />
      </div>

      {showBuyer && (
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted">Minecraft username</dt>
            <dd className="mt-0.5 font-semibold">{order.minecraftUsername || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">Discord</dt>
            <dd className="mt-0.5 font-semibold">
              {order.discordUsername ? `@${order.discordUsername}` : "—"}
            </dd>
          </div>
        </dl>
      )}

      <ul className="mt-4 space-y-2 border-t border-line pt-4">
        {order.items.length === 0 ? (
          <li className="text-sm text-muted">No line items were recorded for this order.</li>
        ) : (
          order.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <strong className="font-semibold">{item.quantity}×</strong> {item.name}
              </span>
              <span className="telemetry shrink-0 font-semibold">{usd(item.price * item.quantity)}</span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-4 space-y-1 border-t border-line pt-4">
        {order.discount > 0 && (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="telemetry">{usd(order.subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">
                {order.creatorCode ? `Discount code ${order.creatorCode}` : "Discount"}
              </span>
              <span className="telemetry font-semibold text-success">−{usd(order.discount)}</span>
            </div>
          </>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Total</span>
          <span className="telemetry text-lg font-black">{usd(order.total)}</span>
        </div>
      </div>

      {order.notes && (
        <p className="mt-3 rounded-lg border border-line bg-ink/5 p-3 text-xs leading-relaxed text-muted">
          <strong className="text-fg">Player notes:</strong> {order.notes}
        </p>
      )}

      {order.handledBy && (
        <p className="mt-3 text-xs text-muted">
          {order.status === "rejected" ? "Declined" : "Actioned"} by{" "}
          <strong className="text-fg">{order.handledBy}</strong>
          {order.handledAt ? ` · ${fmtDate(order.handledAt)}` : ""}
        </p>
      )}

      {order.status === "confirmed" && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Payment is arranged in your private Discord ticket. No payment is ever taken on this website.
        </p>
      )}
      {order.status === "awaiting_discord_join" && (
        <p className="mt-3 text-xs leading-relaxed text-warning">
          Join the Mazora Discord so staff can open your order ticket, then let them know.
        </p>
      )}
    </article>
  );
}
