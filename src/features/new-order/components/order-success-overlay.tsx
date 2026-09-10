"use client";

import { Check, Gift, Plus, Printer } from "lucide-react";
import { useEffect } from "react";

import type { CreateOrderResult } from "@/features/orders/types/order";
import { Button } from "@/shared/components/ui/button";
import { money } from "@/shared/lib/format/money";
import { resolveMediaUrl } from "@/shared/lib/media";

/**
 * The confirmation after a sale is booked.
 *
 * It stays until dismissed rather than auto-closing: the gift line is the one
 * thing reception has to ACT on (hand the product over), and a toast that fades
 * after four seconds is how a client leaves without it.
 */
export function OrderSuccessOverlay({
  result,
  onPrint,
  onNewOrder,
  printing,
}: {
  result: CreateOrderResult;
  onPrint: () => void;
  onNewOrder: () => void;
  printing: boolean;
}) {
  // The receipt goes to the printer on its own; this is the confirmation, not
  // the trigger, so nothing here waits on the printer.
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById("new-order-again")?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const gift = result.gift;
  const giftImage = resolveMediaUrl(gift?.imageUrl ?? null);

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border bg-surface flex flex-col items-center gap-5 rounded-lg border p-8 text-center shadow-lg"
    >
      <span
        className="bg-primary-soft flex size-16 items-center justify-center rounded-full"
        aria-hidden
      >
        <Check className="text-primary size-8" strokeWidth={3} />
      </span>

      <div>
        <p className="text-headline">Buyurtma yaratildi</p>
        <p className="text-body-sm text-text-secondary tabular mt-1">
          {result.order.orderNumber} · {money.uzs(result.order.totalAmount)}
        </p>
      </div>

      {gift && (
        <div className="border-gold/40 bg-gold/10 flex w-full items-center gap-3 rounded-md border p-3 text-left">
          {giftImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary-origin thumbnail
            <img
              src={giftImage}
              alt=""
              className="size-12 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span
              className="bg-gold/20 flex size-12 shrink-0 items-center justify-center rounded-sm"
              aria-hidden
            >
              <Gift className="text-gold size-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-title-sm text-gold">Sovg&rsquo;a berildi</p>
            <p className="text-caption text-text-secondary truncate">{gift.name}</p>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onPrint}
          disabled={printing}
          className="flex-1"
        >
          {printing ? (
            <span
              className="border-border border-t-primary size-4 animate-spin rounded-full border-2"
              aria-hidden
            />
          ) : (
            <Printer className="size-4" aria-hidden />
          )}
          Chekni qayta chiqarish
        </Button>
        <Button
          id="new-order-again"
          type="button"
          onClick={onNewOrder}
          className="flex-1"
        >
          <Plus className="size-4" aria-hidden />
          Yangi buyurtma
        </Button>
      </div>
    </div>
  );
}
