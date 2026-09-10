"use client";

import { Plus } from "lucide-react";

import { MoneyInput } from "@/shared/components/form/money-input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_ICON,
  PAYMENT_TYPE_LABEL,
  type OrderPayment,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

/**
 * Splits one sale across several payment types.
 *
 * **The rule the whole payment model rests on:** the parts must sum to the
 * amount that reaches the till NOW — `payable − debt` — not to the order total.
 * Getting that wrong is what the backend answers `payments_mismatch` to, so the
 * remaining balance is shown live and the save button is blocked until it is
 * exactly zero.
 */
export function PaymentSplitEditor({
  enabled,
  onEnabledChange,
  amounts,
  onAmountChange,
  target,
  error,
  className,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  amounts: Readonly<Partial<Record<PaymentType, number>>>;
  onAmountChange: (type: PaymentType, amount: number) => void;
  /** What the parts must add up to: the cash reaching the till now. */
  target: number;
  error?: string | null;
  className?: string;
}) {
  const assigned = PAYMENT_TYPES.reduce((sum, t) => sum + (amounts[t] ?? 0), 0);
  const remaining = target - assigned;

  /**
   * Where a one-tap remainder should land: the first row still on zero, or the
   * first row at all when nothing has been typed yet.
   */
  const restTarget =
    PAYMENT_TYPES.find((type) => (amounts[type] ?? 0) === 0) ?? PAYMENT_TYPES[0];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2.5">
        <Switch
          id="split-payment"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={target <= 0}
        />
        <Label htmlFor="split-payment" className="cursor-pointer font-normal">
          Aralash to&rsquo;lov
        </Label>
        {target <= 0 && (
          <span className="text-caption text-text-tertiary">
            — taqsimlanadigan summa yo&rsquo;q
          </span>
        )}
      </div>

      {enabled && target > 0 && (
        <div className="border-border bg-surface-alt/50 space-y-2 rounded-md border p-3">
          {PAYMENT_TYPES.map((type) => {
            const Icon = PAYMENT_TYPE_ICON[type];
            const current = amounts[type] ?? 0;
            // "Put what is left here" — the second half of a split is almost
            // always the remainder, and making the desk subtract it by hand is
            // both slower and where the `payments_mismatch` errors came from.
            const canTakeRest = remaining > 0;
            return (
              <div key={type} className="flex items-center gap-2">
                <Label
                  htmlFor={`split-${type}`}
                  className="text-text-secondary flex w-24 shrink-0 items-center gap-2 font-normal sm:w-28"
                >
                  <Icon className="size-4" aria-hidden />
                  {PAYMENT_TYPE_LABEL[type]}
                </Label>
                <div className="relative min-w-0 flex-1">
                  <MoneyInput
                    id={`split-${type}`}
                    value={current}
                    onValueChange={(value) => onAmountChange(type, value)}
                    placeholder="0"
                    className="h-11 pr-11 text-right text-base font-semibold"
                  />
                  {canTakeRest && (
                    <button
                      type="button"
                      onClick={() => onAmountChange(type, current + remaining)}
                      aria-label={`Qolgan ${money.uzs(remaining)} ni ${PAYMENT_TYPE_LABEL[type]} ga yozish`}
                      title={`Qolgan ${money.plain(remaining)} ni shu yerga yozish`}
                      className="text-primary hover:bg-primary-soft focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="border-border flex items-baseline gap-2 border-t pt-2.5">
            <span className="text-caption text-text-secondary flex-1">
              Taqsimlash kerak
            </span>
            <span className="text-title-sm tabular">{money.plain(target)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-secondary flex-1">
              {remaining === 0 ? "Taqsimlandi" : remaining > 0 ? "Qoldi" : "Ortiqcha"}
            </span>
            <span
              className={cn(
                "text-title-sm tabular",
                remaining === 0
                  ? "text-primary-dark"
                  : remaining > 0
                    ? "text-warning"
                    : "text-danger",
              )}
            >
              {money.plain(Math.abs(remaining))}
            </span>
          </div>

          {/*
           * The whole split in one tap: the remainder goes to the row that is
           * still empty. Reception types 200 000 into cash and presses this —
           * which is what the flow actually is, nine times out of ten.
           */}
          {remaining > 0 && restTarget !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                onAmountChange(restTarget, (amounts[restTarget] ?? 0) + remaining)
              }
            >
              <Plus className="size-4" aria-hidden />
              Qolgan {money.plain(remaining)} &rarr; {PAYMENT_TYPE_LABEL[restTarget]}
            </Button>
          )}

          {error && (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The `payments[]` body — only the types actually used (> 0). */
export function splitPayments(
  amounts: Readonly<Partial<Record<PaymentType, number>>>,
): OrderPayment[] {
  return PAYMENT_TYPES.filter((type) => (amounts[type] ?? 0) > 0).map((type) => ({
    type,
    amount: amounts[type] as number,
  }));
}

/**
 * A split is valid once at least one part is set and the parts sum EXACTLY to
 * the target — the same rule the backend enforces, checked live so the save
 * button never fires a doomed request.
 */
export function isSplitValid(
  amounts: Readonly<Partial<Record<PaymentType, number>>>,
  target: number,
): boolean {
  const parts = splitPayments(amounts);
  const assigned = parts.reduce((sum, p) => sum + p.amount, 0);
  return target > 0 && assigned === target && parts.length > 0;
}

/** The live error under the split editor (only after a save attempt). */
export function splitError(
  amounts: Readonly<Partial<Record<PaymentType, number>>>,
  target: number,
): string | null {
  if (isSplitValid(amounts, target)) return null;
  const parts = splitPayments(amounts);
  if (parts.length === 0) return "To'lov summalarini kiriting";
  const remaining = target - parts.reduce((sum, p) => sum + p.amount, 0);
  return remaining > 0
    ? `Yana ${money.uzs(remaining)} taqsimlang`
    : `To'lovlar ${money.uzs(-remaining)} ortiqcha`;
}
