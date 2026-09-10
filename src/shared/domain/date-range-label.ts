import {
  addDays,
  dayMonthYear,
  isToday,
  isYesterday,
  monthLong,
  shortDate,
} from "@/shared/lib/format/date";

import type { DateRange, StatPeriod } from "./date-range";
import { rangeDays } from "./date-range";

/**
 * Human names for a {@link DateRange} — what the filter bars print so the desk
 * can always see WHICH days the figures on screen belong to.
 *
 * Ranges are inclusive-start / exclusive-end everywhere in the app, but every
 * label here talks about the **inclusive last day**: "1–7 sentabr" is what a
 * person means, not "1 sentabr up to but excluding 8 sentabr".
 */

/** The last day actually inside `range`. */
export function lastDay(range: DateRange) {
  const last = addDays(range.end, -1);
  return last < range.start ? range.start : last;
}

export function isSingleDay(range: DateRange): boolean {
  return rangeDays(range) <= 1;
}

/**
 * `5 iyul 2026` · `1–15 iyul 2026` · `28 iyun – 3 iyul 2026` ·
 * `12 dekabr 2025 – 3 yanvar 2026`
 */
export function rangeLabel(range: DateRange): string {
  const start = range.start;
  const end = lastDay(range);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth && start.getUTCDate() === end.getUTCDate()) {
    return dayMonthYear(start);
  }
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${monthLong(end.getUTCMonth() + 1)} ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return (
      `${start.getUTCDate()} ${monthLong(start.getUTCMonth() + 1)} – ` +
      `${end.getUTCDate()} ${monthLong(end.getUTCMonth() + 1)} ${end.getUTCFullYear()}`
    );
  }
  return `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
}

/** Compact form for a chip or a segment: `01.09.2026` · `01.09–07.09.2026`. */
export function rangeLabelShort(range: DateRange): string {
  const start = range.start;
  const end = lastDay(range);
  if (isSingleDay(range)) return shortDate(start);

  const pad = (n: number) => String(n).padStart(2, "0");
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return (
      `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}–` +
      `${pad(end.getUTCDate())}.${pad(end.getUTCMonth() + 1)}.${end.getUTCFullYear()}`
    );
  }
  return `${shortDate(start)}–${shortDate(end)}`;
}

/**
 * What the active-filter chip says: the period's own name for the fixed periods
 * ("Bugun", "Shu hafta"), the concrete days for a custom one.
 */
export function periodFilterLabel(period: StatPeriod, range: DateRange): string {
  switch (period) {
    case "daily":
      return `Bugun · ${rangeLabel(range)}`;
    case "weekly":
      return `Shu hafta · ${rangeLabel(range)}`;
    case "monthly":
      return `Shu oy · ${rangeLabel(range)}`;
    case "yearly":
      return `Shu yil · ${rangeLabel(range)}`;
    case "custom":
      return rangeLabel(range);
  }
}

/**
 * What the period button itself says. "Bugun" beats "10.09.2026" on the one
 * range the desk looks at all day — the lists open on today, and the button has
 * to make that obvious at a glance rather than leaving staff to read a date and
 * work it out.
 */
export function rangeTriggerLabel(range: DateRange): string {
  if (isSingleDay(range)) {
    if (isToday(range.start)) return "Bugun";
    if (isYesterday(range.start)) return "Kecha";
  }
  return rangeLabelShort(range);
}

/**
 * What the active-filter chip says about a range the desk did not name itself:
 * "Bugun · 10 sentabr 2026". The lists open on today, so the chip has to say so
 * — a bare date leaves staff checking a calendar to find out whether the figures
 * on screen are the ones they asked for.
 */
export function activeRangeLabel(range: DateRange): string {
  if (isSingleDay(range)) {
    if (isToday(range.start)) return `Bugun · ${rangeLabel(range)}`;
    if (isYesterday(range.start)) return `Kecha · ${rangeLabel(range)}`;
  }
  return rangeLabel(range);
}
