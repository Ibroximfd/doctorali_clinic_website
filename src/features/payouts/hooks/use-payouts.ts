"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import {
  cancelPayout,
  fetchOutstanding,
  fetchPayout,
  fetchPayouts,
  fetchWeekDetail,
  payWeek,
  payoutFilterKey,
  type PayoutFilter,
} from "../api/payouts-api";

export const payoutKeys = {
  all: ["payouts"] as const,
  outstanding: (doctorId: string | null) =>
    [...payoutKeys.all, "outstanding", doctorId] as const,
  week: (doctorId: string, weekStart: string) =>
    [...payoutKeys.all, "week", doctorId, weekStart] as const,
  list: (filter: PayoutFilter, page: number) =>
    [...payoutKeys.all, "list", ...payoutFilterKey(filter), page] as const,
  detail: (id: string) => [...payoutKeys.all, "detail", id] as const,
};

export function useOutstandingQuery(doctorId: string | null = null) {
  return useQuery({
    queryKey: payoutKeys.outstanding(doctorId),
    queryFn: ({ signal }) => fetchOutstanding(doctorId, signal),
  });
}

export function useWeekDetailQuery(doctorId: string | null, weekStart: string | null) {
  return useQuery({
    queryKey: payoutKeys.week(doctorId ?? "", weekStart ?? ""),
    queryFn: ({ signal }) =>
      fetchWeekDetail({
        doctorId: doctorId as string,
        weekStart: weekStart as string,
        signal,
      }),
    enabled: doctorId !== null && weekStart !== null,
  });
}

export function usePayoutsQuery(filter: PayoutFilter, page: number) {
  return useQuery({
    queryKey: payoutKeys.list(filter, page),
    queryFn: ({ signal }) => fetchPayouts({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function usePayoutQuery(id: string | null) {
  return useQuery({
    queryKey: payoutKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchPayout(id as string, signal),
    enabled: id !== null,
  });
}

function useInvalidatePayouts() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: payoutKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function usePayWeek() {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: (input: { doctorId: string; weekStart: string; note?: string }) =>
      payWeek(input),
    onSuccess: () => {
      invalidate();
      toast.success("Hafta to'landi deb belgilandi");
    },
    onError: (error) => reportError(error, "To'lovni qayd etib bo'lmadi"),
  });
}

export function useCancelPayout() {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelPayout(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("To'lov bekor qilindi");
    },
    onError: (error) => reportError(error, "To'lovni bekor qilib bo'lmadi"),
  });
}
