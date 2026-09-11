"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createOrder, updateOrder } from "@/features/orders/api/orders-api";
import { useInvalidateOrders } from "@/features/orders/hooks/use-orders";
import type { CreateOrderResult } from "@/features/orders/types/order";
import { useReceiptPrint } from "@/features/receipt/hooks/use-receipt-print";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { toDebtDraft } from "@/shared/components/form/debt-editor";
import { splitPayments } from "@/shared/components/form/payment-split-editor";
import { ApiError } from "@/shared/lib/api/errors";
import { uuidV4 } from "@/shared/lib/uuid";

import {
  selectEffectivePaymentType,
  selectGiftEligible,
  selectIsDelivery,
  selectIsValid,
  selectNeedsConfirmPin,
  selectPayableTotal,
  selectSubmitBlocker,
  useNewOrderStoreApi,
} from "../store/new-order-store";

/**
 * Error codes that mean "the server counted this write as out-of-today". The
 * app makes the same judgement itself (see `selectNeedsConfirmPin`) and asks
 * first, but the two clocks can disagree — at midnight, or on an order the
 * desk edits a minute after the day turned. When they do, the PIN is asked for
 * once here and the identical request goes back out with it.
 */
const PIN_CODES = new Set(["pin_required", "edit_window_closed"]);

/**
 * Saves the form the surrounding store holds — a new sale or an edit of an
 * existing one, which differ only in the endpoint.
 *
 * It reads the store through its API rather than a rendered snapshot, so the
 * body is built from the state at the moment of the click: a PIN retry that
 * arrives two seconds later still sends what is on screen.
 */
export function useOrderSubmit({
  onSaved,
}: {
  /** Runs once the server has accepted the order. */
  onSaved: (result: CreateOrderResult) => void;
}) {
  const store = useNewOrderStoreApi();
  const invalidateOrders = useInvalidateOrders();
  const { print } = useReceiptPrint();
  const pinGate = usePinGate();

  const [submitting, setSubmitting] = useState(false);
  // One key per submission, reused across retries so a dropped connection
  // followed by a second tap can never create two orders.
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidV4());

  const save = useCallback(
    async function save(confirmPin?: string): Promise<void> {
      const state = store.getState();
      setSubmitting(true);
      state.setSaveError(null);
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
        onSaved(saved);
        // The receipt goes out on its own — saving never waits on the printer.
        // An edit reprints too: the client's old receipt is now wrong.
        print(saved.order.id, saved.receipt);
      } catch (error) {
        if (ApiError.is(error)) {
          // The server wants the PIN we didn't think was needed: ask once and
          // re-send the identical request.
          if (PIN_CODES.has(error.code) && confirmPin === undefined) {
            pinGate.requestPin((pin) => void save(pin));
            return;
          }
          store.getState().setFieldErrors(error.fieldErrors);
          // `insufficient_stock` carries the real balances (the race two tills
          // lose to each other) — fold them back into the cart so the lines
          // correct themselves instead of failing again on resubmit.
          store.getState().applyStockIssues(error.stockIssues);
          // Both: the toast catches the eye, the panel keeps the server's
          // reason on screen while the desk fixes what it names.
          store.getState().setSaveError(error.message);
          toast.error(error.message);
        } else {
          const message = "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.";
          store.getState().setSaveError(message);
          toast.error(message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [store, idempotencyKey, invalidateOrders, onSaved, pinGate, print],
  );

  /** Validates, gates on the PIN when the write leaves today, then saves. */
  const submit = useCallback(() => {
    const state = store.getState();
    state.setShowValidation(true);
    if (!selectIsValid(state)) {
      // Never stop silently: the blocking field is often out of view, so a bare
      // return reads as a dead button.
      toast.error(selectSubmitBlocker(state) ?? "Formani to'ldiring");
      return;
    }
    if (selectNeedsConfirmPin(state)) pinGate.requestPin((pin) => void save(pin));
    else void save();
  }, [store, pinGate, save]);

  return {
    submit,
    submitting,
    pinGate,
    /** Starts a new submission identity — after a saved order, for the next one. */
    renewIdempotencyKey: useCallback(() => setIdempotencyKey(uuidV4()), []),
  } as const;
}
