"use client";

import { Pencil, RotateCcw, Tag } from "lucide-react";
import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { CartItem } from "@/features/orders/types/cart";
import {
  hasCustomPrice,
  lineTotal,
  naturalLineTotal,
  packagesBilled,
  paidQuantity,
  unitPrice,
  unitPriceForTotal,
} from "@/features/orders/types/cart";
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
 * The ceiling is the line's NATURAL total — the auto-boxed sum for a product
 * that sells by the box, the catalog sum otherwise. A price can only be lowered
 * (the backend refuses `price_above_catalog`), and typing the natural sum back
 * is how the original price returns.
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
  const edited = hasCustomPrice(item);
  const natural = naturalLineTotal(item);
  const boxed = packagesBilled(item) > 0;
  /*
   * What this line costs is the SERVER's figure, or the sum reception typed
   * itself — both are billed exactly as shown. Only when neither exists yet
   * does the local sum stand in, and then it is marked "≈": the server may
   * still spread or box the line differently.
   */
  const exactTotal = serverLineTotal ?? item.customLineTotal;
  const displayTotal = exactTotal ?? lineTotal(item);
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
            {edited ? (
              <>
                <s className="opacity-70">{money.plain(natural)}</s>
                <span>{money.plain(unitPrice(item))} / dona</span>
              </>
            ) : boxed ? (
              <span>{item.product.packageLabel} narxida</span>
            ) : (
              <span>{money.plain(unitPrice(item))} / dona</span>
            )}
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
  const natural = naturalLineTotal(item);
  const boxed = packagesBilled(item) > 0;
  const divisor = Math.max(1, paid);
  const [total, setTotal] = useState(() => currentTotal);
  const [unit, setUnit] = useState(() => Math.round(currentTotal / divisor));

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
    setUnit(Math.round(value / divisor));
  }

  const tooHigh = total > natural;
  const empty = total <= 0;
  const isNatural = total === natural;
  const discount =
    natural > 0 && !tooHigh ? Math.round(((natural - total) / natural) * 100) : 0;
  const spreadUnit = unitPriceForTotal(item, total);
  const unevenSplit = !tooHigh && !empty && !isNatural && spreadUnit * paid !== total;

  function commit() {
    if (tooHigh || empty) return;
    // Typing the untouched sum back is how the original price returns: it
    // clears the override instead of pinning the same figure by hand (which
    // would also switch auto-boxing off for nothing).
    if (isNatural) onApply({ unitPrice: null, lineTotal: null });
    else onApply({ unitPrice: spreadUnit, lineTotal: total });
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
          {paid} dona · asl summa {money.uzs(natural)}
          {boxed && ` · ${item.product.packageLabel} narxi qo'llangan`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="line-unit-price">Dona narxi</Label>
        <MoneyInput
          id="line-unit-price"
          value={unit}
          onValueChange={changeUnit}
          autoFocus
          aria-invalid={tooHigh}
          aria-describedby={tooHigh ? "line-price-error" : undefined}
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
            aria-invalid={tooHigh}
            className="h-11 text-right text-lg font-bold"
          />
          <p className="text-caption text-text-tertiary">
            Yozilgan summani server aynan hisoblaydi — yaxlitlash yo&rsquo;qoladi.
          </p>
        </div>
      )}

      {tooHigh ? (
        <p id="line-price-error" role="alert" className="text-caption text-danger">
          Summani oshirib bo&rsquo;lmaydi — asl summa {money.uzs(natural)}
        </p>
      ) : isNatural ? (
        <p className="text-caption text-text-tertiary">
          Asl summa — narx o&rsquo;zgarmaydi
        </p>
      ) : (
        !empty && (
          <p className="text-caption text-primary-dark tabular">
            −{discount}% chegirma · jami −{money.uzs(natural - total)}
            {unevenSplit && ` · 1 dona ≈ ${money.uzs(spreadUnit)}`}
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
            onClick={() => changeTotal(Math.round((natural * (100 - off)) / 100))}
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
        <Button type="button" onClick={commit} disabled={tooHigh || empty}>
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
