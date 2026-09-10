"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import {
  createExpense,
  deleteExpense,
  expenseFilterKey,
  fetchExpenseSummary,
  fetchExpenses,
  updateExpense,
  type ExpenseFilter,
  type ExpenseInput,
} from "../api/expenses-api";

export const expenseKeys = {
  all: ["expenses"] as const,
  list: (filter: ExpenseFilter, page: number) =>
    [...expenseKeys.all, "list", ...expenseFilterKey(filter), page] as const,
  summary: (filter: ExpenseFilter) =>
    [...expenseKeys.all, "summary", ...expenseFilterKey(filter)] as const,
};

export function useExpensesQuery(filter: ExpenseFilter, page: number) {
  return useQuery({
    queryKey: expenseKeys.list(filter, page),
    queryFn: ({ signal }) => fetchExpenses({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useExpenseSummaryQuery(filter: ExpenseFilter) {
  return useQuery({
    queryKey: expenseKeys.summary(filter),
    queryFn: ({ signal }) => fetchExpenseSummary(filter, signal),
    placeholderData: (previous) => previous,
  });
}

/**
 * Every expense mutation invalidates the whole feature: the list, the summary
 * strip and (through the dashboard's own key) the till figures all describe the
 * same money, so refreshing one without the others is how a screen starts
 * contradicting itself.
 */
function useInvalidateExpenses() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: expenseKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => {
      invalidate();
      toast.success("Xarajat qo'shildi");
    },
    onError: (error) => reportError(error, "Xarajatni saqlab bo'lmadi"),
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ExpenseInput> }) =>
      updateExpense(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Xarajat yangilandi");
    },
    onError: (error) => reportError(error, "Xarajatni yangilab bo'lmadi"),
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      invalidate();
      toast.success("Xarajat o'chirildi");
    },
    onError: (error) => reportError(error, "Xarajatni o'chirib bo'lmadi"),
  });
}
