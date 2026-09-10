"use client";

import { ReceiptText } from "lucide-react";
import Link from "next/link";

import { AppRoutes } from "@/config/routes";
import type { OrderSummary } from "@/features/orders/types/order";
import { AppCard } from "@/shared/components/data-display/app-card";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import {
  MIXED_PAYMENT_LABEL,
  NO_PAYMENT_LABEL,
  PAYMENT_TYPE_LABEL,
} from "@/shared/domain/payment-type";
import { ORDER_TYPE_LABEL } from "@/shared/domain/order-type";
import { hhmm } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

/** The last few sales, as a quick "is the till moving?" glance. */
export function RecentOrdersCard({ orders }: { orders: readonly OrderSummary[] }) {
  return (
    <AppCard className="flex flex-col">
      <SectionHeader
        icon={ReceiptText}
        title="So'nggi buyurtmalar"
        actions={
          <Link
            href={AppRoutes.orders}
            className="text-label-sm text-primary-dark focus-visible:ring-ring rounded-sm px-1 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Barchasi
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          title="Buyurtma yo'q"
          message="Bu davrda buyurtma qayd etilmagan."
          icon={ReceiptText}
        />
      ) : (
        <ul className="mt-4 flex flex-col">
          {orders.slice(0, 6).map((order, index) => (
            <li
              key={order.id}
              className={cn(
                "flex items-center gap-3 py-2.5",
                index > 0 && "border-surface-alt border-t",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-title-sm truncate">
                    {order.clientName || "Mijoz"}
                  </span>
                  {order.hasGift && <Pill tone="primary">Sovg&rsquo;a</Pill>}
                  {order.hasDebt && <Pill tone="warning">Qarz</Pill>}
                  {order.orderType === "delivery" && (
                    <Pill tone="neutral">{ORDER_TYPE_LABEL.delivery}</Pill>
                  )}
                  {order.status === "cancelled" && <Pill tone="danger">Bekor</Pill>}
                </div>
                <p className="text-caption text-text-tertiary tabular truncate">
                  {order.orderNumber} · {hhmm(order.createdAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-title-sm tabular">{money.plain(order.totalAmount)}</p>
                <p className="text-caption text-text-tertiary">{paymentLabel(order)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppCard>
  );
}

function paymentLabel(order: OrderSummary): string {
  if (order.isUnpaidOrder) return NO_PAYMENT_LABEL;
  if (order.isMixedPayment) return MIXED_PAYMENT_LABEL;
  return PAYMENT_TYPE_LABEL[order.paymentType];
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "warning" | "danger" | "neutral";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary-dark",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/12 text-danger",
    neutral: "bg-surface-alt text-text-secondary",
  } as const;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-bold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
