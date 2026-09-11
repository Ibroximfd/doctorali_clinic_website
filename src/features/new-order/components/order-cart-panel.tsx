"use client";

import { ShoppingCart, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Button } from "@/shared/components/ui/button";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { paidLineFor } from "@/features/orders/types/order-preview";

import { selectSubtotal, useNewOrderStore } from "../store/new-order-store";
import { CartLineRow } from "./cart-line-row";

/**
 * The basket.
 *
 * It is the same component on both screens of the flow — the catalogue page and
 * the order page — because the basket is the one thing that must never look or
 * behave differently depending on where reception is standing. It reads the
 * store directly rather than taking the lines as a prop, so both copies stay in
 * step by construction.
 */
export function OrderCartPanel({
  className,
  emptyMessage = "Mahsulotni qidiring va kartochkani bosing — u savatga tushadi.",
  action,
  priceIsEstimate = false,
}: {
  className?: string;
  emptyMessage?: string;
  /** A call to action shown under an empty basket (or beside a full one). */
  action?: ReactNode;
  /** True while the server hasn't priced this basket — the sum says "taxminiy". */
  priceIsEstimate?: boolean;
}) {
  // Slices only — see `ProductSelectView`. The actions are stable references,
  // which is what lets each memoised row skip a render it has no part in.
  const cart = useNewOrderStore((s) => s.cart);
  const preview = useNewOrderStore((s) => s.preview);
  const subtotal = useNewOrderStore(selectSubtotal);
  const setQuantity = useNewOrderStore((s) => s.setQuantity);
  const setLinePrice = useNewOrderStore((s) => s.setLinePrice);
  const setLineGift = useNewOrderStore((s) => s.setLineGift);
  const removeProduct = useNewOrderStore((s) => s.removeProduct);
  const units = cart.reduce((sum, item) => sum + item.quantity + item.giftQuantity, 0);

  return (
    <section
      className={cn(
        "border-border bg-surface flex flex-col overflow-hidden rounded-lg border shadow-sm",
        className,
      )}
      aria-label="Savat"
    >
      <header className="border-surface-alt flex shrink-0 items-center gap-3 border-b px-4 py-3.5 sm:px-5">
        <span className="bg-primary-soft flex rounded-[10px] p-2" aria-hidden>
          <ShoppingCart className="text-primary size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title-lg">Savat</h2>
          <p className="text-caption text-text-secondary tabular mt-0.5">
            {cart.length === 0
              ? "Hozircha bo'sh"
              : `${cart.length} ta nom · ${units} dona · ${money.plain(subtotal)}${
                  priceIsEstimate ? " (taxminiy)" : ""
                }`}
          </p>
        </div>
        {cart.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => cart.forEach((item) => removeProduct(item.product.id))}
            className="text-text-tertiary hover:text-danger shrink-0"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Tozalash</span>
          </Button>
        )}
      </header>

      {cart.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Savat bo'sh"
          message={emptyMessage}
          action={action}
        />
      ) : (
        <>
          <ul className="@container/cart min-h-0 flex-1 overflow-y-auto">
            {cart.map((item, index) => (
              <li
                key={item.product.id}
                className={index > 0 ? "border-surface-alt border-t" : undefined}
              >
                <CartLineRow
                  item={item}
                  serverLineTotal={
                    preview
                      ? (paidLineFor(preview, item.product.id)?.lineTotal ?? null)
                      : null
                  }
                  onQuantityChange={setQuantity}
                  onPriceChange={setLinePrice}
                  onGiftChange={setLineGift}
                  onRemove={removeProduct}
                />
              </li>
            ))}
          </ul>
          {action && (
            <div className="border-surface-alt shrink-0 border-t p-3 sm:p-4">
              {action}
            </div>
          )}
        </>
      )}
    </section>
  );
}
