"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { saveBlob } from "@/shared/lib/download";
import type { TashkentDate } from "@/shared/lib/format/date";

import {
  cancelDebt,
  debtFilterKey,
  exportDebts,
  fetchDebt,
  fetchDebtSummary,
  fetchDebts,
  payDebt,
  updateDebt,
  type DebtFilter,
  type PayDebtInput,
} from "../api/debts-api";

export const debtKeys = {
  all: ["debts"] as const,
  list: (filter: DebtFilter, page: number) =>
    [...debtKeys.all, "list", ...debtFilterKey(filter), page] as const,
  summary: () => [...debtKeys.all, "summary"] as const,
  detail: (id: string) => [...debtKeys.all, "detail", id] as const,
};

export function useDebtsQuery(filter: DebtFilter, page: number) {
  return useQuery({
    queryKey: debtKeys.list(filter, page),
    queryFn: ({ signal }) => fetchDebts({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useDebtSummaryQuery() {
  return useQuery({
    queryKey: debtKeys.summary(),
    queryFn: ({ signal }) => fetchDebtSummary(signal),
  });
}

export function useDebtQuery(id: string | null) {
  return useQuery({
    queryKey: debtKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchDebt(id as string, signal),
    enabled: id !== null,
  });
}

/**
 * A debt change moves money, so it invalidates more than the debts list: the
 * dashboard tills, the client card and the orders list all quote the same
 * balance.
 */
function useInvalidateDebts() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: debtKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
    void client.invalidateQueries({ queryKey: ["clients"] });
    void client.invalidateQueries({ queryKey: ["orders"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function usePayDebt() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PayDebtInput }) =>
      payDebt(id, input),
    onSuccess: () => {
      invalidate();
      toast.success("To'lov qabul qilindi");
    },
    onError: (error) => reportError(error, "To'lovni qayd etib bo'lmadi"),
  });
}

export function useExtendDebt() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: ({
      id,
      dueDate,
      note,
    }: {
      id: string;
      dueDate?: TashkentDate;
      note?: string;
    }) => updateDebt(id, { dueDate, note }),
    onSuccess: () => {
      invalidate();
      toast.success("Muddat uzaytirildi");
    },
    onError: (error) => reportError(error, "Muddatni uzaytirib bo'lmadi"),
  });
}

export function useCancelDebt() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      confirmPin,
    }: {
      id: string;
      reason: string;
      confirmPin?: string;
    }) => cancelDebt(id, { reason, confirmPin }),
    onSuccess: () => {
      invalidate();
      toast.success("Qarz hisobdan chiqarildi");
    },
    onError: (error) => reportError(error, "Qarzni bekor qilib bo'lmadi"),
  });
}

export function useDebtsExport() {
  return useMutation({
    mutationFn: (filter: DebtFilter) => exportDebts(filter),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
    onError: (error) => reportError(error, "Faylni yuklab olishda xatolik"),
  });
}
