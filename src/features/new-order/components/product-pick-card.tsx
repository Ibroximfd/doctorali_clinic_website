"use client";

import { Check, ImageOff, Minus, Package, Plus, Store } from "lucide-react";

import {
  formatProductUnits,
  isLowStock,
  isOutOfStock,
  isPackageOnly,
  maxSellableQuantity,
  productHasPackaging,
  saleStep,
  type Product,
} from "@/features/products/types/product";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { money } from "@/shared/lib/format/money";
import { resolveMediaUrl } from "@/shared/lib/media";
import { cn } from "@/shared/lib/utils";

/**
 * One product in the picker.
 *
 * The bottom of the card is the buy panel: **"1 dona"** and **"1 karobka ·
 * N dona"** are two separate, always-visible buttons with their own prices, so
 * reception never has to remember that the box holds nine — one tap on the
 * karobka row puts all nine pieces in the cart. A product without packaging
 * shows the piece button alone; a package-only product shows the box alone.
 *
 * Every price on this card is a figure the BACKEND sent (`price`,
 * `package_price`). A box whose price the backend hasn't set is still sellable,
 * but its row shows no price rather than nine unit prices multiplied together —
 * the box is routinely cheaper than that, and inventing the number here puts a
 * figure on the screen that the order will not be billed at.
 */
export function ProductPickCard({
  product,
  quantityInCart,
  onAdd,
  onQuantityChange,
  highlighted,
}: {
  product: Product;
  quantityInCart: number;
  /** Adds `units` base units, or one sale step when called with nothing. */
  onAdd: (units?: number) => void;
  onQuantityChange: (quantity: number) => void;
  /** Marks the keyboard cursor's row so Enter's target is never a guess. */
  highlighted?: boolean;
}) {
  const image = resolveMediaUrl(product.imageUrl);
  const out = isOutOfStock(product);
  const low = isLowStock(product);
  const limit = maxSellableQuantity(product);
  const step = saleStep(product);
  const size = product.packageSize;
  const boxed = productHasPackaging(product) && size !== null;
  const packageOnly = isPackageOnly(product);
  const inCart = quantityInCart > 0;

  /**
   * Units that may still be added on top of what is already in the cart, or
   * null when stock isn't tracked. It decides which buy rows stay live: a shelf
   * with 4 pieces left still sells singles but no longer a box of nine, and
   * saying so on the button beats letting the tap fail with an error.
   */
  const remaining = limit === null ? null : Math.max(0, limit - quantityInCart);
  const canAddUnit = !out && (remaining === null || remaining >= 1);
  const canAddBox = !out && boxed && (remaining === null || remaining >= size);
  const canQuickAdd = !out && (remaining === null || remaining >= step);

  return (
    <div
      data-highlighted={highlighted ? "" : undefined}
      className={cn(
        "group bg-surface relative flex flex-col overflow-hidden rounded-md border text-left transition-all",
        out
          ? "border-border opacity-60"
          : inCart
            ? "border-primary/60 ring-primary/20 shadow-sm ring-1"
            : "border-border hover:border-primary/40 hover:shadow-sm",
        highlighted && !out && "border-primary ring-primary/30 ring-2",
      )}
    >
      <button
        type="button"
        disabled={!canQuickAdd}
        onClick={() => onAdd()}
        aria-label={
          packageOnly
            ? `${product.name} — 1 ${product.packageLabel} qo'shish`
            : `${product.name} — 1 dona qo'shish`
        }
        className={cn(
          "flex flex-1 items-start gap-3 p-3 text-left",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
          canQuickAdd && "cursor-pointer",
        )}
      >
        <span
          className="bg-surface-alt relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm"
          aria-hidden
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary-origin catalog thumbnail in a long grid
            <img src={image} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <ImageOff className="text-text-tertiary size-5" />
          )}
          {inCart && (
            <span className="bg-primary/85 text-primary-foreground absolute inset-0 flex items-center justify-center">
              <Check className="size-5" strokeWidth={3} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <span className="text-title-sm line-clamp-2 flex-1">{product.name}</span>
            {product.receptionOnly && (
              <Store
                className="text-gold mt-0.5 size-3.5 shrink-0"
                aria-label="Faqat showroom"
              />
            )}
          </span>

          <span className="mt-1.5 flex flex-wrap gap-1">
            {boxed && (
              <Chip tone="neutral">
                1 {product.packageLabel} = {size} dona
              </Chip>
            )}
            {packageOnly && <Chip tone="info">Faqat butun</Chip>}
            {product.trackStock && (
              <Chip tone={out ? "danger" : low ? "warning" : "neutral"}>
                {out
                  ? "Tugagan"
                  : `Qoldiq ${formatProductUnits(product, product.stockQuantity)}`}
              </Chip>
            )}
          </span>
        </span>
      </button>

      {/* The two ways to buy this product, each with the price the backend
          quoted for it. */}
      <div className="border-surface-alt flex flex-col gap-1.5 border-t px-2.5 py-2">
        {!packageOnly && (
          <BuyRow
            icon={<Plus className="size-4" strokeWidth={2.5} />}
            label="1 dona"
            price={product.priceUzs}
            enabled={canAddUnit}
            emphasized={!boxed}
            disabledHint="Omborda qolmadi"
            onClick={() => onAdd(1)}
          />
        )}
        {boxed && (
          <BuyRow
            icon={<Package className="size-4" strokeWidth={2.2} />}
            label={`1 ${product.packageLabel} · ${size} dona`}
            // Null means the backend priced no box of its own — the row still
            // sells, the price simply comes from the server at checkout.
            price={product.packagePrice}
            enabled={canAddBox}
            emphasized
            disabledHint={
              remaining === 0
                ? "Omborda qolmadi"
                : `Butun ${product.packageLabel} uchun omborda yetarli emas`
            }
            onClick={() => onAdd(size)}
          />
        )}
      </div>

      {inCart && (
        <div className="border-border bg-primary-soft/40 flex items-center gap-1 border-t px-2 py-1.5">
          <StepButton
            label="Kamaytirish"
            onClick={() => onQuantityChange(quantityInCart - step)}
          >
            <Minus className="size-4" />
          </StepButton>
          <span className="text-title-sm tabular flex-1 text-center">
            {formatProductUnits(product, quantityInCart)}
          </span>
          <StepButton
            label="Ko'paytirish"
            disabled={remaining !== null && remaining < step}
            onClick={() => onQuantityChange(quantityInCart + step)}
          >
            <Plus className="size-4" />
          </StepButton>
        </div>
      )}
    </div>
  );
}

