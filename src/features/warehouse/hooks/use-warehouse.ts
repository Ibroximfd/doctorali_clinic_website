"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";
import { saveBlob } from "@/shared/lib/download";

import {
  cancelReceipt,
  cancelWriteOff,
  confirmCount,
  confirmReceipt,
  confirmWriteOff,
  createCount,
  createReceipt,
  createWriteOff,
  exportWarehouse,
  fetchCounts,
  fetchMovements,
  fetchReceipts,
  fetchStock,
  fetchStockItem,
  fetchWarehouseSummary,
  fetchWriteOffs,
  movementFilterKey,
  stockFilterKey,
  updateCountLines,
  updatePackaging,
  updateStockSettings,
  type MovementFilter,
  type PackagingUpdate,
  type ReceiptDraft,
  type StockFilter,
  type WriteOffDraft,
} from "../api/warehouse-api";

const WAREHOUSE_ROOT = ["warehouse"] as const;

export const warehouseKeys = {
  all: WAREHOUSE_ROOT,
  stock: (filter: StockFilter, page: number) =>
    [...WAREHOUSE_ROOT, "stock", ...stockFilterKey(filter), page] as const,
  item: (productId: string) => [...WAREHOUSE_ROOT, "item", productId] as const,
  movements: (filter: MovementFilter, page: number) =>
    [...WAREHOUSE_ROOT, "movements", ...movementFilterKey(filter), page] as const,
  summary: [...WAREHOUSE_ROOT, "summary"] as const,
  receipts: (page: number) => [...WAREHOUSE_ROOT, "receipts", page] as const,
  writeOffs: (page: number) => [...WAREHOUSE_ROOT, "write-offs", page] as const,
  counts: (page: number) => [...WAREHOUSE_ROOT, "counts", page] as const,
};

export function useStockQuery(filter: StockFilter, page: number) {
  return useQuery({
    queryKey: warehouseKeys.stock(filter, page),
    queryFn: ({ signal }) => fetchStock({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useStockItemQuery(productId: string | null) {
  return useQuery({
    queryKey: warehouseKeys.item(productId ?? ""),
    queryFn: ({ signal }) => fetchStockItem(productId as string, signal),
    enabled: productId !== null,
  });
}

export function useMovementsQuery(filter: MovementFilter, page: number) {
  return useQuery({
    queryKey: warehouseKeys.movements(filter, page),
    queryFn: ({ signal }) => fetchMovements({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

export function useWarehouseSummaryQuery() {
  return useQuery({
    queryKey: warehouseKeys.summary,
    queryFn: ({ signal }) => fetchWarehouseSummary(signal),
    staleTime: 60_000,
  });
}

export function useReceiptsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.receipts(page),
    queryFn: ({ signal }) => fetchReceipts(page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useWriteOffsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.writeOffs(page),
    queryFn: ({ signal }) => fetchWriteOffs(page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useCountsQuery(page: number, enabled = true) {
  return useQuery({
    queryKey: warehouseKeys.counts(page),
    queryFn: ({ signal }) => fetchCounts(page, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/**
 * A confirmed document moves stock, which changes the balances, the ledger, the
 * summary AND the product catalog the order form sells from — so they are all
 * refreshed together rather than leaving one of them claiming a quantity that
 * no longer exists.
 */
export function useInvalidateWarehouse() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: warehouseKeys.all });
    void client.invalidateQueries({ queryKey: ["products"] });
    void client.invalidateQueries({ queryKey: ["alerts"] });
  };
}

function reportError(error: unknown, fallback: string) {
  toast.error(ApiError.is(error) ? error.message : fallback);
}

export function useUpdateStockSettings() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: ({
      productId,
      changes,
    }: {
      productId: string;
      changes: { minQuantity?: number; trackStock?: boolean };
    }) => updateStockSettings(productId, changes),
    onSuccess: () => {
      invalidate();
      toast.success("Sozlama saqlandi");
    },
    onError: (error) => reportError(error, "Sozlamani saqlab bo'lmadi"),
  });
}

export function useUpdatePackaging() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: ({
      productId,
      changes,
    }: {
      productId: string;
      changes: PackagingUpdate;
    }) => updatePackaging(productId, changes),
    onSuccess: () => {
      invalidate();
      toast.success("Qadoq sozlamasi saqlandi");
    },
    onError: (error) => reportError(error, "Qadoqni saqlab bo'lmadi"),
  });
}

export function useCreateReceipt() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (draft: ReceiptDraft) => createReceipt(draft),
    onSuccess: () => invalidate(),
    onError: (error) => reportError(error, "Kirimni saqlab bo'lmadi"),
  });
}

export function useConfirmReceipt() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (id: string) => confirmReceipt(id),
    onSuccess: () => {
      invalidate();
      toast.success("Kirim tasdiqlandi — qoldiq yangilandi");
    },
    onError: (error) => reportError(error, "Kirimni tasdiqlab bo'lmadi"),
  });
}

export function useCancelReceipt() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelReceipt(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Kirim bekor qilindi");
    },
    onError: (error) => reportError(error, "Kirimni bekor qilib bo'lmadi"),
  });
}

export function useCreateWriteOff() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (draft: WriteOffDraft) => createWriteOff(draft),
    onSuccess: () => invalidate(),
    onError: (error) => reportError(error, "Chiqimni saqlab bo'lmadi"),
  });
}

export function useConfirmWriteOff() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (id: string) => confirmWriteOff(id),
    onSuccess: () => {
      invalidate();
      toast.success("Chiqim tasdiqlandi");
    },
    onError: (error) => reportError(error, "Chiqimni tasdiqlab bo'lmadi"),
  });
}

export function useCancelWriteOff() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelWriteOff(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Chiqim bekor qilindi");
    },
    onError: (error) => reportError(error, "Chiqimni bekor qilib bo'lmadi"),
  });
}

export function useCreateCount() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (input: { productIds?: readonly string[]; note?: string }) =>
      createCount(input),
    onSuccess: () => invalidate(),
    onError: (error) => reportError(error, "Inventarizatsiyani ochib bo'lmadi"),
  });
}

/**
 * Saves what has been counted so far.
 *
 * Deliberately silent on success: this fires while someone is typing their way
 * along a shelf, and a toast per line would be unusable.
 */
export function useSaveCountLines() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      counted,
    }: {
      id: string;
      counted: Readonly<Record<string, number>>;
    }) => updateCountLines(id, counted),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: [...WAREHOUSE_ROOT, "counts"],
      });
    },
    onError: (error) => reportError(error, "Sanoqni saqlab bo'lmadi"),
  });
}

export function useConfirmCount() {
  const invalidate = useInvalidateWarehouse();
  return useMutation({
    mutationFn: (id: string) => confirmCount(id),
    onSuccess: () => {
      invalidate();
      toast.success("Inventarizatsiya yakunlandi");
    },
    onError: (error) => reportError(error, "Inventarizatsiyani yakunlab bo'lmadi"),
  });
}

export function useWarehouseExport() {
  return useMutation({
    mutationFn: (input: Parameters<typeof exportWarehouse>[0]) => exportWarehouse(input),
    onSuccess: ({ blob, fileName }) => {
      saveBlob(blob, fileName);
      toast.success("Fayl yuklandi");
    },
    onError: (error) => reportError(error, "Eksport qilib bo'lmadi"),
  });
}
