"use client";

import { PackagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { createOrder, updateOrder } from "@/features/orders/api/orders-api";
import { useInvalidateOrders } from "@/features/orders/hooks/use-orders";
import type { CreateOrderResult } from "@/features/orders/types/order";
import { percentFor } from "@/features/doctors/types/doctor";
import { useReceiptPrint } from "@/features/receipt/hooks/use-receipt-print";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { splitPayments } from "@/shared/components/form/payment-split-editor";
import { toDebtDraft } from "@/shared/components/form/debt-editor";
import { AppRoutes } from "@/config/routes";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { Button } from "@/shared/components/ui/button";
import { ApiError } from "@/shared/lib/api/errors";
import { uuidV4 } from "@/shared/lib/uuid";

import {
  canEditTotal,
  selectEffectivePaymentType,
  selectGiftEligible,
  selectIsDelivery,
  selectIsValid,
  selectNeedsConfirmPin,
  selectPayableTotal,
  selectSubmitBlocker,
  selectSubtotal,
  useNewOrderStore,
} from "../store/new-order-store";
import { useNewOrderSession } from "../hooks/use-new-order-session";
import { OrderCartPanel } from "./order-cart-panel";
import { OrderClientSection } from "./order-client-section";
import { OrderSummaryPanel } from "./order-summary-panel";
import { OrderSuccessOverlay } from "./order-success-overlay";
import { TotalOverrideDialog } from "./total-override-dialog";

/**
 * "Yangi buyurtma" — the flow reception spends most of its day in.
 *
 * The order is built on two pages: the catalogue has one of its own
 * (`/new-order/products`), and this one is where the sale is actually made —
 * who it is for, what is in the basket, and what is paid. Splitting them is
 * what gives the catalogue its full width and this page room to breathe; the
 * basket appears on both, editable in both, because it is the same component
 * reading the same store.
 *
 * Everything typed here survives a browser reload (see `startDraftPersistence`)
 * — a lost cart at a busy desk means asking the client to repeat the order.
 */
/** The catalogue, one route down from the order itself. */
const PRODUCTS_PATH = `${AppRoutes.newOrder}/products`;

export function NewOrderView() {
  const preview = useNewOrderSession();

  const state = useNewOrderStore();
  const {
    cart,
    setTotalOverride,
    reset,
    setShowValidation,
    setFieldErrors,
    applyStockIssues,
  } = state;

  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidV4());

  const pinGate = usePinGate();
  const invalidateOrders = useInvalidateOrders();
  const { print, isPrinting } = useReceiptPrint();

  const commissionPercent = state.doctor?.commissionPercent ?? null;
  const commissionAmount =
    state.preview?.commissionAmount ??
    (state.doctor && commissionPercent !== null
      ? Math.round((selectPayableTotal(state) * commissionPercent) / 100)
      : null);

  async function save(confirmPin?: string) {
    setSubmitting(true);
    try {
      const draft = {
        orderType: state.orderType,
        clientPhone: selectIsDelivery(state)
          ? state.guestPhone
          : (state.client?.phone ?? ""),
        clientName: selectIsDelivery(state) ? state.guestName.trim() : null,
        doctor: state.doctor,
        items: state.cart,
        paymentType: selectEffectivePaymentType(state),
        payments: state.splitPayment ? splitPayments(state.splitAmounts) : null,
        buyerType: state.buyerType,
        note: state.note,
        giftProduct: selectGiftEligible(state) ? state.giftProduct : null,
        debt: toDebtDraft({
          enabled: state.debtEnabled,
          amount: state.debtAmount,
          dueDate: state.debtDueDate,
          note: state.debtNote,
        }),
        appointmentId: state.appointmentId,
        totalOverride: state.totalOverride,
        createdAt: state.orderDate,
        confirmPin: confirmPin ?? null,
        idempotencyKey,
      };

      const payable = selectPayableTotal(state);
      const editing = state.editingOrder;
      const saved = editing
        ? await updateOrder(editing.id, draft, payable)
        : await createOrder(draft, payable);

      invalidateOrders();
      setResult(saved);
      // The order exists on the server now: drop the draft immediately rather
      // than at the reset, so a reload during the success screen can never
      // bring the cart back and invite a duplicate.
      reset();
      // The receipt goes out on its own — saving never waits on the printer.
      print(saved.order.id, saved.receipt);
    } catch (error) {
      if (ApiError.is(error)) {
        setFieldErrors(error.fieldErrors);
        // `insufficient_stock` carries the real balances (the race two tills
        // lose to each other) — fold them back into the cart so the lines
        // correct themselves instead of failing again on resubmit.
        applyStockIssues(error.stockIssues);
        toast.error(error.message);
      } else {
        toast.error("Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    setShowValidation(true);
    if (!selectIsValid(state)) {
      // Never stop silently: the blocking field is often out of view, so a bare
      // return reads as a dead button.
      toast.error(selectSubmitBlocker(state) ?? "Formani to'ldiring");
      return;
    }
    if (selectNeedsConfirmPin(state)) pinGate.requestPin((pin) => void save(pin));
    else void save();
  }

  if (result) {
    return (
      <PageContainer className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-md">
          <OrderSuccessOverlay
            result={result}
            printing={isPrinting}
            onPrint={() => print(result.order.id, result.receipt)}
            onNewOrder={() => {
              setResult(null);
              setIdempotencyKey(uuidV4());
            }}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      {/*
        Two columns on a wide screen: what is being sold on the left, what it
        costs on the right, each scrolling on its own so the total stays put
        while the basket is edited. Below `xl` they stack and the page scrolls
        normally — the money panel then sits under the basket, which is the
        order it is read in on a narrow screen anyway.
      */}
      <PageContainer className="flex flex-col gap-4 xl:h-full xl:flex-row xl:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-4 xl:overflow-y-auto xl:pr-1">
          <OrderClientSection />

          <OrderCartPanel
            emptyMessage="Mahsulot tanlash sahifasida kartochkani bosing — u shu yerga tushadi."
            action={
              <Button
                asChild
                variant={cart.length === 0 ? "default" : "outline"}
                className="w-full"
              >
                <Link href={PRODUCTS_PATH}>
                  {cart.length === 0 ? (
                    <PackagePlus className="size-4" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  {cart.length === 0 ? "Mahsulot tanlash" : "Yana mahsulot qo'shish"}
                </Link>
              </Button>
            }
          />
        </div>

        <div className="w-full shrink-0 xl:w-[400px] xl:overflow-y-auto">
          <OrderSummaryPanel
            onEditTotal={() => canEditTotal(state) && setTotalDialogOpen(true)}
            onSubmit={handleSubmit}
            onReset={reset}
            submitting={submitting}
            previewPending={preview.previewPending}
            previewFailed={preview.previewFailed}
            commissionAmount={commissionAmount}
            commissionPercent={commissionPercent}
            commissionIsEstimate={state.preview?.commissionAmount === undefined}
          />
        </div>
      </PageContainer>

      <TotalOverrideDialog
        open={totalDialogOpen}
        onOpenChange={setTotalDialogOpen}
        subtotal={selectSubtotal(state)}
        current={state.totalOverride}
        onApply={setTotalOverride}
      />

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        description="Buyurtmani boshqa kunga yozish uchun 4 xonali PIN-kodni kiriting."
      />
    </>
  );
}

export { percentFor };
