"use client";

import { Gift, Minus, Package, Plus, Trash2, X } from "lucide-react";
import { memo, useRef, useState } from "react";

import type { CartItem } from "@/features/orders/types/cart";
import {
  billingDetail,
  hasCustomPrice,
  isFullGift,
  paidQuantity,
} from "@/features/orders/types/cart";
import {
  formatProductUnits,
  isPackageOnly,
  maxSellableQuantity,
  productHasPackaging,
  saleStep,
  type Product,
} from "@/features/products/types/product";
import { Button } from "@/shared/components/ui/button";
import { ProductThumb } from "@/shared/components/ui/product-thumb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { LinePriceEditor } from "./line-price-editor";

/**
 * Whether the "+1 karobka" shortcut belongs on a line: only a product that
 * sells both ways needs it — a package-only line already steps by the box, and
 * an unpackaged one has no box at all.
 */
function sellsByBoxAndPiece(product: Product): boolean {
  return productHasPackaging(product) && !isPackageOnly(product);
}

/**
 * One editable line of the basket.
 *
 * Everything reception changes about a line is reachable here without opening a
 * dialog: the quantity (stepper, plus "+1 karobka" for a boxed product — nine
 * taps on the stepper is exactly the misstep the box exists to avoid), the
 * price (the total is a button), and how many units go out free.
 *
 * The gift button gives the WHOLE line away, as the Flutter form did: "sovg'a"
 * at the desk almost always means the whole thing, and the split control that
 * then appears is for the rarer "one of the nine is free".
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
  const product = item.product;
  const productId = product.id;
  const detail = billingDetail(item);
  const fullGift = isFullGift(item);
  const gifting = item.giftQuantity > 0;

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
        <ProductThumb name={product.name} imageUrl={product.imageUrl} size={44} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-title-sm min-w-0 truncate">{product.name}</span>
            {productHasPackaging(product) && (
              <span className="bg-surface-alt text-text-secondary shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                1 {product.packageLabel} = {product.packageSize} dona
              </span>
            )}
            {gifting && (
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

          {/* "1 karobka + 2 dona · 1 karobka × 1 370 000 + 2 dona × 160 000":
              what is on the line and how the total is made of it, so the
              client at the desk can see the box price was applied. */}
          <p className="text-caption text-text-tertiary tabular mt-0.5 line-clamp-2">
            {formatProductUnits(product, item.quantity)}
            {detail && (
              <>
                {" · "}
                <span className="text-primary-dark font-semibold">{detail}</span>
              </>
            )}
            {gifting && !fullGift && ` · to'lanadi ${paidQuantity(item)} dona`}
          </p>
        </div>

        {/* On a wide row the controls sit beside the name; on a narrow one they
            drop to their own line, where there is room for all three. */}
        <div className="hidden shrink-0 items-center gap-1 @lg/cart:flex">
          <LineControls
            item={item}
            serverLineTotal={serverLineTotal}
            onQuantityChange={onQuantityChange}
            onPriceChange={onPriceChange}
            onGiftChange={onGiftChange}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(productId)}
          aria-label={`${product.name} savatdan olib tashlash`}
          className="text-text-tertiary hover:text-danger shrink-0"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 @lg/cart:hidden">
        <LineControls
          item={item}
          serverLineTotal={serverLineTotal}
          onQuantityChange={onQuantityChange}
          onPriceChange={onPriceChange}
          onGiftChange={onGiftChange}
        />
      </div>

      {gifting && (
        <GiftRow item={item} onChange={(gift) => onGiftChange(productId, gift)} />
      )}
    </div>
  );
});

/**
 * The quantity, gift and price controls of one line.
 *
 * A component of its own — not a closure inside the row — so the typeable
 * quantity keeps its draft and its focus when the row re-renders around it
 * (the server's price landing 300ms after a click used to remount the whole
 * control strip). The row renders it twice, once per width variant; CSS shows
 * whichever fits.
 */
function LineControls({
  item,
  serverLineTotal,
  onQuantityChange,
  onPriceChange,
  onGiftChange,
}: {
  item: CartItem;
  serverLineTotal: number | null;
  onQuantityChange: (productId: string, quantity: number) => void;
  onPriceChange: (
    productId: string,
    input: { unitPrice: number | null; lineTotal?: number | null },
  ) => void;
  onGiftChange: (productId: string, giftQuantity: number) => void;
}) {
  const product = item.product;
  const productId = product.id;
  const step = saleStep(product);
  const limit = maxSellableQuantity(product);
  const atLimit = limit !== null && item.quantity >= limit;
  const boxSize = product.packageSize;
  const boxChip = sellsByBoxAndPiece(product) && boxSize !== null;
  const canAddBox =
    boxChip && (limit === null || item.quantity + (boxSize as number) <= limit);
  const fullGift = isFullGift(item);
  const gifting = item.giftQuantity > 0;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <StepButton
          label="Kamaytirish"
          onClick={() => onQuantityChange(productId, item.quantity - step)}
        >
          <Minus className="size-4" />
        </StepButton>
        <QuantityField
          value={item.quantity}
          label={`${product.name} miqdori`}
          onCommit={(quantity) => onQuantityChange(productId, quantity)}
        />
        <StepButton
          label="Ko'paytirish"
          disabled={atLimit}
          onClick={() => onQuantityChange(productId, item.quantity + step)}
        >
          <Plus className="size-4" />
        </StepButton>
        {boxChip && (
          <BoxChip
            label={`+1 ${product.packageLabel}`}
            disabled={!canAddBox}
            disabledHint={`Butun ${product.packageLabel} uchun omborda yetarli emas`}
            onClick={() =>
              onQuantityChange(productId, item.quantity + (boxSize as number))
            }
          />
        )}
      </div>

      {!gifting && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onGiftChange(productId, item.quantity)}
              aria-label="Sovg'a qilish"
              className="text-text-tertiary hover:text-primary-dark shrink-0"
            >
              <Gift className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sovg&rsquo;a qilish (butun qator)</TooltipContent>
        </Tooltip>
      )}

      {fullGift ? (
        // Nothing to price on a line that is entirely free.
        <span className="text-title-sm text-primary-dark shrink-0 px-2 py-1 text-right">
          BEPUL
        </span>
      ) : (
        <LinePriceEditor
          item={item}
          serverLineTotal={serverLineTotal}
          onApply={(input) => onPriceChange(productId, input)}
        />
      )}
    </>
  );
}

