"use client";

import { CalendarRange } from "lucide-react";

import {
  PERIOD_GRANULARITY_LABEL,
  PERIOD_LABEL,
  type StatPeriod,
} from "@/shared/domain/date-range";
import { cn } from "@/shared/lib/utils";

const DEFAULT_PERIODS: readonly StatPeriod[] = ["daily", "weekly", "monthly", "yearly"];

/**
 * The segmented period control.
 *
 * The `custom` segment does not select a period directly — it opens the range
 * picker, and once days are chosen it shows them ("01.09–07.09.2026") instead
 * of the word "Davr", so the active filter is readable without reopening the
 * calendar.
 */
export function PeriodSelector({
  value,
  onChange,
  onCustomClick,
  customLabel,
  includeCustom = false,
  granularity = false,
  periods = DEFAULT_PERIODS,
  className,
}: {
  value: StatPeriod;
  onChange: (period: StatPeriod) => void;
  onCustomClick?: () => void;
  customLabel?: string | null;
  includeCustom?: boolean;
  /** Use the "group by" labels (Haftalik/…) instead of the range ones (Hafta/…). */
  granularity?: boolean;
  periods?: readonly StatPeriod[];
  className?: string;
}) {
  const items: StatPeriod[] = includeCustom ? [...periods, "custom"] : [...periods];
  const labels = granularity ? PERIOD_GRANULARITY_LABEL : PERIOD_LABEL;

  return (
    <div
      role="tablist"
      aria-label="Davr"
      className={cn(
        "border-border bg-surface-alt inline-flex items-center gap-1 rounded-md border p-1",
        className,
      )}
    >
      {items.map((period) => {
        const selected = period === value;
        const isCustom = period === "custom";
        const label = isCustom && selected && customLabel ? customLabel : labels[period];

        return (
          <button
            key={period}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() =>
              isCustom && onCustomClick ? onCustomClick() : onChange(period)
            }
            className={cn(
              "text-label-sm flex items-center gap-1.5 rounded-sm px-4 py-2 whitespace-nowrap",
              "transition-colors duration-220 ease-out",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-surface text-primary-dark shadow-xs"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {isCustom && <CalendarRange className="size-3.5" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
