"use client";

import { DateInput } from "@/shared/components/form/date-input";
import { MoneyInput } from "@/shared/components/form/money-input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import type { DebtDraft } from "@/features/debts/types/debt";
import {
  addDays,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

export interface DebtDraftState {
  readonly enabled: boolean;
  readonly amount: number;
  readonly dueDate: TashkentDate | null;
  readonly note: string;
}

export const EMPTY_DEBT_DRAFT: DebtDraftState = {
  enabled: false,
  amount: 0,
  dueDate: null,
  note: "",
};

/**
 * "Bir qismi qarzga" — the block that puts part of a sale on credit.
 *
 * Shared verbatim by New Order and the treatment form because the backend takes
 * the same `debt` object in both places. Two rules it enforces before the
 * request goes out:
 *   • the credited amount can never exceed what is payable;
 *   • the deadline is mandatory and never in the past.
 */
export function DebtEditor({
  state,
  onChange,
  /** The most that may go on credit — the sale's payable total. */
  maxAmount,
  showValidation = false,
  fieldErrors,
  className,
}: {
  state: DebtDraftState;
  onChange: (next: DebtDraftState) => void;
  maxAmount: number;
  showValidation?: boolean;
  /** Server-side messages keyed `debt.amount` / `debt.due_date`. */
  fieldErrors?: { amount?: string; dueDate?: string };
  className?: string;
}) {
  const amountError = debtAmountError(state, maxAmount, showValidation, fieldErrors);
  const dueDateError = debtDueDateError(state, showValidation, fieldErrors);
  const tomorrow = addDays(startOfDay(nowTashkent()), 1);

  return (
    <div
      className={cn("border-border bg-surface-alt/40 rounded-md border p-3.5", className)}
    >
      <div className="flex items-center gap-2.5">
        <Switch
          id="debt-enabled"
          checked={state.enabled}
          onCheckedChange={(enabled) =>
            onChange(enabled ? { ...state, enabled: true } : { ...EMPTY_DEBT_DRAFT })
          }
        />
        <Label htmlFor="debt-enabled" className="flex-1 cursor-pointer font-semibold">
          Bir qismi qarzga
        </Label>
        {state.enabled && maxAmount > 0 && (
          <span className="text-caption text-text-tertiary tabular">
            Maksimum {money.plain(maxAmount)}
          </span>
        )}
      </div>

      {state.enabled && (
        /*
         * Three columns only when the box they sit in is actually wide enough.
         * In the 400px money panel a viewport `sm:` is true while the space is
         * not there — which is what squeezed "Qaytarish muddati" onto two lines
         * and cut the date picker off.
         */
        <div className="@container/debt mt-3">
          <div className="grid gap-3 @lg/debt:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-amount">Qarz summasi</Label>
              <MoneyInput
                id="debt-amount"
                value={state.amount}
                onValueChange={(amount) => onChange({ ...state, amount })}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? "debt-amount-error" : undefined}
                className="h-[46px] font-bold"
              />
              {amountError && (
                <p
                  id="debt-amount-error"
                  role="alert"
                  className="text-caption text-danger"
                >
                  {amountError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Qaytarish muddati</Label>
              <DateInput
                id="debt-due"
                value={state.dueDate}
                onChange={(dueDate) => onChange({ ...state, dueDate })}
                fromDate={tomorrow}
                aria-invalid={Boolean(dueDateError)}
                aria-describedby={dueDateError ? "debt-due-error" : undefined}
              />
              {dueDateError && (
                <p id="debt-due-error" role="alert" className="text-caption text-danger">
                  {dueDateError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-note">Izoh</Label>
              <Textarea
                id="debt-note"
                rows={1}
                value={state.note}
                onChange={(event) => onChange({ ...state, note: event.target.value })}
                placeholder="Ixtiyoriy"
                className="min-h-[46px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Live, before submit — reception shouldn't have to press Save to find out the
 * credited amount exceeds the sale.
 */
export function debtAmountError(
  state: DebtDraftState,
  maxAmount: number,
  showValidation: boolean,
  fieldErrors?: { amount?: string },
): string | null {
  if (fieldErrors?.amount) return fieldErrors.amount;
  if (!state.enabled) return null;
  if (state.amount <= 0) return showValidation ? "Qarz summasini kiriting" : null;
  if (state.amount > maxAmount) return "Qarz buyurtma summasidan katta";
  return null;
}

export function debtDueDateError(
  state: DebtDraftState,
  showValidation: boolean,
  fieldErrors?: { dueDate?: string },
): string | null {
  if (fieldErrors?.dueDate) return fieldErrors.dueDate;
  if (!state.enabled) return null;
  if (showValidation && state.dueDate === null) return "Qaytarish muddatini belgilang";
  return null;
}

export function isDebtDraftValid(state: DebtDraftState, maxAmount: number): boolean {
  if (!state.enabled) return true;
  return state.amount > 0 && state.amount <= maxAmount && state.dueDate !== null;
}

/** The `debt` block as the backend expects it, or null when unused. */
export function toDebtDraft(state: DebtDraftState): DebtDraft | null {
  if (!state.enabled || state.amount <= 0 || state.dueDate === null) return null;
  return { amount: state.amount, dueDate: state.dueDate, note: state.note };
}

/** So'm actually going on credit — zero unless the block is switched on. */
export function creditedAmount(state: DebtDraftState): number {
  return state.enabled ? state.amount : 0;
}
