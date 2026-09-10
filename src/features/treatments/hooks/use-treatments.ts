"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import {
  cancelTreatment,
  createTreatment,
  deleteTreatment,
  fetchTreatmentSummary,
  fetchTreatmentTypes,
  fetchTreatments,
  previewTreatment,
  treatmentFilterKey,
  updateTreatment,
  type CreateTreatmentInput,
  type TreatmentFilter,
} from "../api/treatments-api";

export const treatmentKeys = {
  all: ["treatments"] as const,
  list: (filter: TreatmentFilter, page: number) =>
    [...treatmentKeys.all, "list", ...treatmentFilterKey(filter), page] as const,
  summary: (filter: TreatmentFilter) =>
    [...treatmentKeys.all, "summary", ...treatmentFilterKey(filter)] as const,
  types: () => [...treatmentKeys.all, "types"] as const,
};

export function useTreatmentsQuery(filter: TreatmentFilter, page: number) {
  return useQuery({
    queryKey: treatmentKeys.list(filter, page),
    queryFn: ({ signal }) => fetchTreatments({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useTreatmentSummaryQuery(filter: TreatmentFilter) {
  return useQuery({
    queryKey: treatmentKeys.summary(filter),
    queryFn: ({ signal }) => fetchTreatmentSummary(filter, signal),
    placeholderData: (previous) => previous,
  });
}

/** Descriptions used recently, for the autocomplete that keeps wording stable. */
export function useTreatmentTypesQuery() {
  return useQuery({
    queryKey: treatmentKeys.types(),
    queryFn: ({ signal }) => fetchTreatmentTypes(signal),
    staleTime: 10 * 60_000,
  });
}

/**
 * The server's commission for the service currently on the form.
 *
 * Only fires once there is a doctor and an amount to price. Kept as a query
 * rather than a mutation so React Query dedupes and caches identical
 * (kind, doctor, amount, debt) combinations — the desk edits an amount back and
 * forth constantly.
 */
export function useTreatmentPreviewQuery(input: {
  kind: "treatment" | "consultation";
  doctorId: string | null;
  amount: number;
  debtAmount: number;
  debtDueDate: number | null;
  enabled?: boolean;
}) {
  const enabled = (input.enabled ?? true) && input.doctorId !== null && input.amount > 0;

  return useQuery({
    queryKey: [
      ...treatmentKeys.all,
      "preview",
      input.kind,
      input.doctorId,
      input.amount,
      input.debtAmount,
    ],
    queryFn: ({ signal }) =>
      previewTreatment({
        kind: input.kind,
        doctorId: input.doctorId as string,
        amount: input.amount,
        debt:
          input.debtAmount > 0 && input.debtDueDate !== null
            ? {
                amount: input.debtAmount,
                dueDate: new Date(input.debtDueDate) as never,
                note: "",
              }
            : null,
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * A service moves money and earns a commission, so every mutation refreshes the
 * dashboard tills and the debts list alongside its own feature.
 */
function useInvalidateTreatments() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: treatmentKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
    void client.invalidateQueries({ queryKey: ["debts"] });
    void client.invalidateQueries({ queryKey: ["clients"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useCreateTreatment() {
  const invalidate = useInvalidateTreatments();
  return useMutation({
    mutationFn: (input: CreateTreatmentInput) => createTreatment(input),
    onSuccess: () => {
      invalidate();
      toast.success("Muolaja saqlandi");
    },
    onError: (error) => reportError(error, "Muolajani saqlab bo'lmadi"),
  });
}

export function useUpdateTreatment() {
  const invalidate = useInvalidateTreatments();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof updateTreatment>[1];
    }) => updateTreatment(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Muolaja yangilandi");
    },
    onError: (error) => reportError(error, "Muolajani yangilab bo'lmadi"),
  });
}

export function useCancelTreatment() {
  const invalidate = useInvalidateTreatments();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      confirmPin,
    }: {
      id: string;
      reason: string;
      confirmPin?: string | null;
    }) => cancelTreatment(id, { reason, confirmPin }),
    onSuccess: () => {
      invalidate();
      toast.success("Muolaja bekor qilindi");
    },
    onError: (error) => reportError(error, "Muolajani bekor qilib bo'lmadi"),
  });
}

export function useDeleteTreatment() {
  const invalidate = useInvalidateTreatments();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      confirmPin,
    }: {
      id: string;
      reason: string;
      confirmPin: string;
    }) => deleteTreatment(id, { reason, confirmPin }),
    onSuccess: () => {
      invalidate();
      toast.success("Muolaja o'chirildi");
    },
    onError: (error) => reportError(error, "Muolajani o'chirib bo'lmadi"),
  });
}
