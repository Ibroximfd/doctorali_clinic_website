"use client";

import { HandCoins } from "lucide-react";
import { useMemo, useState } from "react";

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
import { Textarea } from "@/shared/components/ui/textarea";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { money } from "@/shared/lib/format/money";
import { uuidV4 } from "@/shared/lib/uuid";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import { cn } from "@/shared/lib/utils";

import { usePayDebt } from "../hooks/use-debts";
import type { Debt } from "../types/debt";

/**
 * Records a repayment.
 *
 * The idempotency key is minted **once per dialog opening** and reused across
 * retries: taking the same repayment twice is precisely the mistake that makes
 * a client's balance wrong, and a dropped connection followed by a second tap
 * is how it happens.
 */
export function DebtPayDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pay = usePayDebt();
  const [amount, setAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [note, setNote] = useState("");

  // One key per opening, held for every retry of this same repayment.
  const idempotencyKey = useMemo(() => (open ? uuidV4() : ""), [open]);

  useResetOnChange(open ? (debt?.id ?? null) : null, () => {
    if (!open || !debt) return;
    // Pre-filled with the whole balance: paying it off in full is the common
    // case, and reception overtypes it when it isn't.
    setAmount(debt.remaining);
    setPaymentType("cash");
    setNote("");
  });

  if (!debt) return null;

  const tooMuch = amount > debt.remaining;
  const invalid = amount <= 0 || tooMuch;

  async function submit() {
    if (invalid || !debt) return;
    await pay.mutateAsync({
      id: debt.id,
      input: { amount, paymentType, note, idempotencyKey },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Qarzni to&rsquo;lash</DialogTitle>
          <DialogDescription>
            {debt.client?.fullName || "Mijoz"} · qoldiq{" "}
            <span className="tabular">{money.uzs(debt.remaining)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">To&rsquo;lov summasi</Label>
            <MoneyInput
              id="pay-amount"
              autoFocus
              value={amount}
              onValueChange={setAmount}
              aria-invalid={invalid}
              aria-describedby={tooMuch ? "pay-amount-error" : undefined}
              className="h-[52px] text-xl font-bold"
            />
            {tooMuch && (
              <p id="pay-amount-error" role="alert" className="text-caption text-danger">
                To&rsquo;lov qoldiqdan katta bo&rsquo;lishi mumkin emas
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {[debt.remaining, Math.round(debt.remaining / 2)]
                .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                .map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(preset)}
                  >
                    {preset === debt.remaining ? "To'liq" : "Yarmi"} ·{" "}
                    {money.plain(preset)}
                  </Button>
                ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Qaysi kassaga</Label>
            <div role="radiogroup" aria-label="To'lov turi" className="flex gap-2">
              {PAYMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={paymentType === type}
                  onClick={() => setPaymentType(type)}
                  className={cn(
                    "text-label flex h-[46px] flex-1 items-center justify-center rounded-md border",
                    "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    paymentType === type
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {PAYMENT_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Izoh</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ixtiyoriy"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={invalid || pay.isPending}>
            {pay.isPending ? (
              <span
                className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                aria-hidden
              />
            ) : (
              <HandCoins className="size-4" aria-hidden />
            )}
            To&rsquo;lovni qabul qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
