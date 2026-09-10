import { cn } from "@/shared/lib/utils";

import { DEBT_STATUS_LABEL, isDebtOpen, type Debt, debtStatusLabel } from "../types/debt";

/**
 * The status chip, plus the one thing the status alone doesn't say: whether the
 * deadline has slipped. "Ochiq" on a debt three weeks overdue is technically
 * true and practically useless, so overdue wins the colour.
 */
export function DebtStatusBadge({ debt }: { debt: Debt }) {
  const overdue = debt.isOverdue && isDebtOpen(debt.status);

  return (
    <span
      className={cn(
        "text-label-xs inline-flex shrink-0 items-center rounded-full px-2 py-0.5",
        overdue
          ? "bg-danger/12 text-danger"
          : debt.status === "paid"
            ? "bg-primary-soft text-primary-dark"
            : debt.status === "cancelled"
              ? "bg-surface-alt text-text-tertiary"
              : debt.status === "partial"
                ? "bg-info/12 text-info"
                : "bg-warning/15 text-warning",
      )}
    >
      {overdue ? "Muddati o'tgan" : debtStatusLabel(debt)}
    </span>
  );
}

/**
 * "Bugun" / "3 kun qoldi" / "5 kun kechikdi".
 *
 * Reads `daysLeft` straight from the server: the clinic runs on Asia/Tashkent
 * and the browser might not, so a locally derived "Bugun" can land on the wrong
 * day.
 */
export function DueDateBadge({ debt }: { debt: Debt }) {
  if (!isDebtOpen(debt.status)) return null;

  const { daysLeft } = debt;
  const label =
    daysLeft === 0
      ? "Bugun"
      : daysLeft > 0
        ? `${daysLeft} kun qoldi`
        : `${Math.abs(daysLeft)} kun kechikdi`;

  return (
    <span
      className={cn(
        "text-label-xs inline-flex shrink-0 items-center rounded-full px-2 py-0.5",
        daysLeft < 0
          ? "bg-danger/12 text-danger"
          : daysLeft === 0
            ? "bg-warning/15 text-warning"
            : "bg-surface-alt text-text-secondary",
      )}
    >
      {label}
    </span>
  );
}

export { DEBT_STATUS_LABEL };
