"use client";

import { Download, MoonStar } from "lucide-react";

import { DateFilter } from "@/shared/components/data-display/date-filter";
import { PeriodSelector } from "@/shared/components/data-display/period-selector";
import { Button } from "@/shared/components/ui/button";
import type { DateRange } from "@/shared/domain/date-range";
import { periodForRange, resolveRange } from "@/shared/domain/date-range";
import { rangeLabel } from "@/shared/domain/date-range-label";

/**
 * The period the whole dashboard is read through, the end-of-shift report and
 * the Excel export.
 *
 * ONE source of truth — the range. The segmented control is the fast path to
 * the four named periods; the date filter beside it answers everything else
 * ("the 3rd", "1–15 sentabr"), which the segments alone could not express at
 * all. Both write the same range, so neither can ever contradict the figures.
 *
 * Payment type is intentionally NOT a dashboard filter: the per-till breakdown
 * already reports real cash-in per type, split slices included — a
 * `payment_type` filter here would drop mixed orders and show a misleading 0.
 */
export function DashboardHeader({
  range,
  onRangeChange,
  onCloseDay,
  onExport,
  exporting,
}: {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onCloseDay: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const period = periodForRange(range);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 overflow-x-auto">
          <PeriodSelector
            value={period}
            onChange={(next) => onRangeChange(resolveRange(next, { custom: range }))}
            granularity
          />
        </div>

        <DateFilter
          value={range}
          onChange={(next) => next && onRangeChange(next)}
          clearable={false}
        />

        <div className="flex-1" />

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
          {rangeLabel(range)}
        </span>
        {period !== "daily" && (
          <button
            type="button"
            onClick={() => onRangeChange(resolveRange("daily"))}
            className="text-caption text-text-tertiary hover:text-text-primary focus-visible:ring-ring rounded-sm px-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            Bugunga qaytish
          </button>
        )}
      </div>
    </div>
  );
}
