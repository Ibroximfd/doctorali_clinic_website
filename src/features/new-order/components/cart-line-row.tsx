"use client";

import { Gift, Minus, Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import type { CartItem } from "@/features/orders/types/cart";
import {
  billingBreakdown,
  hasCustomPrice,
  isFullGift,
  paidQuantity,
} from "@/features/orders/types/cart";
import {
  formatProductUnits,
  maxSellableQuantity,
  productHasPackaging,
  saleStep,
} from "@/features/products/types/product";
import { Button } from "@/shared/components/ui/button";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { LinePriceEditor } from "./line-price-editor";

/**
 * One editable line of the basket.
 *
 * Everything reception changes about a line is reachable here without opening a
 * dialog: the quantity (stepper), the price (the total is a button), and how
 * many units go out free (the gift stepper). The gift control only appears once
 * there is more than nothing to give away, so an ordinary line stays quiet.
 *
 * Memoised; the callbacks are the store's own actions and take the product id,
 * so a change to one line re-renders one row rather than the whole basket.
 */
export const CartLineRow = memo(function CartLineRow({
  item,
  serverLineTotal,
  onQuantityChange,
  onPriceChange,
  onGiftChange,
  onRemove,
}: {
  item: CartItem;
  serverLineTotal: number | null;
  onQuantityChange: (productId: string, quantity: number) => void;
  onPriceChange: (
    productId: string,
    input: { unitPrice: number | null; lineTotal?: number | null },
  ) => void;
  onGiftChange: (productId: string, giftQuantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  const productId = item.product.id;
  const step = saleStep(item.product);
  const limit = maxSellableQuantity(item.product);
  const atLimit = limit !== null && item.quantity >= limit;
  const breakdown = billingBreakdown(item);
  const fullGift = isFullGift(item);

  return (
    /*
     * The basket appears in two places of very different widths — a 400px
     * column beside the catalogue, and the full page width on the order screen
     * — so this row adapts to ITS CONTAINER, not to the viewport. A viewport
     * breakpoint here is what squeezed the stepper, the gift control and the
     * price into 400px and cut the price off.
     */
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <ProductThumb
          name={item.product.name}
          imageUrl={item.product.imageUrl}
          size={44}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-title-sm min-w-0 truncate">{item.product.name}</span>
            {productHasPackaging(item.product) && (
              <span className="bg-surface-alt text-text-secondary shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                1 {item.product.packageLabel} = {item.product.packageSize} dona
              </span>
            )}
            {item.giftQuantity > 0 && (
              <span className="bg-primary-soft text-primary-dark inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
                <Gift className="size-3" aria-hidden />
                {fullGift ? "Butunlay bepul" : `${item.giftQuantity} dona sovg'a`}
              </span>
            )}
            {hasCustomPrice(item) && (
              <span className="bg-warning/15 text-warning shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold">
                Narx o&rsquo;zgartirilgan
              </span>
            )}
          </div>

          <p className="text-caption text-text-tertiary tabular mt-0.5 truncate">
            {formatProductUnits(item.product, item.quantity)}
            {breakdown && ` · ${breakdown} hisobida`}
            {item.giftQuantity > 0 && ` · to'lanadi ${paidQuantity(item)} dona`}
          </p>
        </div>

        {/* On a wide row the controls sit beside the name; on a narrow one they
            drop to their own line, where there is room for all three. */}
        <div className="hidden shrink-0 items-center gap-1 @lg/cart:flex">
          <Controls />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(productId)}
          aria-label={`${item.product.name} savatdan olib tashlash`}
          className="text-text-tertiary hover:text-danger shrink-0"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 @lg/cart:hidden">
        <Controls />
      </div>
    </div>
  );

  /** The three controls, rendered in whichever row has the room for them. */
  function Controls() {
    return (
      <>
        <div className="flex shrink-0 items-center gap-1">
          <StepButton
            label="Kamaytirish"
            onClick={() => onQuantityChange(productId, item.quantity - step)}
          >
            <Minus className="size-4" />
          </StepButton>
          <span className="text-title-sm tabular w-10 text-center">{item.quantity}</span>
          <StepButton
            label="Ko'paytirish"
            disabled={atLimit}
            onClick={() => onQuantityChange(productId, item.quantity + step)}
          >
            <Plus className="size-4" />
          </StepButton>
        </div>

        <GiftStepper item={item} onChange={(gift) => onGiftChange(productId, gift)} />

        <LinePriceEditor
          item={item}
          serverLineTotal={serverLineTotal}
          onApply={(input) => onPriceChange(productId, input)}
        />
      </>
    );
  }
});

/**
 * How many units of this line go out free.
 *
 * Collapsed to a single icon until it is used, because most lines never are —
 * and an always-open pair of steppers next to the quantity is exactly the
 * clutter that makes a busy row hard to read.
 */
function GiftStepper({
  item,
  onChange,
}: {
  item: CartItem;
  onChange: (giftQuantity: number) => void;
}) {
  const step = saleStep(item.product);
  const active = item.giftQuantity > 0;

  if (!active) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(step)}
            aria-label="Sovg'a qilish"
            className="text-text-tertiary hover:text-primary-dark shrink-0"
          >
            <Gift className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bir qismini sovg&rsquo;a qilish</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="bg-primary-soft flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5">
      <StepButton
        label="Sovg'ani kamaytirish"
        onClick={() => onChange(item.giftQuantity - step)}
        tone="soft"
      >
        <Minus className="size-3.5" />
      </StepButton>
      <span className="text-label-sm text-primary-dark tabular w-8 text-center">
        {item.giftQuantity}
      </span>
      <StepButton
        label="Sovg'ani ko'paytirish"
        disabled={item.giftQuantity >= item.quantity}
        onClick={() => onChange(item.giftQuantity + step)}
        tone="soft"
      >
        <Plus className="size-3.5" />
      </StepButton>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "soft";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-sm transition-colors disabled:opacity-40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        tone === "soft"
          ? "text-primary-dark hover:bg-surface size-6"
          : "border-border bg-surface text-text-secondary hover:bg-surface-hover size-8 border",
      )}
    >
      {children}
    </button>
  );
}
