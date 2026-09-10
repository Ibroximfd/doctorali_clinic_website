"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { MoneyInput } from "@/shared/components/form/money-input";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

const QUICK_DISCOUNTS = [5, 10, 15, 20] as const;

/**
 * Types the whole order's total by hand — "5 mln savdo, 4 mln ga tushirib
 * yuboramiz".
 *
 * The amount is the order's NEW total, not a discount amount and not a per-line
 * price. The backend spreads the difference across the paid lines
 * proportionally, so commission, statistics and the receipt all follow
 * automatically. Raising the total is allowed too.
 */
export function TotalOverrideDialog({
  open,
  onOpenChange,
  subtotal,
  current,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the lines come to on their own. */
  subtotal: number;
  /** The override in force, or null. */
  current: number | null;
  onApply: (amount: number | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted per opening, so the field starts from the total in force
          without an effect having to reset it afterwards. */}
      {open && (
        <OverrideBody
          key={`${current ?? "none"}:${subtotal}`}
          subtotal={subtotal}
          current={current}
          onApply={onApply}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function OverrideBody({
  subtotal,
  current,
  onApply,
  onClose,
}: {
  subtotal: number;
  current: number | null;
  onApply: (amount: number | null) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(() => current ?? subtotal);
  const delta = amount - subtotal;

  return (
    <>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Jami summani kiriting</DialogTitle>
          <DialogDescription>
            Qatorlar summasi {money.uzs(subtotal)}. Farqni server qatorlarga proporsional
            taqsimlaydi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="total-override">Yangi jami</Label>
          <MoneyInput
            id="total-override"
            value={amount}
            onValueChange={setAmount}
            autoFocus
            className="h-14 text-right text-2xl font-bold"
          />
          {delta !== 0 && (
            <p
              className={cn(
                "text-caption tabular",
                delta < 0 ? "text-primary-dark" : "text-warning",
              )}
            >
              {delta < 0 ? "Chegirma" : "Qo'shimcha"} {money.uzs(Math.abs(delta))}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_DISCOUNTS.map((off) => (
            <Button
              key={off}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(Math.round((subtotal * (100 - off)) / 100))}
            >
              −{off}%
            </Button>
          ))}
        </div>

        <DialogFooter>
          {current !== null && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onApply(null);
                onClose();
              }}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" aria-hidden />
              Tiklash
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(amount === subtotal ? null : amount);
              onClose();
            }}
          >
            Qo&rsquo;llash
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
