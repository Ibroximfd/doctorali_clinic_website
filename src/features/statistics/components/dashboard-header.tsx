"use client";

import { Download, MoonStar } from "lucide-react";

import { DateRangePicker } from "@/shared/components/data-display/date-range-picker";
import { PeriodSelector } from "@/shared/components/data-display/period-selector";
import { Button } from "@/shared/components/ui/button";
import type { DateRange, StatPeriod } from "@/shared/domain/date-range";
import { resolveRange } from "@/shared/domain/date-range";
import { periodFilterLabel, rangeLabelShort } from "@/shared/domain/date-range-label";

/**
 * Period selector, the end-of-shift report and the Excel export.
 *
 * Payment type is intentionally NOT a dashboard filter: the per-till breakdown
 * already reports real cash-in per type, split slices included — a
 * `payment_type` filter here would drop mixed orders and show a misleading 0.
 */
export function DashboardHeader({
  period,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  onCloseDay,
  onExport,
  exporting,
}: {
  period: StatPeriod;
  customRange: DateRange | null;
  onPeriodChange: (period: StatPeriod) => void;
  onCustomRangeChange: (range: DateRange) => void;
  onCloseDay: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const range = resolveRange(period, { custom: customRange });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <PeriodSelector
            value={period}
            onChange={onPeriodChange}
            granularity
            includeCustom={false}
          />
        </div>

        <DateRangePicker
          value={customRange}
          onChange={onCustomRangeChange}
          triggerLabel={
            period === "custom" && customRange ? rangeLabelShort(customRange) : "Davr"
          }
        />

        {/* How reception ends a shift: the day's till, credit and tomorrow's
            bookings in one place. */}
        <Button variant="outline" onClick={onCloseDay}>
          <MoonStar className="size-4" aria-hidden />
          Kunni yopish
        </Button>

        <Button variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? (
            <span
              className="border-border border-t-primary size-4 animate-spin rounded-full border-2"
              aria-hidden
            />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Excel
        </Button>
      </div>

      {/* The line that keeps a custom period from silently passing for today. */}
      <div className="flex items-center gap-2">
        <span className="text-caption text-text-tertiary">Filtr:</span>
        <span className="bg-primary-soft text-label-sm text-primary-dark rounded-full px-2.5 py-1">
          {periodFilterLabel(period, range)}
        </span>
        {period !== "daily" && (
          <button
            type="button"
            onClick={() => onPeriodChange("daily")}
            className="text-caption text-text-tertiary hover:text-text-primary focus-visible:ring-ring rounded-sm px-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            Bekor qilish
          </button>
        )}
      </div>
    </div>
  );
}