/**
 * How many units of this line go out free, once some do.
 *
 * A one-step line (a single piece, or one box of a package-only product) is
 * all-or-nothing — the "Butunlay bepul" chip already says so, so it only offers
 * the cancel. Larger lines get a stepper to split paid vs. free units, with box
 * steps beside it for a boxed product: "the box is free, the two loose ones are
 * paid" is one tap, not nine.
 */
function GiftRow({
  item,
  onChange,
}: {
  item: CartItem;
  onChange: (giftQuantity: number) => void;
}) {
  const product = item.product;
  const step = saleStep(product);
  const boxSize = product.packageSize;
  const boxSteps =
    sellsByBoxAndPiece(product) && boxSize !== null && item.quantity > boxSize;
  const allOrNothing = item.quantity <= step;
  const all = item.giftQuantity >= item.quantity;

  return (
    <div className="bg-primary-soft/50 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-2 py-1.5">
      <span className="text-label-sm text-primary-dark inline-flex items-center gap-1">
        <Gift className="size-3.5" aria-hidden />
        Sovg&rsquo;a
      </span>

      {allOrNothing ? (
        <span className="text-caption text-text-secondary">butun qator bepul</span>
      ) : (
        <>
          <div className="flex items-center gap-0.5">
            {boxSteps && (
              <BoxChip
                label={`−1 ${product.packageLabel}`}
                disabled={item.giftQuantity - (boxSize as number) < step}
                onClick={() => onChange(item.giftQuantity - (boxSize as number))}
              />
            )}
            <StepButton
              label="Sovg'ani kamaytirish"
              disabled={item.giftQuantity <= step}
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
              disabled={all}
              onClick={() => onChange(item.giftQuantity + step)}
              tone="soft"
            >
              <Plus className="size-3.5" />
            </StepButton>
            {boxSteps && (
              <BoxChip
                label={`+1 ${product.packageLabel}`}
                disabled={item.giftQuantity + (boxSize as number) > item.quantity}
                onClick={() => onChange(item.giftQuantity + (boxSize as number))}
              />
            )}
          </div>
          <span className="text-caption text-text-tertiary tabular">
            / {item.quantity} dona bepul
          </span>
          {!all && (
            <button
              type="button"
              onClick={() => onChange(item.quantity)}
              className="text-label-sm text-primary-dark focus-visible:ring-ring rounded-sm underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              Hammasi
            </button>
          )}
        </>
      )}

      <div className="flex-1" />
      <button
        type="button"
        onClick={() => onChange(0)}
        aria-label="Sovg'ani bekor qilish"
        className="text-text-tertiary hover:text-danger focus-visible:ring-ring flex size-6 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * The quantity, typeable: click the number and type "15" instead of tapping +
 * fifteen times — the keypad every POS puts under its cart. Enter or leaving
 * the field commits; Escape puts the old number back. The store still clamps
 * to stock and snaps to whole boxes, so nothing typed here can break a rule.
 * An empty or zero entry is ignored rather than read as "remove the line".
 */
function QuantityField({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field, and the blur that follows must not commit the
  // draft that was just thrown away.
  const discarding = useRef(false);

  function commit() {
    if (discarding.current) {
      discarding.current = false;
      return;
    }
    if (draft === null) return;
    const typed = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isNaN(typed) || typed <= 0 || typed === value) return;
    onCommit(typed);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft ?? String(value)}
      aria-label={label}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 4))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          discarding.current = true;
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "text-title-sm tabular h-8 w-11 rounded-sm bg-transparent text-center",
        "hover:bg-surface-alt focus-visible:bg-surface focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    />
  );
}

/** A "+1 karobka" pill: one tap moves a whole box. */
function BoxChip({
  label,
  disabled,
  disabledHint,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) {
  const chip = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "text-label-xs inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 font-bold transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        disabled
          ? "bg-surface-alt text-text-tertiary cursor-not-allowed"
          : "bg-primary-soft text-primary-dark hover:bg-primary-soft/70",
      )}
    >
      <Package className="size-3.5" aria-hidden />
      {label}
    </button>
  );

  if (!disabled || !disabledHint) return chip;
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the tooltip needs a live
          wrapper to hang off. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{chip}</span>
      </TooltipTrigger>
      <TooltipContent>{disabledHint}</TooltipContent>
    </Tooltip>
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
