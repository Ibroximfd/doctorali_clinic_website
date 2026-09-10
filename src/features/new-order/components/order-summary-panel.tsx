"use client";

import {
  Gift,
  Pencil,
  ReceiptText,
  Save,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import { DebtEditor, type DebtDraftState } from "@/shared/components/form/debt-editor";
import {
  PaymentSplitEditor,
  splitError,
} from "@/shared/components/form/payment-split-editor";
import { PaymentTypeSelector } from "@/shared/components/form/payment-type-selector";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import type { PaymentType } from "@/shared/domain/payment-type";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";
import { cn } from "@/shared/lib/utils";

import {
  selectCreditedAmount,
  selectGiftDiscount,
  selectManualGiftValue,
  selectNothingPayable,
  selectPaidNow,
  selectPaymentUnmarked,
  selectSubmitBlocker,
  selectSubtotal,
  selectTotal,
  selectUnitCount,
  useNewOrderStore,
  canEditTotal,
} from "../store/new-order-store";

/**
 * The sticky money panel.
 *
 * Every figure here is the SERVER's whenever a preview has landed — the desk
 * shows what will actually be charged, not what the app worked out. When the
 * preview is missing the local sum stands in and says so ("taxminiy"), because
 * a till that refuses to work when one endpoint is down is worse than one that
 * admits an estimate.
 */
export function OrderSummaryPanel({
  onEditTotal,
  onSubmit,
  onReset,
  submitting,
  previewPending,
  previewFailed,
  commissionAmount,
  commissionPercent,
  commissionIsEstimate,
}: {
  onEditTotal: () => void;
  onSubmit: () => void;
  onReset: () => void;
  submitting: boolean;
  previewPending: boolean;
  previewFailed: boolean;
  commissionAmount: number | null;
  commissionPercent: number | null;
  commissionIsEstimate: boolean;
}) {
  const state = useNewOrderStore();
  const {
    cart,
    note,
    setNote,
    splitPayment,
    setSplitPayment,
    splitAmounts,
    setSplitAmount,
    paymentType,
    setPaymentType,
    unmarkPayment,
    showValidation,
    setDebt,
    editingOrder,
  } = state;

  const subtotal = selectSubtotal(state);
  const total = selectTotal(state);
  const giftDiscount = selectGiftDiscount(state);
  const credited = selectCreditedAmount(state);
  const paidNow = selectPaidNow(state);
  const manualGift = selectManualGiftValue(state);
  const nothingPayable = selectNothingPayable(state);
  const blocker = selectSubmitBlocker(state);
  const overrideDelta = total - subtotal;

  const debtState: DebtDraftState = {
    enabled: state.debtEnabled,
    amount: state.debtAmount,
    dueDate: state.debtDueDate,
    note: state.debtNote,
  };

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-5 shadow-sm">
      <div className="border-surface-alt flex items-center gap-3 border-b pb-4">
        <span className="bg-primary-soft flex rounded-[8px] p-2" aria-hidden>
          <ReceiptText className="text-primary size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title-lg">Hisob</h2>
          <p className="text-caption text-text-secondary mt-0.5">
            {cart.length === 0
              ? "Savat bo'sh"
              : previewPending
                ? "Server hisoblamoqda…"
                : previewFailed
                  ? "Taxminiy hisob — server javob bermadi"
                  : `${cart.length} ta mahsulot · ${selectUnitCount(state)} dona`}
          </p>
        </div>
      </div>

      {previewFailed && cart.length > 0 && (
        <p
          role="status"
          className="bg-warning/10 text-caption text-warning flex items-start gap-2 rounded-sm p-2.5"
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          Summalar taxminiy. Saqlashda server o&rsquo;z hisobini qo&rsquo;llaydi.
        </p>
      )}

      <dl className="flex flex-col gap-2">
        <Row label="Mahsulotlar" value={money.plain(subtotal)} />
        {manualGift > 0 && (
          <Row label="Savatdagi sovg'a" value={`−${money.plain(manualGift)}`} muted />
        )}
        {giftDiscount > 0 && (
          <Row
            label={
              <span className="inline-flex items-center gap-1.5">
                <Gift className="text-gold size-3.5" aria-hidden />
                Sadoqat sovg&rsquo;asi
              </span>
            }
            value={`−${money.plain(giftDiscount)}`}
            tone="gold"
          />
        )}
        {overrideDelta !== 0 && (
          <Row
            label={overrideDelta < 0 ? "Qo'lda chegirma" : "Qo'lda qo'shimcha"}
            value={money.signed(overrideDelta)}
            tone={overrideDelta < 0 ? "primary" : "warning"}
          />
        )}
      </dl>

      <div className="bg-surface-alt rounded-md p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-label flex-1">Jami</span>
          <span className="text-headline tabular">{money.plain(total)}</span>
          {canEditTotal(state) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEditTotal}
              aria-label="Jami summani qo'lda kiritish"
              className="text-text-tertiary size-7"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>

        {credited > 0 && (
          <div className="border-border-strong mt-2 flex items-baseline gap-2 border-t border-dashed pt-2">
            <span className="text-caption text-text-secondary flex-1">Qarzga</span>
            <span className="text-title-sm text-warning tabular">
              {money.plain(credited)}
            </span>
          </div>
        )}

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-label-sm flex-1">Hozir to&rsquo;lanadi</span>
          <span className="text-title-lg text-primary-dark tabular">
            {money.plain(paidNow)}
          </span>
        </div>
      </div>

      <DebtEditor
        state={debtState}
        onChange={(next) =>
          setDebt({
            debtEnabled: next.enabled,
            debtAmount: next.amount,
            debtDueDate: next.dueDate,
            debtNote: next.note,
          })
        }
        maxAmount={total - giftDiscount}
        showValidation={showValidation}
      />

      <div className="space-y-1.5">
        <Label>To&rsquo;lov turi</Label>
        <PaymentTypeSelector
          value={paymentType}
          onChange={setPaymentType}
          nothingPayable={nothingPayable}
          marked={!selectPaymentUnmarked(state)}
          onUnmark={unmarkPayment}
          error={
            showValidation && !splitPayment && !nothingPayable && paymentType === null
              ? "To'lov turini tanlang"
              : null
          }
        />
      </div>

      <PaymentSplitEditor
        enabled={splitPayment}
        onEnabledChange={setSplitPayment}
        amounts={splitAmounts as Readonly<Partial<Record<PaymentType, number>>>}
        onAmountChange={setSplitAmount}
        target={paidNow}
        error={showValidation && splitPayment ? splitError(splitAmounts, paidNow) : null}
      />

      {commissionAmount !== null && (
        <div className="border-border flex items-center gap-3 rounded-md border p-3">
          <span
            className="bg-primary-soft flex size-8 items-center justify-center rounded-sm"
            aria-hidden
          >
            <Stethoscope className="text-primary size-[17px]" />
          </span>
          <div className="flex-1">
            <p className="text-caption text-text-secondary">Shifokor komissiyasi</p>
            <p className="text-title tabular mt-0.5">
              {money.plain(commissionAmount)}
              {commissionPercent !== null && (
                <span className="text-caption text-text-tertiary ml-1.5 font-semibold">
                  · {percent.labeled(commissionPercent)}
                </span>
              )}
              {commissionIsEstimate && (
                <span className="text-caption text-warning ml-1.5 font-normal">
                  (taxminiy)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="order-note">Izoh</Label>
        <Textarea
          id="order-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ixtiyoriy izoh…"
        />
      </div>

      {showValidation && blocker && (
        <p
          role="alert"
          className="bg-danger/10 text-caption text-danger flex items-start gap-2 rounded-sm p-2.5"
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          {blocker}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onReset} disabled={submitting}>
          Tozalash
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="h-12 flex-1 text-base font-bold"
        >
          {submitting ? (
            <span
              className="border-primary-foreground/40 border-t-primary-foreground size-[18px] animate-spin rounded-full border-2"
              aria-hidden
            />
          ) : (
            <Save className="size-[18px]" aria-hidden />
          )}
          {editingOrder ? "O'zgarishni saqlash" : "Saqlash va chek"}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  muted?: boolean;
  tone?: "primary" | "warning" | "gold";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt
        className={cn(
          "text-caption flex-1",
          muted ? "text-text-tertiary" : "text-text-secondary",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-title-sm tabular",
          tone === "primary" && "text-primary-dark",
          tone === "warning" && "text-warning",
          tone === "gold" && "text-gold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
