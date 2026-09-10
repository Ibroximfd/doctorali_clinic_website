"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { saveBlob } from "@/shared/lib/download";

import type { PaymentType } from "@/shared/domain/payment-type";

import {
  exportStatistics,
  fetchDashboard,
  fetchDoctorDetail,
  fetchDoctorStats,
  fetchPaymentTypeIncome,
  fetchProductStats,
  statsQueryKey,
  type StatsQuery,
} from "../api/statistics-api";

/** Query keys, in one place so an invalidation can target exactly one slice. */
export const statisticsKeys = {
  all: ["statistics"] as const,
  dashboard: (query: StatsQuery) =>
    [...statisticsKeys.all, "dashboard", ...statsQueryKey(query)] as const,
  products: (query: StatsQuery, ordering: string, search: string, page: number) =>
    [
      ...statisticsKeys.all,
      "products",
      ...statsQueryKey(query),
      ordering,
      search,
      page,
    ] as const,
  doctors: (query: StatsQuery, ordering: string, search: string, page: number) =>
    [
      ...statisticsKeys.all,
      "doctors",
      ...statsQueryKey(query),
      ordering,
      search,
      page,
    ] as const,
  doctorDetail: (doctorId: string, query: StatsQuery) =>
    [...statisticsKeys.all, "doctor", doctorId, ...statsQueryKey(query)] as const,
};

/**
 * The dashboard figures for a period.
 *
 * `placeholderData: keepPreviousData` is what makes switching Bugun→Hafta feel
 * instant: the previous period's numbers stay on screen, dimmed, instead of the
 * whole page collapsing to skeletons. React Query also discards the answer of a
 * superseded request, which is the out-of-order guard the Flutter bloc had to
 * hand-roll with a generation counter.
 */
export function useDashboardQuery(query: StatsQuery) {
  return useQuery({
    queryKey: statisticsKeys.dashboard(query),
    queryFn: ({ signal }) => fetchDashboard(query, signal),
    placeholderData: (previous) => previous,
  });
}

export function useProductStatsQuery(input: {
  query: StatsQuery;
  ordering?: string;
  search?: string;
  page?: number;
  enabled?: boolean;
}) {
  const ordering = input.ordering ?? "-revenue";
  const search = input.search ?? "";
  const page = input.page ?? 1;
  return useQuery({
    queryKey: statisticsKeys.products(input.query, ordering, search, page),
    queryFn: ({ signal }) =>
      fetchProductStats({ query: input.query, ordering, search, page, signal }),
    enabled: input.enabled ?? true,
    placeholderData: (previous) => previous,
  });
}

export function useDoctorStatsQuery(input: {
  query: StatsQuery;
  ordering?: string;
  search?: string;
  page?: number;
}) {
  const ordering = input.ordering ?? "-revenue";
  const search = input.search ?? "";
  const page = input.page ?? 1;
  return useQuery({
    queryKey: statisticsKeys.doctors(input.query, ordering, search, page),
    queryFn: ({ signal }) =>
      fetchDoctorStats({ query: input.query, ordering, search, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useDoctorDetailQuery(doctorId: string, query: StatsQuery) {
  return useQuery({
    queryKey: statisticsKeys.doctorDetail(doctorId, query),
    queryFn: ({ signal }) => fetchDoctorDetail({ doctorId, query, signal }),
    enabled: doctorId !== "",
    placeholderData: (previous) => previous,
  });
}

/** Downloads the `.xlsx` for the filters currently on screen. */
export function useStatisticsExport() {
  return useMutation({
    mutationFn: (query: StatsQuery) => exportStatistics(query),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
    onError: (error) => {
      toast.error(ApiError.is(error) ? error.message : "Faylni yuklab olishda xatolik");
    },
  });
}

/**
 * The records behind one till tile.
 *
 * Only fetched while the drill-down is open: it is a much heavier answer than
 * the dashboard itself, and nobody needs it until they ask which sales made up
 * the figure.
 */
export function usePaymentTypeIncomeQuery(type: PaymentType | null, query: StatsQuery) {
  return useQuery({
    queryKey: [...statisticsKeys.all, "payment-type", type, ...statsQueryKey(query)],
    queryFn: ({ signal }) =>
      fetchPaymentTypeIncome({ type: type as PaymentType, query, signal }),
    enabled: type !== null,
  });
}
