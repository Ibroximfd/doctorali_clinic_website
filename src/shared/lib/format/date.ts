/**
 * Dates and times — ported from Flutter's `AppDateUtils`.
 *
 * The clinic runs on **Asia/Tashkent, a fixed UTC+5 with no DST**. The browser
 * might be anywhere, so nothing here reads the machine's zone: an API timestamp
 * is shifted into Tashkent wall-clock once on parse, and every formatter below
 * reads the resulting Date's UTC fields. A badge that says "Bugun" on the wrong
 * day is worse than no badge.
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
] as const;

export const MONTHS_SHORT_UZ = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
] as const;

const WEEKDAYS_UZ = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
] as const;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * A Tashkent wall-clock instant.
 *
 * It is a plain `Date` whose **UTC fields carry Tashkent local time** — the
 * same trick the Flutter app used. Read it only through the helpers here;
 * `getHours()` and friends would apply the browser's zone a second time.
 */
export type TashkentDate = Date & { readonly __tashkent?: unique symbol };

/**
 * Parses an API ISO-8601 timestamp (`2026-09-09T13:42:00+05:00`) into a
 * Tashkent wall-clock instant. Falls back to "now" for null/empty/unparseable
 * input, so a missing timestamp never breaks a list.
 */
export function tashkentFromApi(iso: string | null | undefined): TashkentDate {
  if (!iso) return nowTashkent();
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return nowTashkent();
  return new Date(parsed + TASHKENT_OFFSET_MS) as TashkentDate;
}

/** The current Tashkent wall clock. */
export function nowTashkent(): TashkentDate {
  return new Date(Date.now() + TASHKENT_OFFSET_MS) as TashkentDate;
}

/**
 * Parses a bare API date (`2026-09-09`) as Tashkent midnight. Tolerates a full
 * timestamp by keeping only the date part.
 */
export function dateFromYmd(ymd: string | null | undefined): TashkentDate {
  if (!ymd) return startOfDay(nowTashkent());
  const datePart = ymd.length >= 10 ? ymd.slice(0, 10) : ymd;
  const parsed = Date.parse(`${datePart}T00:00:00Z`);
  if (Number.isNaN(parsed)) return startOfDay(nowTashkent());
  return new Date(parsed) as TashkentDate;
}

/** Nullable parse: an absent timestamp must not become "now". */
export function maybeTashkentFromApi(
  iso: string | null | undefined,
): TashkentDate | null {
  if (iso === null || iso === undefined || iso === "") return null;
  return tashkentFromApi(iso);
}

/** `2026-09-09` — the bare API date form. */
export function ymd(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * `2026-09-09T13:42:00+05:00` — the inverse of {@link tashkentFromApi}, with
 * the fixed offset spelled out so the server files it under the right day.
 */
export function toApiIso(d: Date): string {
  return `${ymd(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:00`;
}

/** Tashkent midnight of the day `d` falls on. */
export function startOfDay(d: Date): TashkentDate {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ) as TashkentDate;
}

/** Adds whole days without tripping over a DST rule that does not exist here. */
export function addDays(d: Date, days: number): TashkentDate {
  return new Date(d.getTime() + days * 86_400_000) as TashkentDate;
}

/** Whole days between two Tashkent days (`b − a`). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/**
 * True when `d` is the current Tashkent calendar day — the backend's edit
 * window: anything else needs the 4-digit PIN.
 */
export function isToday(d: Date): boolean {
  const now = nowTashkent();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

/** True when `d` is the Tashkent day before today. */
export function isYesterday(d: Date): boolean {
  return isSameDay(d, addDays(startOfDay(nowTashkent()), -1));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// --- Display formatters ------------------------------------------------------

/** `9 sentabr 2026` */
export function dayMonthYear(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_UZ[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `9 sentabr` — where the year is obvious from context. */
export function dayMonth(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_UZ[d.getUTCMonth()]}`;
}

/** `9 sentabr, 14:30` */
export function dayMonthTime(d: Date): string {
  return `${dayMonth(d)}, ${hhmm(d)}`;
}

/** `9 sentabr 2026, 14:30` — the full stamp a record's header carries. */
export function dayMonthYearTime(d: Date): string {
  return `${dayMonthYear(d)}, ${hhmm(d)}`;
}

/** `09.09.2026` */
export function shortDate(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** `09.09.2026 14:30` */
export function shortDateTime(d: Date): string {
  return `${shortDate(d)} ${hhmm(d)}`;
}

/** `14:30` — for rows whose header already names the day. */
export function hhmm(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `Chorshanba` */
export function weekdayUz(d: Date): string {
  // getUTCDay(): 0 = Sunday. The Uzbek week starts on Monday.
  const index = (d.getUTCDay() + 6) % 7;
  return WEEKDAYS_UZ[index];
}

/** `Cho` — for a chart axis. */
export function weekdayShortUz(d: Date): string {
  return weekdayUz(d).slice(0, 3);
}

/** `Sen` — 1-based month. */
export function monthShort(month1to12: number): string {
  return MONTHS_SHORT_UZ[month1to12 - 1];
}

/** `sentabr` — 1-based month, lower case. */
export function monthLong(month1to12: number): string {
  return MONTHS_UZ[month1to12 - 1];
}

/**
 * "Bugun" / "Kecha" / "9 sentabr" — the relative wording the desk reads fastest.
 */
export function relativeDay(d: Date): string {
  const diff = daysBetween(nowTashkent(), d);
  if (diff === 0) return "Bugun";
  if (diff === -1) return "Kecha";
  if (diff === 1) return "Ertaga";
  return dayMonth(d);
}

/**
 * Calendar captions for `react-day-picker`.
 *
 * The one deliberate exception to "read UTC fields": the picker builds its own
 * grid from LOCAL dates, so these two read local fields. They exist only to put
 * Uzbek month and weekday names on the calendar — every date that carries
 * meaning still goes through the Tashkent helpers above.
 */
export function localMonthCaption(d: Date): string {
  return `${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()}`;
}

/** `Du` `Se` `Cho` … — the calendar's weekday header. */
export function localWeekdayShort(d: Date): string {
  return WEEKDAYS_UZ[(d.getDay() + 6) % 7].slice(0, 3);
}
