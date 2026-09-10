import type { StatPeriod } from "@/shared/domain/date-range";
import {
  dayMonthTime,
  dayMonthYear,
  monthLong,
  monthShort,
  nowTashkent,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

import type { ChartPoint } from "../types/statistics";

/**
 * One plotted point: the raw value, a short axis label, a full tooltip label
 * (the exact date) and `isCurrent`, marking the bucket that contains "now"
 * (today / this month / this year) so the chart can emphasise it.
 */
export interface ChartSample {
  readonly value: number;
  readonly axisLabel: string;
  readonly tooltipLabel: string;
  readonly isCurrent: boolean;
}

/**
 * The four bucket shapes a chart `date` string can arrive in. The backend never
 * sends an explicit "kind" — the string's own shape is the signal:
 *
 *   length 4      → year   (`"2026"`)
 *   contains 'T'  → hour   (`"2026-07-13T11:00"`, only in a single-day range)
 *   length 7      → month  (`"2026-07"`)
 *   otherwise     → day    (`"2026-07-13"`)
 */
export type ChartBucketKind = "year" | "hour" | "month" | "day";

export function chartBucketKindOf(date: string): ChartBucketKind {
  if (date.length === 4) return "year";
  if (date.includes("T")) return "hour";
  if (date.length === 7) return "month";
  return "day";
}

const WEEKDAYS_SHORT = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak"] as const;

/**
 * Converts the API's `revenue_chart` / `commission_chart` buckets into samples,
 * picking the axis and tooltip format per point.
 */
export function buildChartSamples(
  points: readonly ChartPoint[],
  period: StatPeriod,
  now: TashkentDate = nowTashkent(),
): ChartSample[] {
  return points.map((p) => sampleFor(p, period, now));
}

function sampleFor(
  point: ChartPoint,
  period: StatPeriod,
  now: TashkentDate,
): ChartSample {
  const { date: raw, value } = point;

  switch (chartBucketKindOf(raw)) {
    case "hour": {
      const parsed = tashkentFromApi(`${raw}:00+05:00`);
      const hour = raw.slice(raw.indexOf("T") + 1);
      return {
        value,
        axisLabel: hour,
        tooltipLabel: dayMonthTime(parsed),
        isCurrent:
          parsed.getUTCFullYear() === now.getUTCFullYear() &&
          parsed.getUTCMonth() === now.getUTCMonth() &&
          parsed.getUTCDate() === now.getUTCDate() &&
          parsed.getUTCHours() === now.getUTCHours(),
      };
    }

    case "year": {
      const year = Number.parseInt(raw, 10);
      return {
        value,
        axisLabel: raw,
        tooltipLabel: Number.isNaN(year) ? raw : `${year}-yil`,
        isCurrent: year === now.getUTCFullYear(),
      };
    }

    case "month": {
      const [yearPart, monthPart] = raw.split("-");
      const year = Number.parseInt(yearPart ?? "", 10);
      const month = Number.parseInt(monthPart ?? "", 10);
      const short = Number.isNaN(month) ? raw : monthShort(month);
      return {
        value,
        axisLabel: short,
        tooltipLabel:
          Number.isNaN(month) || Number.isNaN(year)
            ? short
            : `${monthLong(month)} ${year}`,
        isCurrent: year === now.getUTCFullYear() && month === now.getUTCMonth() + 1,
      };
    }

    case "day": {
      const parsed = Date.parse(`${raw}T00:00:00Z`);
      if (Number.isNaN(parsed)) {
        return { value, axisLabel: raw, tooltipLabel: raw, isCurrent: false };
      }
      const d = new Date(parsed) as TashkentDate;
      return {
        value,
        axisLabel:
          period === "weekly"
            ? WEEKDAYS_SHORT[(d.getUTCDay() + 6) % 7]
            : String(d.getUTCDate()),
        tooltipLabel: dayMonthYear(d),
        isCurrent:
          d.getUTCFullYear() === now.getUTCFullYear() &&
          d.getUTCMonth() === now.getUTCMonth() &&
          d.getUTCDate() === now.getUTCDate(),
      };
    }
  }
}
