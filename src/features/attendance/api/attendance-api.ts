import { endpoints } from "@/shared/lib/api/endpoints";
import { http } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  parseAttendanceSheet,
  parseAttendanceStatistics,
  parseEmployee,
  type AttendanceMark,
  type AttendanceSheet,
  type AttendanceStatistics,
  type AttendanceStatus,
  type Employee,
} from "../types/attendance";

// --- Employees ---------------------------------------------------------------

/** Which slice of the roster to list. The API defaults to active only. */
export type EmployeeActiveFilter = "active" | "inactive" | "all";

export const EMPLOYEE_ACTIVE_LABEL: Readonly<Record<EmployeeActiveFilter, string>> = {
  active: "Faol",
  inactive: "Nofaol",
  all: "Hammasi",
};

const ACTIVE_PARAM: Readonly<Record<EmployeeActiveFilter, string>> = {
  active: "true",
  inactive: "false",
  all: "all",
};

export const EMPLOYEE_ORDERINGS = [
  { value: "full_name", label: "F.I.O. (A→Z)" },
  { value: "-full_name", label: "F.I.O. (Z→A)" },
  { value: "-created_at", label: "Yangi qo'shilgan" },
  { value: "created_at", label: "Eski qo'shilgan" },
] as const;

export function fetchEmployees(input: {
  search?: string;
  active?: EmployeeActiveFilter;
  ordering?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Employee>> {
  return http
    .get<unknown>(endpoints.employees, {
      query: {
        page: input.page ?? 1,
        page_size: 20,
        is_active: ACTIVE_PARAM[input.active ?? "active"],
        ordering: input.ordering ?? "full_name",
        ...(input.search?.trim() ? { search: input.search.trim() } : {}),
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseEmployee));
}

export function createEmployee(input: {
  fullName: string;
  position?: string;
  phone?: string;
  note?: string;
}): Promise<Employee> {
  return http
    .post<unknown>(endpoints.employees, {
      json: {
        full_name: input.fullName.trim(),
        ...(input.position?.trim() ? { position: input.position.trim() } : {}),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    })
    .then(parseEmployee);
}

/**
 * Partial update — pass only what changed. A blank string is meaningful here
 * (clearing a position or a phone IS an edit), so only `undefined` is dropped.
 */
export function updateEmployee(
  id: string,
  patch: {
    fullName?: string;
    position?: string;
    phone?: string;
    note?: string;
    isActive?: boolean;
  },
): Promise<Employee> {
  return http
    .patch<unknown>(endpoints.employee(id), {
      json: {
        ...(patch.fullName !== undefined ? { full_name: patch.fullName.trim() } : {}),
        ...(patch.position !== undefined ? { position: patch.position.trim() } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
        ...(patch.note !== undefined ? { note: patch.note.trim() } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      },
    })
    .then(parseEmployee);
}

/**
 * `DELETE employees/{id}/` — which does **not** delete: the backend sets
 * `is_active=false`, because dropping the row would take the person's whole
 * attendance history (and every past report) with it.
 */
export function deactivateEmployee(id: string): Promise<void> {
  return http.delete<void>(endpoints.employee(id));
}

// --- The daily sheet ---------------------------------------------------------

/**
 * The sheet for a day (today when omitted). Always complete: unmarked
 * employees come back as `unmarked`.
 *
 * `search`/`status` are the server-side filters; the page filters the loaded
 * sheet in memory instead, so rows that are marked but not yet saved don't jump
 * out from under the cursor.
 */
export function fetchSheet(input: {
  date?: TashkentDate | null;
  search?: string;
  status?: AttendanceStatus | null;
  signal?: AbortSignal;
}): Promise<AttendanceSheet> {
  return http
    .get<unknown>(endpoints.attendance, {
      query: {
        ...(input.date ? { date: ymd(input.date) } : {}),
        ...(input.search?.trim() ? { search: input.search.trim() } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      signal: input.signal,
    })
    .then(parseAttendanceSheet);
}

/**
 * Saves one or many marks in a single request.
 *
 * All-or-nothing: one bad line and nothing is written, so a half-saved sheet
 * cannot happen. The response carries the refreshed sheet, so the caller never
 * has to re-`GET` after saving.
 */
export function saveMarks(input: {
  items: readonly AttendanceMark[];
  date?: TashkentDate | null;
}): Promise<{ sheet: AttendanceSheet; saved: number; cleared: number }> {
  return http
    .post<Record<string, unknown>>(endpoints.attendance, {
      json: {
        ...(input.date ? { date: ymd(input.date) } : {}),
        items: input.items.map((item) => ({
          employee_id: item.employeeId,
          status: item.status,
          // An unmarked line deletes the row, so its note has nowhere to live.
          ...(item.status !== "unmarked" && item.note.trim() !== ""
            ? { note: item.note.trim() }
            : {}),
        })),
      },
    })
    .then((data) => ({
      sheet: parseAttendanceSheet(data),
      saved: typeof data?.saved === "number" ? data.saved : 0,
      cleared: typeof data?.cleared === "number" ? data.cleared : 0,
    }));
}

/** Period statistics. Defaults to the start of this month through today. */
export function fetchAttendanceStatistics(input: {
  dateFrom?: TashkentDate | null;
  dateTo?: TashkentDate | null;
  employeeId?: string | null;
  search?: string;
  signal?: AbortSignal;
}): Promise<AttendanceStatistics> {
  return http
    .get<unknown>(endpoints.attendanceStatistics, {
      query: {
        ...(input.dateFrom ? { date_from: ymd(input.dateFrom) } : {}),
        ...(input.dateTo ? { date_to: ymd(input.dateTo) } : {}),
        ...(input.employeeId ? { employee: input.employeeId } : {}),
        ...(input.search?.trim() ? { search: input.search.trim() } : {}),
      },
      signal: input.signal,
    })
    .then(parseAttendanceStatistics);
}
