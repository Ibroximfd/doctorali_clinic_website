"use client";

import { PackagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { CreateOrderResult } from "@/features/orders/types/order";
import { percentFor } from "@/features/doctors/types/doctor";
import { useReceiptPrint } from "@/features/receipt/hooks/use-receipt-print";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { AppRoutes } from "@/config/routes";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { Button } from "@/shared/components/ui/button";

import {
  canEditTotal,
  selectPayableTotal,
  selectSubtotal,
  useNewOrderStore,
} from "../store/new-order-store";
import { useNewOrderSession } from "../hooks/use-new-order-session";
import { useOrderSubmit } from "../hooks/use-order-submit";
import { OrderCartPanel } from "./order-cart-panel";
import { OrderClientSection } from "./order-client-section";
import { OrderGiftSection } from "./order-gift-section";
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
  const { cart, setTotalOverride, reset } = state;

  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [result, setResult] = useState<CreateOrderResult | null>(null);

  const { print, isPrinting } = useReceiptPrint();
  const { submit, submitting, pinGate, renewIdempotencyKey } = useOrderSubmit({
    onSaved(saved) {
      setResult(saved);
      // The order exists on the server now: drop the draft immediately rather
      // than at the reset, so a reload during the success screen can never
      // bring the cart back and invite a duplicate.
      reset();
    },
  });

  const commissionPercent = state.doctor?.commissionPercent ?? null;
  const commissionAmount =
    state.preview?.commissionAmount ??
    (state.doctor && commissionPercent !== null
      ? Math.round((selectPayableTotal(state) * commissionPercent) / 100)
      : null);

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
              renewIdempotencyKey();
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

          <OrderGiftSection />

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
            onSubmit={submit}
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
