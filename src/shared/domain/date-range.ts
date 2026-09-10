import {
  addDays,
  nowTashkent,
  startOfDay,
  ymd,
  type TashkentDate,
} from "@/shared/lib/format/date";

/**
 * A period, **inclusive start / exclusive end** — the convention the whole app
 * uses internally. The API's `date_to` is INCLUSIVE, so every request that
 * sends a range subtracts a day from `end`; `toApiRange` below is the one place
 * that conversion happens.
 */
export interface DateRange {
  readonly start: TashkentDate;
  readonly end: TashkentDate;
}

/** Period granularity shared by the dashboard, orders, doctors and products. */
export const STAT_PERIODS = ["daily", "weekly", "monthly", "yearly", "custom"] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];

/** Range label on filters: "today / this week / …". */
export const PERIOD_LABEL: Readonly<Record<StatPeriod, string>> = {
  daily: "Bugun",
  weekly: "Hafta",
  monthly: "Oy",
  yearly: "Yil",
  custom: "Davr",
};

/** Granularity label for statistics charts ("group by day / week / …"). */
export const PERIOD_GRANULARITY_LABEL: Readonly<Record<StatPeriod, string>> = {
  daily: "Bugun",
  weekly: "Haftalik",
  monthly: "Oylik",
  yearly: "Yillik",
  custom: "Davr",
};

/** Resolves a period to concrete days, relative to `now`. Weeks start Monday. */
export function resolveRange(
  period: StatPeriod,
  options?: { now?: TashkentDate; custom?: DateRange | null },
): DateRange {
  const now = options?.now ?? nowTashkent();
  const today = startOfDay(now);

  switch (period) {
    case "daily":
      return { start: today, end: addDays(today, 1) };
    case "weekly": {
      // getUTCDay(): 0 = Sunday; the Uzbek week starts on Monday.
      const offset = (today.getUTCDay() + 6) % 7;
      const monday = addDays(today, -offset);
      return { start: monday, end: addDays(monday, 7) };
    }
    case "monthly": {
      const first = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ) as TashkentDate;
      const next = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      ) as TashkentDate;
      return { start: first, end: next };
    }
    case "yearly":
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) as TashkentDate,
        end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)) as TashkentDate,
      };
    case "custom":
      return options?.custom ?? { start: today, end: addDays(today, 1) };
  }
}

/**
 * `date_from` / `date_to` for a request. The API's `date_to` is inclusive while
 * our `end` is exclusive, so the last day is `end − 1`.
 */
export function toApiRange(range: DateRange): {
  date_from: string;
  date_to: string;
} {
  const last = addDays(range.end, -1);
  return {
    date_from: ymd(range.start),
    date_to: ymd(last < range.start ? range.start : last),
  };
}

export function rangeDays(range: DateRange): number {
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
}

export function isSameRange(a: DateRange | null, b: DateRange | null): boolean {
  if (a === null || b === null) return a === b;
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
