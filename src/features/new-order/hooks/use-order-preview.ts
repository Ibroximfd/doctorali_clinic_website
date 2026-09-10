"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { orderPreviewBody, previewOrder } from "@/features/orders/api/orders-api";
import { toDebtDraft } from "@/shared/components/form/debt-editor";

import {
  selectGiftEligible,
  selectIsDelivery,
  useNewOrderStore,
} from "../store/new-order-store";

/**
 * Asks the server what the basket costs.
 *
 * **The server is the authority on the money** — every rule added since the
 * form was written (per-unit overrides, the loyalty gift's free unit, packaging
 * prices, a hand-typed total) is another chance for two arithmetics to drift,
 * and a drift of one so'm makes a split payment fail with `payments_mismatch`.
 *
 * The query key is the basket itself, so React Query does the debouncing and
 * the out-of-order guard for free: holding down the stepper's + coalesces into
 * one request, and a slow answer for an older basket is discarded rather than
 * overwriting the screen with stale money.
 */
export function useOrderPreview() {
  const state = useNewOrderStore();
  const setPreview = useNewOrderStore((s) => s.setPreview);

  // Read outside the memo: the selectors take the whole store, and depending on
  // it would re-price the basket every time an unrelated field changed.
  const isDelivery = selectIsDelivery(state);
  const giftEligible = selectGiftEligible(state);

  const body = useMemo(() => {
    if (state.cart.length === 0) return null;
    return orderPreviewBody({
      orderType: state.orderType,
      clientPhone: isDelivery ? state.guestPhone : (state.client?.phone ?? ""),
      clientName: isDelivery ? state.guestName : null,
      doctor: state.doctor,
      items: state.cart,
      paymentType: state.paymentType,
      buyerType: state.buyerType,
      giftProduct: giftEligible ? state.giftProduct : null,
      debt: toDebtDraft({
        enabled: state.debtEnabled,
        amount: state.debtAmount,
        dueDate: state.debtDueDate,
        note: state.debtNote,
      }),
      totalOverride: state.totalOverride,
    });
    // Everything the price depends on — and nothing that doesn't, so typing a
    // note never re-prices the basket.
  }, [
    isDelivery,
    giftEligible,
    state.cart,
    state.totalOverride,
    state.giftProduct,
    state.doctor,
    state.buyerType,
    state.orderType,
    state.debtEnabled,
    state.debtAmount,
    state.debtDueDate,
    state.client,
    state.guestPhone,
    state.guestName,
    state.paymentType,
    state.debtNote,
  ]);

  const query = useQuery({
    queryKey: ["orders", "preview", body],
    queryFn: ({ signal }) => previewOrder(body as Record<string, unknown>, signal),
    enabled: body !== null,
    // A basket priced a moment ago is still priced: this stops a re-render from
    // re-asking while the desk reads the figure.
    staleTime: 15_000,
    retry: 1,
  });

  // Push the answer into the store so every selector reads one source of truth.
  useEffect(() => {
    if (body === null) {
      setPreview(null);
      return;
    }
    if (query.data) setPreview(query.data);
    else if (query.isError) setPreview(null, true);
  }, [body, query.data, query.isError, setPreview]);

  return {
    isPending: body !== null && query.isFetching && !query.data,
    failed: query.isError,
  };
}
