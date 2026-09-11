import {
  addDays,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { isSameRange, type DateRange } from "./date-range";

/**
 * The named periods every filter bar offers.
 *
 * They exist so a chosen range can be shown by its NAME rather than by its
 * dates: "Bu oy" is read at a glance, "01.09–30.09.2026" has to be worked out.
 * The same list drives the buttons inside the picker and the label on it, so
 * the two can never drift apart.
 */
export interface DatePreset {
  readonly id: string;
  readonly label: string;
  /** True for the one-day periods — they belong to the "Bir kun" tab. */
  readonly single?: boolean;
  readonly build: (now: TashkentDate) => DateRange;
}

function day(now: TashkentDate, back: number): DateRange {
  const start = addDays(startOfDay(now), -back);
  return { start, end: addDays(start, 1) };
}

/** The last `days` days INCLUDING today. */
function lastDays(now: TashkentDate, days: number): DateRange {
  const today = startOfDay(now);
  return { start: addDays(today, -(days - 1)), end: addDays(today, 1) };
}

function monthOf(now: TashkentDate, offset: number): DateRange {
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  ) as TashkentDate;
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1),
  ) as TashkentDate;
  return { start: first, end: next };
}

export const DATE_PRESETS: readonly DatePreset[] = [
  { id: "today", label: "Bugun", single: true, build: (now) => day(now, 0) },
  { id: "yesterday", label: "Kecha", single: true, build: (now) => day(now, 1) },
  {
    id: "week",
    label: "Bu hafta",
    build: (now) => {
      // getUTCDay(): 0 = Sunday; the Uzbek week starts on Monday.
      const today = startOfDay(now);
      const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
      return { start: monday, end: addDays(monday, 7) };
    },
  },
  { id: "last7", label: "Oxirgi 7 kun", build: (now) => lastDays(now, 7) },
  { id: "month", label: "Bu oy", build: (now) => monthOf(now, 0) },
  { id: "lastMonth", label: "O'tgan oy", build: (now) => monthOf(now, -1) },
  { id: "last30", label: "Oxirgi 30 kun", build: (now) => lastDays(now, 30) },
  {
    id: "year",
    label: "Bu yil",
    build: (now) => ({
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) as TashkentDate,
      end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)) as TashkentDate,
    }),
  },
];

/** The preset a range came from, so the filter can print its name back. */
export function matchPreset(
  range: DateRange | null,
  now: TashkentDate = nowTashkent(),
): DatePreset | null {
  if (!range) return null;
  return DATE_PRESETS.find((preset) => isSameRange(preset.build(now), range)) ?? null;
}

export function presetRange(
  id: string,
  now: TashkentDate = nowTashkent(),
): DateRange | null {
  return DATE_PRESETS.find((preset) => preset.id === id)?.build(now) ?? null;
}

/** One single day as a range — what the "Bir kun" tab commits. */
export function singleDayRange(dayStart: TashkentDate): DateRange {
  const start = startOfDay(dayStart);
  return { start, end: addDays(start, 1) };
}
