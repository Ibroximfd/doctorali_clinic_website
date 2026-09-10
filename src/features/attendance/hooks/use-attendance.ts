"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  createEmployee,
  deactivateEmployee,
  fetchAttendanceStatistics,
  fetchEmployees,
  fetchSheet,
  saveMarks,
  updateEmployee,
  type EmployeeActiveFilter,
} from "../api/attendance-api";
import type { AttendanceMark } from "../types/attendance";

export const attendanceKeys = {
  all: ["attendance"] as const,
  sheet: (date: TashkentDate | null) =>
    [...attendanceKeys.all, "sheet", date ? ymd(date) : "today"] as const,
  statistics: (from: TashkentDate | null, to: TashkentDate | null) =>
    [
      ...attendanceKeys.all,
      "statistics",
      from ? ymd(from) : null,
      to ? ymd(to) : null,
    ] as const,
  employees: (
    search: string,
    active: EmployeeActiveFilter,
    ordering: string,
    page: number,
  ) => [...attendanceKeys.all, "employees", search, active, ordering, page] as const,
};

export function useSheetQuery(date: TashkentDate | null) {
  return useQuery({
    queryKey: attendanceKeys.sheet(date),
    queryFn: ({ signal }) => fetchSheet({ date, signal }),
  });
}

export function useAttendanceStatisticsQuery(
  dateFrom: TashkentDate | null,
  dateTo: TashkentDate | null,
) {
  return useQuery({
    queryKey: attendanceKeys.statistics(dateFrom, dateTo),
    queryFn: ({ signal }) => fetchAttendanceStatistics({ dateFrom, dateTo, signal }),
  });
}

export function useEmployeesQuery(input: {
  search: string;
  active: EmployeeActiveFilter;
  ordering: string;
  page: number;
}) {
  return useQuery({
    queryKey: attendanceKeys.employees(
      input.search,
      input.active,
      input.ordering,
      input.page,
    ),
    queryFn: ({ signal }) => fetchEmployees({ ...input, signal }),
    placeholderData: (previous) => previous,
  });
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useSaveMarks() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      items: readonly AttendanceMark[];
      date: TashkentDate | null;
    }) => saveMarks(input),
    onSuccess: (result, variables) => {
      // The POST already returned the refreshed sheet — seed the cache with it
      // rather than firing a second GET the desk would have to wait for.
      client.setQueryData(attendanceKeys.sheet(variables.date), result.sheet);
      void client.invalidateQueries({
        queryKey: [...attendanceKeys.all, "statistics"],
      });
      const parts = [
        result.saved > 0 ? `${result.saved} ta belgilandi` : null,
        result.cleared > 0 ? `${result.cleared} ta olib tashlandi` : null,
      ].filter(Boolean);
      toast.success(parts.length > 0 ? parts.join(" · ") : "Saqlandi");
    },
    onError: (error) => reportError(error, "Yo'qlamani saqlab bo'lmadi"),
  });
}

function useInvalidateEmployees() {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: attendanceKeys.all });
}

export function useCreateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      invalidate();
      toast.success("Xodim qo'shildi");
    },
    onError: (error) => reportError(error, "Xodimni qo'shib bo'lmadi"),
  });
}

export function useUpdateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof updateEmployee>[1];
    }) => updateEmployee(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Xodim ma'lumoti yangilandi");
    },
    onError: (error) => reportError(error, "Xodimni yangilab bo'lmadi"),
  });
}

export function useDeactivateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => {
      invalidate();
      toast.success("Xodim ro'yxatdan chiqarildi");
    },
    onError: (error) => reportError(error, "Xodimni o'chirib bo'lmadi"),
  });
}
