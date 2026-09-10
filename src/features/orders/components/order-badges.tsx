import { Gift, Truck, UserRound } from "lucide-react";

import {
  MIXED_PAYMENT_LABEL,
  NO_PAYMENT_LABEL,
  PAYMENT_TYPE_LABEL,
} from "@/shared/domain/payment-type";
import { ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { OrderSummary } from "../types/order";
import { isOrderDebtOverdue } from "../types/order";

const TONES = {
  primary: "bg-primary-soft text-primary-dark",
  info: "bg-info/12 text-info",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-surface-alt text-text-secondary",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-label-xs inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded-full px-2 py-0.5 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** How the sale was paid — including the two report-only sentinels. */
export function PaymentBadge({ order }: { order: OrderSummary }) {
  if (order.isUnpaidOrder) return <Badge tone="warning">{NO_PAYMENT_LABEL}</Badge>;
  if (order.isMixedPayment) return <Badge tone="info">{MIXED_PAYMENT_LABEL}</Badge>;
  return <Badge>{PAYMENT_TYPE_LABEL[order.paymentType]}</Badge>;
}

/** The debt marker, red once the deadline has slipped. */
export function OrderDebtBadge({ order }: { order: OrderSummary }) {
  if (!order.hasDebt) return null;
  const overdue = isOrderDebtOverdue(order);
  return (
    <Badge tone={overdue ? "danger" : "warning"}>
      {overdue ? "Muddati o'tgan" : "Qarz"} {money.plain(order.debtRemaining)}
    </Badge>
  );
}

export function OrderTypeBadge({ order }: { order: OrderSummary }) {
  if (order.orderType !== "delivery") return null;
  return (
    <Badge>
      <Truck className="size-3" aria-hidden />
      {ORDER_TYPE_LABEL.delivery}
    </Badge>
  );
}

export function BuyerTypeBadge({ order }: { order: OrderSummary }) {
  if (order.buyerType !== "staff") return null;
  return (
    <Badge>
      <UserRound className="size-3" aria-hidden />
      Xodim
    </Badge>
  );
}

export function GiftBadge({ order }: { order: OrderSummary }) {
  if (!order.hasGift) return null;
  return (
    <Badge tone="primary">
      <Gift className="size-3" aria-hidden />
      Sovg&rsquo;a
    </Badge>
  );
}

/**
 * Marks an order the client placed in the MOBILE APP rather than at the desk.
 * Reception's own facts — payment type, split payments, commission — are empty
 * on such an order by design, so it is labelled instead of rendering zeros.
 */
export function AppOrderBadge({ order }: { order: OrderSummary }) {
  if (order.isReception) return null;
  return <Badge tone="info">Ilovadan</Badge>;
}
