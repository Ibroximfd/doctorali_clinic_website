"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { saveBlob } from "@/shared/lib/download";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  closeDay,
  exportDailyClosing,
  fetchAlerts,
  fetchDailyClosing,
} from "../api/alerts-api";

const ALERTS_ROOT = ["alerts"] as const;

export const alertKeys = {
  all: ALERTS_ROOT,
  list: () => [...ALERTS_ROOT, "list"] as const,
};

export const dailyKeys = {
  report: (date: TashkentDate | null) =>
    [...ALERTS_ROOT, "daily", date ? ymd(date) : "today"] as const,
};

/**
 * Today's signals.
 *
 * Refetched every two minutes: an overdue debt or an empty shelf appearing
 * while the panel sits open is exactly the case this card exists for.
 */
export function useAlertsQuery() {
  return useQuery({
    queryKey: alertKeys.list(),
    queryFn: ({ signal }) => fetchAlerts(signal),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

/**
 * The end-of-shift report.
 *
 * Not refetched on an interval: the sheet is read once, at the end of the day,
 * and a figure moving under the person counting the drawer would be worse than
 * a slightly stale one.
 */
export function useDailyClosingQuery(date: TashkentDate | null, enabled = true) {
  return useQuery({
    queryKey: dailyKeys.report(date),
    queryFn: ({ signal }) => fetchDailyClosing(date, signal),
    enabled,
  });
}

export function useCloseDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof closeDay>[0]) => closeDay(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: alertKeys.all });
      toast.success("Kun yopildi");
    },
    onError: (error) =>
      toast.error(ApiError.is(error) ? error.message : "Kunni yopib bo'lmadi"),
  });
}

export function useDailyClosingExport() {
  return useMutation({
    mutationFn: (input: Parameters<typeof exportDailyClosing>[0]) =>
      exportDailyClosing(input),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
    onError: (error) =>
      toast.error(ApiError.is(error) ? error.message : "Hisobotni yuklab bo'lmadi"),
  });
}