/**
 * One "what you get · what it costs" button. The box row is emphasized so the
 * bulk option is the one the eye lands on; a row stock can no longer cover goes
 * flat and grey with the reason in its tooltip.
 */
function BuyRow({
  icon,
  label,
  price,
  enabled,
  emphasized,
  disabledHint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  /** The backend's price for this option; null when it quoted none. */
  price: number | null;
  enabled: boolean;
  emphasized: boolean;
  disabledHint: string;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      aria-label={`${label} qo'shish`}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-sm border px-2.5 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        !enabled
          ? "border-border bg-surface-alt text-text-tertiary cursor-not-allowed"
          : emphasized
            ? "border-primary/35 bg-primary-soft text-primary-dark hover:bg-primary-soft/70 cursor-pointer"
            : "border-border bg-surface text-text-secondary hover:bg-surface-hover cursor-pointer",
      )}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="text-label-sm min-w-0 flex-1 truncate">{label}</span>
      {price !== null && (
        <span
          className={cn(
            "text-title-sm tabular shrink-0",
            enabled && !emphasized && "text-text-primary",
          )}
        >
          {money.plain(price)}
        </span>
      )}
    </button>
  );

  if (enabled) return button;
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the tooltip needs a live
          wrapper to hang off. */}
      <TooltipTrigger asChild>
        <span className="block">{button}</span>
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
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border-border bg-surface flex size-8 shrink-0 items-center justify-center rounded-sm border",
        "text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "info" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-alt text-text-secondary",
    info: "bg-info/12 text-info",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/12 text-danger",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
