import { toApiRange, type DateRange } from "@/shared/domain/date-range";
import type { PaymentType } from "@/shared/domain/payment-type";
import { CONFIRM_PIN_HEADER, endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import { parseOrderReturn, type OrderReturn } from "../types/order-return";

export interface ReturnFilter {
  readonly range?: DateRange | null;
  /** One order's returns — what the order detail shows. */
  readonly orderId?: string | null;
  /** Order number or reason text. */
  readonly search?: string;
}

export function returnFilterQuery(filter: ReturnFilter): Query {
  return {
    ...(filter.range ? toApiRange(filter.range) : {}),
    ...(filter.orderId ? { order_id: filter.orderId } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
  };
}

export function returnFilterKey(filter: ReturnFilter): readonly unknown[] {
  return [
    filter.range?.start.getTime() ?? null,
    filter.range?.end.getTime() ?? null,
    filter.orderId ?? null,
    filter.search?.trim() ?? "",
  ];
}

export function fetchReturns(input: {
  filter: ReturnFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<OrderReturn>> {
  return http
    .get<unknown>(endpoints.returns, {
      query: { page: input.page ?? 1, ...returnFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseOrderReturn));
}

/** One line being sent back: the ORDER LINE's id, not the product's. */
export interface ReturnLineInput {
  readonly orderItemId: string;
  readonly quantity: number;
}

export interface ReturnDraft {
  /**
   * The lines to return. **Null returns everything still on the order** — the
   * key is then left out entirely, which is how the backend reads "all of it".
   */
  readonly items: readonly ReturnLineInput[] | null;
  readonly refundPaymentType: PaymentType;
  readonly reason: string;
  /** Mandatory on EVERY return, whatever the order's date — money leaves the till. */
  readonly confirmPin: string;
}

export function createReturn(orderId: string, draft: ReturnDraft): Promise<OrderReturn> {
  return http
    .post<unknown>(endpoints.orderReturn(orderId), {
      json: {
        // Omitted, not empty: `items: []` would mean "return nothing".
        ...(draft.items && draft.items.length > 0
          ? {
              items: draft.items.map((line) => ({
                order_item_id: line.orderItemId,
                quantity: line.quantity,
              })),
            }
          : {}),
        refund_payment_type: draft.refundPaymentType,
        ...(draft.reason.trim() !== "" ? { reason: draft.reason.trim() } : {}),
      },
      headers: { [CONFIRM_PIN_HEADER]: draft.confirmPin },
    })
    .then(parseOrderReturn);
}

/**
 * `PATCH returns/{id}/` — the reason, and nothing else.
 *
 * Quantities and sums are immutable: changing them would mean moving stock and
 * money a second time. A wrong return is corrected by making another one. The
 * edit is audited, which is why it is allowed at all — a cash payout whose
 * stated reason can be swapped silently is worse than a typo.
 */
export function updateReturnReason(id: string, reason: string): Promise<OrderReturn> {
  return http
    .patch<unknown>(endpoints.orderReturnItem(id), { json: { reason: reason.trim() } })
    .then(parseOrderReturn);
}
