import {
  dateFromYmd,
  isToday,
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";

/**
 * Roll-call status.
 *
 * `unmarked` is a real third state, not an empty value: at the start of the day
 * everybody sits there, and the backend simply keeps no row for such an
 * employee. The sheet endpoint still returns them, so nobody silently drops off
 * the roll-call.
 */
export const ATTENDANCE_STATUSES = ["present", "absent", "unmarked"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function parseAttendanceStatus(raw: unknown): AttendanceStatus {
  return raw === "present" || raw === "absent" ? raw : "unmarked";
}

export const ATTENDANCE_STATUS_LABEL: Readonly<Record<AttendanceStatus, string>> = {
  present: "Keldi",
  absent: "Kelmadi",
  unmarked: "Belgilanmagan",
};

/** True for the two states that actually put a row in the database. */
export function isMarked(status: AttendanceStatus): boolean {
  return status !== "unmarked";
}

/**
 * A clinic employee on reception's own roster.
 *
 * Only `fullName` is mandatory — a desk that knows a person's name should be
 * able to add them to the roll-call without hunting for a phone number.
 */
export interface Employee {
  readonly id: string;
  readonly fullName: string;
  /** Free-text job title ("Sotuvchi"), empty when not filled in. */
  readonly position: string;
  /** `998901234567` exactly as the API stores it. */
  readonly phone: string;
  /**
   * A "deleted" employee is really deactivated: dropping the row would take
   * their whole attendance history — and every past report — with it.
   */
  readonly isActive: boolean;
  readonly note: string;
  readonly createdAt: TashkentDate;
}

export function employeePhonePretty(employee: Employee): string {
  return employee.phone === "" ? "" : phoneFromApi(employee.phone);
}

/** The `counts` block of a sheet — ready-made numbers for the top cards. */
export interface AttendanceCounts {
  readonly present: number;
  readonly absent: number;
  readonly unmarked: number;
}

export const ZERO_COUNTS: AttendanceCounts = {
  present: 0,
  absent: 0,
  unmarked: 0,
};

export function countsTotal(c: AttendanceCounts): number {
  return c.present + c.absent + c.unmarked;
}

/**
 * Kelganlar ulushi — `present / (present + absent)`, in percent. Returns 0
 * while nobody has been marked: 0/0 is not "0% turnout".
 */
export function attendanceRate(c: AttendanceCounts): number {
  const marked = c.present + c.absent;
  return marked === 0 ? 0 : (c.present * 100) / marked;
}

export function countsFromStatuses(
  statuses: Iterable<AttendanceStatus>,
): AttendanceCounts {
  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const status of statuses) {
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else unmarked++;
  }
  return { present, absent, unmarked };
}

/**
 * One row of a daily sheet. `markedAt` / `markedBy` answer "kim va qachon
 * belgiladi?" right in the row; both are null while the row is unmarked.
 */
export interface AttendanceEntry {
  readonly employee: Employee;
  readonly status: AttendanceStatus;
  /** Free-text reason ("Kasal", "Ta'tilda"). */
  readonly note: string;
  readonly markedAt: TashkentDate | null;
  readonly markedBy: string;
}

/**
 * A whole day's roll-call.
 *
 * The list is always complete: every active employee is in `entries`, the
 * untouched ones as `unmarked`. That is what stops somebody quietly falling off
 * the sheet on a busy morning.
 */
export interface AttendanceSheet {
  readonly date: TashkentDate;
  readonly isToday: boolean;
  readonly counts: AttendanceCounts;
  readonly entries: readonly AttendanceEntry[];
  readonly total: number;
}

/** One line of a save — or, with `unmarked`, taking a mark back off. */
export interface AttendanceMark {
  readonly employeeId: string;
  readonly status: AttendanceStatus;
  readonly note: string;
}

/** The `summary` block of the statistics tab. */
export interface AttendanceSummary {
  readonly dateFrom: TashkentDate;
  readonly dateTo: TashkentDate;
  readonly employees: number;
  /**
   * Days on which at least one mark was made. There is no working-day calendar
   * on the backend, so a Sunday nobody marked is not counted at all and cannot
   * drag the percentage down.
   */
  readonly rollcallDays: number;
  readonly present: number;
  readonly absent: number;
  readonly unmarked: number;
  /** `present / (present + absent) × 100`, straight from the server. */
  readonly attendanceRate: number;
}

export interface EmployeeAttendanceStat {
  readonly employee: Employee;
  readonly present: number;
  readonly absent: number;
  readonly unmarked: number;
  readonly attendanceRate: number;
}

export interface DayAttendanceStat {
  readonly date: TashkentDate;
  readonly counts: AttendanceCounts;
}

export interface AttendanceStatistics {
  readonly summary: AttendanceSummary;
  readonly byEmployee: readonly EmployeeAttendanceStat[];
  readonly byDay: readonly DayAttendanceStat[];
}

// --- Parsing ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseEmployee(raw: unknown): Employee {
  const e = isRecord(raw) ? raw : {};
  return {
    id: str(e.id),
    fullName: str(e.full_name),
    position: str(e.position),
    phone: str(e.phone),
    isActive: e.is_active !== false,
    note: str(e.note),
    createdAt: tashkentFromApi(str(e.created_at)),
  };
}

