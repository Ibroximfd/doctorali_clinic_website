"use client";

import { dayMonthYear, hhmm } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";
import { cn } from "@/shared/lib/utils";

import { PAYOUT_SOURCE_LABEL, type PayoutDay } from "../types/payout";

/**
 * A doctor's week opened day → order → product.
 *
 * Shared by the week about to be paid and the payout already made, because
 * they are the same question asked at two moments: "where did this figure come
 * from?" — and the answer must read identically either way.
 *
 * The corrections (`adjustments`) sit inline with the day they land on: a week
 * that comes out lower than the doctor expects is almost always a correction
 * from an earlier week, and that is the conversation this exists to settle.
 */
export function PayoutBreakdown({ days }: { days: readonly PayoutDay[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {days.map((day) => (
        <li key={day.date.getTime()} className="border-border rounded-md border p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-title-sm">{dayMonthYear(day.date)}</span>
            <span className="text-title-sm tabular ml-auto">
              {money.plain(day.dayCommission)}
            </span>
          </div>

          {day.orders.map((order) => (
            <div key={order.orderId} className="border-surface-alt mt-2 border-t pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-caption text-text-secondary tabular">
                  {order.orderNumber} · {hhmm(order.createdAt)}
                </span>
                <span className="bg-surface-alt text-label-xs text-text-tertiary rounded-full px-1.5 py-0.5">
                  {PAYOUT_SOURCE_LABEL[order.source]}
                </span>
                <span className="text-caption tabular ml-auto">
                  {money.plain(order.orderCommission)}
                </span>
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {order.items.map((item, index) => (
                  <li
                    key={`${order.orderId}-${index}`}
                    className="text-caption text-text-tertiary flex items-baseline gap-2"
                  >
                    <span className="truncate">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="tabular ml-auto shrink-0">
                      {percent.labeled(item.commissionPercent)} ·{" "}
                      {money.plain(item.commissionAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {day.adjustments.map((adjustment, index) => (
            <div
              key={`adj-${index}`}
              className="border-surface-alt mt-2 flex items-baseline gap-2 border-t pt-2"
            >
              <span className="text-caption text-warning">
                {adjustment.label}
                {adjustment.orderNumber && ` · ${adjustment.orderNumber}`}
              </span>
              <span
                className={cn(
                  "text-caption tabular ml-auto",
                  adjustment.amount < 0 ? "text-danger" : "text-primary-dark",
                )}
              >
                {money.signed(adjustment.amount)}
              </span>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
