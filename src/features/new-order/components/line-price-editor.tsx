"use client";

import { Pencil, RotateCcw, Tag } from "lucide-react";
import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { CartItem } from "@/features/orders/types/cart";
import { hasCustomPrice, paidQuantity, unitPrice } from "@/features/orders/types/cart";
import { MoneyInput } from "@/shared/components/form/money-input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

/** Ready-made reductions — the discounts the desk actually gives. */
const QUICK_DISCOUNTS = [5, 10, 15, 20] as const;

export interface LinePriceInput {
  readonly unitPrice: number | null;
  readonly lineTotal: number | null;
}

/**
 * Edits what a cart line costs.
 *
 * Two ways in, because reception thinks in both and forcing one is what made
 * the old form slow:
 *
 *  • **Dona narxi** — "this one goes out at 150 000 instead of 160 000".
 *  • **Qator summasi** — "three of them for 100 000 total". This is the one
 *    that matters: whole so'm rarely divide evenly, so the typed SUM travels to
 *    the server as `line_total` and the server does the spreading. Dividing
 *    here would bill 99 999.
 *
 * Typing in either field updates the other live, so the desk always sees both
 * halves of the deal it is making.
 */
export function LinePriceEditor({
  item,
  serverLineTotal,
  onApply,
}: {
  item: CartItem;
  /** The server's own figure for this line, when it has priced the basket. */
  serverLineTotal: number | null;
  onApply: (input: LinePriceInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const paid = paidQuantity(item);
  const catalogPrice = item.product.priceUzs;
  const edited = hasCustomPrice(item);
  /*
   * What this line costs is the SERVER's figure, or the sum reception typed
   * itself — both are billed exactly as shown. Only when neither exists yet
   * does the piece price stand in, and then it is marked "≈": a box of nine is
   * routinely cheaper than nine pieces, so the local multiplication is an
   * estimate and never the price.
   */
  const exactTotal = serverLineTotal ?? item.customLineTotal;
  const displayTotal = exactTotal ?? unitPrice(item) * paid;
  const estimated = exactTotal === null && paid > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${item.product.name} narxini o'zgartirish`}
          className={cn(
            "group flex flex-col items-end gap-0.5 rounded-sm px-2 py-1 text-right transition-colors",
            "hover:bg-surface-alt focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <span className="flex items-center gap-1.5">
            {edited && <Tag className="text-warning size-3" aria-hidden />}
            <span className="text-title-sm tabular">
              {estimated && (
                <span className="text-text-tertiary font-normal" aria-hidden>
                  ≈{" "}
                </span>
              )}
              {money.plain(displayTotal)}
            </span>
            <Pencil
              className="text-text-tertiary size-3 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </span>
          <span className="text-caption text-text-tertiary tabular flex items-baseline gap-1 whitespace-nowrap">
            {edited && <s className="opacity-70">{money.plain(catalogPrice)}</s>}
            <span>{money.plain(unitPrice(item))} / dona</span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[320px] p-4">
        {/* Mounted per opening, so the two fields start from the line's current
            price without an effect having to reset them afterwards. */}
        {open && (
          <PriceForm
            key={`${item.product.id}:${item.customLineTotal ?? ""}:${paid}`}
            item={item}
            paid={paid}
            currentTotal={displayTotal}
            edited={edited}
            onApply={(input) => {
              onApply(input);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function PriceForm({
  item,
  paid,
  currentTotal,
  edited,
  onApply,
  onCancel,
}: {
  item: CartItem;
  paid: number;
  /** What the line costs right now — the server's sum whenever it has one. */
  currentTotal: number;
  edited: boolean;
  onApply: (input: LinePriceInput) => void;
  onCancel: () => void;
}) {
  const catalogPrice = item.product.priceUzs;
  const [unit, setUnit] = useState(() => unitPrice(item));
  const [total, setTotal] = useState(() => currentTotal);

  /** Editing the unit price recomputes the line sum. */
  function changeUnit(value: number) {
    setUnit(value);
    setTotal(value * paid);
  }

  /**
   * Editing the line sum recomputes the unit price for display only — the sum
   * itself is what is sent, so the rounding here never reaches the bill.
   */
  function changeTotal(value: number) {
    setTotal(value);
    setUnit(paid > 0 ? Math.round(value / paid) : 0);
  }

  const invalid = unit > catalogPrice;
  const discount =
    catalogPrice > 0 ? Math.round(((catalogPrice - unit) / catalogPrice) * 100) : 0;

  function commit() {
    if (invalid) return;
    // At or above the catalog price means "no discount" — the backend rejects a
    // price above it anyway, so the override is simply dropped.
    if (unit <= 0 || unit >= catalogPrice) onApply({ unitPrice: null, lineTotal: null });
    else onApply({ unitPrice: unit, lineTotal: total });
  }

  /**
   * Enter applies, Escape closes — the desk types a price and presses Enter,
   * and reaching for a button to confirm a number is what made this slow.
   */
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <div>
        <p className="text-title-sm">{item.product.name}</p>
        <p className="text-caption text-text-tertiary tabular mt-0.5">
          Katalog narxi {money.uzs(catalogPrice)} · {paid} dona
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="line-unit-price">Dona narxi</Label>
        <MoneyInput
          id="line-unit-price"
          value={unit}
          onValueChange={changeUnit}
          autoFocus
          aria-invalid={invalid}
          aria-describedby={invalid ? "line-price-error" : undefined}
          className="h-11 text-right text-lg font-bold"
        />
      </div>

      {/*
       * With a single unit the two figures are the same number by definition,
       * so the second field would only invite the desk to wonder which one it
       * is editing. It appears when there is actually a sum to spread.
       */}
      {paid > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="line-total">
            Qator summasi
            <span className="text-text-tertiary ml-1.5 font-normal">({paid} dona)</span>
          </Label>
          <MoneyInput
            id="line-total"
            value={total}
            onValueChange={changeTotal}
            className="h-11 text-right text-lg font-bold"
          />
          <p className="text-caption text-text-tertiary">
            Yozilgan summani server aynan hisoblaydi — yaxlitlash yo&rsquo;qoladi.
          </p>
        </div>
      )}

      {invalid ? (
        <p id="line-price-error" role="alert" className="text-caption text-danger">
          Narx katalog narxidan yuqori bo&rsquo;lishi mumkin emas
        </p>
      ) : (
        discount > 0 && (
          <p className="text-caption text-primary-dark tabular">
            −{discount}% chegirma · {money.uzs(catalogPrice - unit)} / dona
            {paid > 1 && ` · jami −${money.uzs((catalogPrice - unit) * paid)}`}
          </p>
        )
      )}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_DISCOUNTS.map((off) => (
          <Button
            key={off}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => changeUnit(Math.round((catalogPrice * (100 - off)) / 100))}
          >
            −{off}%
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {edited && (
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5"
            onClick={() => onApply({ unitPrice: null, lineTotal: null })}
          >
            <RotateCcw className="size-4" aria-hidden />
            Tiklash
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="outline" onClick={onCancel}>
          Bekor
        </Button>
        <Button type="button" onClick={commit} disabled={invalid}>
          Qo&rsquo;llash
        </Button>
      </div>

      <p className="text-caption text-text-tertiary text-center">
        <kbd className="bg-surface-alt rounded px-1.5 py-0.5 text-[11px]">Enter</kbd>{" "}
        saqlaydi
      </p>
    </div>
  );
}
