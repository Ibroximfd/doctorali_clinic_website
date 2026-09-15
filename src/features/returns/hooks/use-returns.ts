"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useInvalidateOrders } from "@/features/orders/hooks/use-orders";
import { ApiError } from "@/shared/lib/api/errors";

import {
  createReturn,
  fetchReturns,
  returnFilterKey,
  updateReturnReason,
  type ReturnDraft,
  type ReturnFilter,
} from "../api/returns-api";

export const returnKeys = {
  all: ["returns"] as const,
  list: (filter: ReturnFilter, page: number) =>
    [...returnKeys.all, "list", ...returnFilterKey(filter), page] as const,
};

export function useReturnsQuery(filter: ReturnFilter, page: number) {
  return useQuery({
    queryKey: returnKeys.list(filter, page),
    queryFn: ({ signal }) => fetchReturns({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

/** The returns already made against one order — shown on its detail. */
export function useOrderReturnsQuery(orderId: string | null) {
  const filter: ReturnFilter = { orderId };
  return useQuery({
    queryKey: returnKeys.list(filter, 1),
    queryFn: ({ signal }) => fetchReturns({ filter, page: 1, signal }),
    enabled: orderId !== null,
  });
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

/**
 * Files a return.
 *
 * A return moves stock, money, commission and debt at once, so everything the
 * orders mutations refresh is refreshed here too — plus the returns list. The
 * ORDER itself changes (lines shrink or disappear, the total drops, a full
 * return cancels it), which is exactly why nothing may be shown from cache
 * afterwards.
 */
export function useCreateReturn() {
  const invalidateOrders = useInvalidateOrders();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, draft }: { orderId: string; draft: ReturnDraft }) =>
      createReturn(orderId, draft),
    onSuccess: () => {
      invalidateOrders();
      void client.invalidateQueries({ queryKey: returnKeys.all });
    },
    // The dialog keeps the server's sentence on screen itself; the toast is
    // what catches the eye of someone already reaching for the next order.
    onError: (error) => reportError(error, "Qaytarishni rasmiylashtirib bo'lmadi"),
  });
}

export function useUpdateReturnReason() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      updateReturnReason(id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: returnKeys.all });
      toast.success("Sabab yangilandi");
    },
    onError: (error) => reportError(error, "Sababni saqlab bo'lmadi"),
  });
}
