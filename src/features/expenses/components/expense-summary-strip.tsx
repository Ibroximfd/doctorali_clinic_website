"use client";

import { AppCard } from "@/shared/components/data-display/app-card";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import {
  EXPENSE_CATEGORY_LABEL,
  paymentAmountLabel,
  type ExpenseSummary,
} from "../types/expense";

/**
 * The totals above the list: the period's spend, split by till and by category.
 *
 * The by-till row is the one that matters at handover — it is what the drawer
 * count is checked against.
 */
export function ExpenseSummaryStrip({ summary }: { summary: ExpenseSummary }) {
  if (summary.count === 0) return null;

  const maxCategory = summary.byCategory.reduce(
    (max, row) => Math.max(max, row.amount),
    0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AppCard className="lg:col-span-1">
        <p className="text-label-sm text-text-secondary">Jami xarajat</p>
        <p className="text-display-sm text-danger tabular mt-2">
          {money.plain(summary.totalAmount)}
        </p>
        <p className="text-caption text-text-tertiary mt-1">{summary.count} ta yozuv</p>

        {summary.byPaymentType.length > 0 && (
          <ul className="border-surface-alt mt-4 flex flex-col gap-2 border-t pt-3">
            {summary.byPaymentType.map((row) => (
              <li
                key={row.paymentType ?? "unspecified"}
                className="flex items-baseline gap-2"
              >
                <span
                  className={cn(
                    "text-caption flex-1",
                    row.paymentType ? "text-text-secondary" : "text-warning",
                  )}
                >
                  {paymentAmountLabel(row)}
                </span>
                <span className="text-title-sm tabular">{money.plain(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard className="lg:col-span-2">
        <p className="text-label-sm text-text-secondary">Turkumlar bo&rsquo;yicha</p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {summary.byCategory.map((row) => (
            <li key={row.category} className="flex items-center gap-3">
              <span className="text-caption text-text-secondary w-44 shrink-0 truncate">
                {row.categoryDisplay || EXPENSE_CATEGORY_LABEL[row.category]}
              </span>
              <span className="bg-surface-alt h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="bg-chart-3 block h-full rounded-full"
                  style={{
                    width: `${maxCategory > 0 ? Math.max(2, Math.round((row.amount / maxCategory) * 100)) : 0}%`,
                  }}
                />
              </span>
              <span className="text-title-sm tabular w-28 shrink-0 text-right">
                {money.plain(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}