export function parseAttendanceCounts(raw: unknown): AttendanceCounts {
  const c = isRecord(raw) ? raw : {};
  return {
    present: num(c.present),
    absent: num(c.absent),
    unmarked: num(c.unmarked),
  };
}

export function parseAttendanceEntry(raw: unknown): AttendanceEntry {
  const e = isRecord(raw) ? raw : {};
  const markedAt = str(e.marked_at);
  return {
    employee: parseEmployee(e.employee),
    status: parseAttendanceStatus(e.status),
    note: str(e.note),
    // A null timestamp would otherwise fall back to "now" and show a mark time
    // on an unmarked row.
    markedAt: markedAt === "" ? null : maybeTashkentFromApi(markedAt),
    markedBy: str(e.marked_by),
  };
}

export function parseAttendanceSheet(raw: unknown): AttendanceSheet {
  const s = isRecord(raw) ? raw : {};
  const entries = Array.isArray(s.results) ? s.results.map(parseAttendanceEntry) : [];
  const date = dateFromYmd(str(s.date));
  return {
    date,
    // The save response omits `is_today`/`total`; derive them so a POST answer
    // is as usable as a GET one and no second request is needed.
    isToday: typeof s.is_today === "boolean" ? s.is_today : isToday(date),
    counts: parseAttendanceCounts(s.counts),
    entries,
    total: num(s.total, entries.length),
  };
}

export function parseAttendanceStatistics(raw: unknown): AttendanceStatistics {
  const s = isRecord(raw) ? raw : {};
  const summary = isRecord(s.summary) ? s.summary : {};
  return {
    summary: {
      dateFrom: dateFromYmd(str(summary.date_from)),
      dateTo: dateFromYmd(str(summary.date_to)),
      employees: num(summary.employees),
      rollcallDays: num(summary.rollcall_days),
      present: num(summary.present),
      absent: num(summary.absent),
      unmarked: num(summary.unmarked),
      attendanceRate: num(summary.attendance_rate),
    },
    byEmployee: Array.isArray(s.by_employee)
      ? s.by_employee.map((row) => {
          const r = isRecord(row) ? row : {};
          return {
            employee: parseEmployee(r.employee),
            present: num(r.present),
            absent: num(r.absent),
            unmarked: num(r.unmarked),
            attendanceRate: num(r.attendance_rate),
          };
        })
      : [],
    byDay: Array.isArray(s.by_day)
      ? s.by_day.map((row) => {
          const r = isRecord(row) ? row : {};
          return {
            date: dateFromYmd(str(r.date)),
            counts: parseAttendanceCounts(r),
          };
        })
      : [],
  };
}
