"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api/errors";

import { printReceipt, ReceiptPrintError } from "../api/print-agent";
import { fetchReceipt } from "../api/receipt-api";
import { markAttempted, readAttempted } from "../lib/print-log";

/**
 * The set of orders whose receipt has been sent to the printer on this device,
 * as a subscribable store so every list row updates the moment one prints.
 */
let attempted = new Set<string>();
let hydrated = false;
const listeners = new Set<() => void>();

function snapshot(): Set<string> {
  if (!hydrated && typeof window !== "undefined") {
    attempted = readAttempted();
    hydrated = true;
  }
  return attempted;
}

const EMPTY = new Set<string>();

export function usePrintedOrders(): Set<string> {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    snapshot,
    () => EMPTY,
  );
}

function recordPrinted(orderId: string): void {
  markAttempted(orderId);
  attempted = new Set(attempted).add(orderId);
  for (const listener of listeners) listener();
}

/**
 * Prints a receipt.
 *
 * Deliberately independent from order creation: saving an order never waits on
 * — and can never be broken by — printing. A printer failure shows a toast with
 * a retry and leaves the sale saved; reception can reprint from the list at any
 * time.
 */
export function useReceiptPrint() {
  const mutation = useMutation({
    mutationFn: async (job: {
      orderId: string;
      /** The payload the create response already carried, when there is one. */
      receipt?: Record<string, unknown> | null;
    }) => {
      // Prefer the payload from the create response; otherwise fetch it
      // (a reprint, or an older backend that omitted it on create).
      const payload = job.receipt ?? (await fetchReceipt(job.orderId));
      await printReceipt(payload);
      return job.orderId;
    },
    onSuccess: (orderId) => {
      recordPrinted(orderId);
      toast.success("Chek chiqarildi");
    },
    onError: (error) => {
      const message =
        error instanceof ReceiptPrintError
          ? error.message
          : ApiError.is(error)
            ? error.message
            : "Chek chiqmadi — buyurtmalar ro'yxatidan qayta chiqarish mumkin";
      toast.error(`Chek chiqmadi: ${message}`);
    },
  });

  const print = useCallback(
    (orderId: string, receipt?: Record<string, unknown> | null) => {
      mutation.mutate({ orderId, receipt: receipt ?? null });
    },
    [mutation],
  );

  return {
    print,
    isPrinting: mutation.isPending,
    printingId: mutation.variables?.orderId,
  };
}
