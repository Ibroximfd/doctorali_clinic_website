"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import {
  cancelOrder,
  deleteOrder,
  fetchOrderDetail,
  fetchOrders,
  orderFilterKey,
  type OrderFilter,
} from "../api/orders-api";

export const orderKeys = {
  all: ["orders"] as const,
  list: (filter: OrderFilter, page: number) =>
    [...orderKeys.all, "list", ...orderFilterKey(filter), page] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

export function useOrdersQuery(filter: OrderFilter, page: number) {
  return useQuery({
    queryKey: orderKeys.list(filter, page),
    queryFn: ({ signal }) => fetchOrders({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useOrderDetailQuery(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchOrderDetail(id as string, signal),
    enabled: id !== null,
  });
}

/**
 * An order carries stock, commission, a debt and the client's loyalty count, so
 * every mutation refreshes all of them rather than just the orders list.
 */
export function useInvalidateOrders() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: orderKeys.all });
    void client.invalidateQueries({ queryKey: ["statistics"] });
    void client.invalidateQueries({ queryKey: ["debts"] });
    void client.invalidateQueries({ queryKey: ["clients"] });
    void client.invalidateQueries({ queryKey: ["warehouse"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useCancelOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      confirmPin,
    }: {
      id: string;
      reason?: string;
      confirmPin?: string | null;
    }) => cancelOrder(id, { reason, confirmPin }),
    onSuccess: () => {
      invalidate();
      toast.success("Buyurtma bekor qilindi");
    },
    onError: (error) => reportError(error, "Buyurtmani bekor qilib bo'lmadi"),
  });
}

export function useDeleteOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      confirmPin,
    }: {
      id: string;
      reason: string;
      confirmPin: string;
    }) => deleteOrder(id, { reason, confirmPin }),
    onSuccess: () => {
      invalidate();
      toast.success("Buyurtma o'chirildi");
    },
    onError: (error) => reportError(error, "Buyurtmani o'chirib bo'lmadi"),
  });
}
