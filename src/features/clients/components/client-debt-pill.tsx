import { Landmark, TriangleAlert } from "lucide-react";

import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

/**
 * Outstanding debt: amber while merely open, red once any of it is past due —
 * so a row that needs chasing today is visible without being read.
 *
 * Renders nothing when there is no debt, which keeps clean rows clean.
 */
export function ClientDebtPill({
  openDebt,
  overdueDebt = 0,
  compact = false,
  className,
}: {
  openDebt: number;
  overdueDebt?: number;
  /** Amount only, no icon — for a table cell. */
  compact?: boolean;
  className?: string;
}) {
  if (openDebt <= 0) return null;

  const overdue = overdueDebt > 0;
  const Icon = overdue ? TriangleAlert : Landmark;

  return (
    <span
      title={overdue ? `Muddati o'tgan qarz: ${money.uzs(overdueDebt)}` : "Ochiq qarz"}
      className={cn(
        "text-label-xs tabular inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        compact ? "px-1.5" : "px-2.5",
        overdue
          ? "border-danger/30 bg-danger/12 text-danger"
          : "border-warning/30 bg-warning/12 text-warning",
        className,
      )}
    >
      {!compact && <Icon className="size-3 shrink-0" aria-hidden />}
      {money.plain(openDebt)}
    </span>
  );
}
