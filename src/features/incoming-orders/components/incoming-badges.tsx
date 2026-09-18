import { CircleCheck, Clock3, Gift, Truck } from "lucide-react";

import { ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import { cn } from "@/shared/lib/utils";

import type {
  IncomingOrderSummary,
  IncomingSource,
  IncomingStatusGroup,
} from "../types/incoming-order";

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

const GROUP_TONE: Readonly<Record<IncomingStatusGroup, keyof typeof TONES>> = {
  new: "info",
  in_progress: "warning",
  completed: "primary",
  cancelled: "danger",
};

/**
 * Status pill: the raw-status label from the backend, colored by its group —
 * so all 8 statuses (and any future one) render without the app knowing each
 * code.
 */
export function IncomingStatusBadge({ order }: { order: IncomingOrderSummary }) {
  return <Badge tone={GROUP_TONE[order.statusGroup]}>{order.statusDisplay}</Badge>;
}

/**
 * "To'langan" / "To'lanmagan" — whether the money arrived is a separate
 * question from the fulfilment status (§3 `is_paid`), so it gets its own mark.
 */
export function IncomingPaidBadge({ order }: { order: IncomingOrderSummary }) {
  const label =
    order.paymentStatusDisplay !== ""
      ? order.paymentStatusDisplay
      : order.isPaid
        ? "To'langan"
        : "To'lanmagan";
  return (
    <Badge tone={order.isPaid ? "primary" : "warning"}>
      {order.isPaid ? (
        <CircleCheck className="size-3" aria-hidden />
      ) : (
        <Clock3 className="size-3" aria-hidden />
      )}
      {label}
    </Badge>
  );
}

export function IncomingTypeBadge({ order }: { order: IncomingOrderSummary }) {
  if (order.orderType !== "delivery") return null;
  return (
    <Badge>
      <Truck className="size-3" aria-hidden />
      {ORDER_TYPE_LABEL.delivery}
    </Badge>
  );
}

export function IncomingGiftBadge({ order }: { order: IncomingOrderSummary }) {
  if (!order.hasGift) return null;
  return (
    <Badge tone="primary">
      <Gift className="size-3" aria-hidden />
      Sovg&rsquo;a
    </Badge>
  );
}

/**
 * The deliberately discreet origin marker.
 *
 * The owner asked for ONE mixed list with no visible Mehrigiyo/doctor split —
 * only a cue they personally can read. A Mehrigiyo-born order gets a tiny
 * muted dot after its number; a doctor order gets nothing. No tooltip, no
 * label, no legend anywhere: to everyone else it reads as decoration. Do not
 * "improve" this into a labelled chip.
 */
export function SourceMark({ source }: { source: IncomingSource }) {
  if (source !== "mehrigiyo") return null;
  return (
    <span
      aria-hidden
      className="bg-warning/50 ml-1.5 inline-block size-[5px] shrink-0 rounded-full"
    />
  );
}
