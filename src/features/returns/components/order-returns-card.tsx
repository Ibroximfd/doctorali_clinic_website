"use client";

import { Undo2 } from "lucide-react";

import { shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

import { useOrderReturnsQuery } from "../hooks/use-returns";
import { refundSummary, returnTotalUnits } from "../types/order-return";

/**
 * What has already been sent back from this order.
 *
 * Without it the order simply shows smaller numbers than the receipt in the
 * client's hand, and nothing on screen explains why — the lines themselves are
 * reduced or gone, so the return is invisible where it matters most.
 */
export function OrderReturnsCard({ orderId }: { orderId: string }) {
  const { data } = useOrderReturnsQuery(orderId);
  const returns = data?.results ?? [];
  if (returns.length === 0) return null;

  return (
    <section
      aria-label="Qaytarishlar"
      className="border-warning/30 bg-warning/6 rounded-md border p-3"
    >
      <div className="flex items-center gap-2">
        <Undo2 className="text-warning size-4 shrink-0" aria-hidden />
        <h3 className="text-label flex-1">Qaytarilgan</h3>
        <span className="text-caption text-text-tertiary tabular">
          {returns.length} ta hujjat
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {returns.map((doc) => (
          <li key={doc.id} className="text-caption flex flex-wrap items-baseline gap-x-2">
            <span className="text-text-tertiary tabular">
              {shortDateTime(doc.createdAt)}
            </span>
            <span className="text-text-secondary min-w-0 flex-1 truncate">
              {returnTotalUnits(doc)} dona
              {doc.reason !== "" && ` · ${doc.reason}`}
              {doc.createdByName !== "" && ` · ${doc.createdByName}`}
            </span>
            <span className="text-title-sm tabular shrink-0">
              {money.plain(doc.returnedValue)}
            </span>
            <span className="text-text-tertiary tabular w-full text-right">
              {refundSummary(doc)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
