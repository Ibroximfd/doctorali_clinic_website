import {
  debtDraftToJson,
  type DebtDraft,
  type DebtStatus,
} from "@/features/debts/types/debt";
import type { Doctor } from "@/features/doctors/types/doctor";
import type { Product } from "@/features/products/types/product";
import { toApiRange, type DateRange } from "@/shared/domain/date-range";
import type { BuyerType, OrderType } from "@/shared/domain/order-type";
import { allowsGift } from "@/shared/domain/order-type";
import { type OrderPayment, type PaymentType } from "@/shared/domain/payment-type";
import {
  CONFIRM_PIN_HEADER,
  IDEMPOTENCY_HEADER,
  endpoints,
} from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { toApiIso, ymd, type TashkentDate } from "@/shared/lib/format/date";
import { uuidV4 } from "@/shared/lib/uuid";

import {
  parseCreateOrderResult,
  parseOrderDetail,
  parseOrderSummary,
  type CreateOrderResult,
  type OrderDetail,
  type OrderSummary,
} from "../types/order";
import { orderItemsBody, orderPaymentBody, type CartItem } from "../types/cart";
import { parseOrderPreview, type OrderPreview } from "../types/order-preview";

export interface OrderFilter {
  readonly range?: DateRange | null;
  readonly doctorId?: string | null;
  /** Free-text search on order number / client phone / client name. */
  readonly search?: string;
  readonly ordering?: string;
  readonly paymentType?: PaymentType | null;
  readonly orderType?: OrderType | null;
  readonly hasDebt?: boolean | null;
  /** Narrow to one debt state — the "who owes me right now" view. */
  readonly debtStatus?: DebtStatus | null;
  readonly dueFrom?: TashkentDate | null;
  readonly dueTo?: TashkentDate | null;
  readonly clientId?: number | null;
}

export const DEFAULT_ORDER_FILTER: OrderFilter = { ordering: "-created_at" };

export function orderFilterQuery(filter: OrderFilter): Query {
  return {
    ordering: filter.ordering ?? "-created_at",
    ...(filter.range ? toApiRange(filter.range) : {}),
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ...(filter.paymentType ? { payment_type: filter.paymentType } : {}),
    ...(filter.orderType ? { order_type: filter.orderType } : {}),
    ...(filter.hasDebt !== null && filter.hasDebt !== undefined
      ? { has_debt: String(filter.hasDebt) }
      : {}),
    ...(filter.debtStatus ? { debt_status: filter.debtStatus } : {}),
    ...(filter.dueFrom ? { due_from: ymd(filter.dueFrom) } : {}),
    ...(filter.dueTo ? { due_to: ymd(filter.dueTo) } : {}),
    ...(filter.clientId ? { client_id: filter.clientId } : {}),
  };
}

export function orderFilterKey(filter: OrderFilter): readonly unknown[] {
  return [
    filter.range?.start.getTime() ?? null,
    filter.range?.end.getTime() ?? null,
    filter.doctorId ?? null,
    filter.search?.trim() ?? "",
    filter.ordering ?? "-created_at",
    filter.paymentType ?? null,
    filter.orderType ?? null,
    filter.hasDebt ?? null,
    filter.debtStatus ?? null,
    filter.dueFrom?.getTime() ?? null,
    filter.dueTo?.getTime() ?? null,
    filter.clientId ?? null,
  ];
}

export function fetchOrders(input: {
  filter: OrderFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<OrderSummary>> {
  return http
    .get<unknown>(endpoints.orders, {
      query: { page: input.page ?? 1, ...orderFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseOrderSummary));
}

export function fetchOrderDetail(id: string, signal?: AbortSignal): Promise<OrderDetail> {
  return http.get<unknown>(endpoints.order(id), { signal }).then(parseOrderDetail);
}

// --- Create / update ---------------------------------------------------------

export interface OrderDraft {
  readonly orderType: OrderType;
  /** API phone value `998XXXXXXXXX`. */
  readonly clientPhone: string;
  /** Required for a phone the clinic doesn't know yet; ignored for a card. */
  readonly clientName?: string | null;
  /** Optional: a staff purchase and a delivery may have no doctor. */
  readonly doctor?: Doctor | null;
  readonly items: readonly CartItem[];
  readonly paymentType: PaymentType | null;
  readonly payments?: readonly OrderPayment[] | null;
  readonly buyerType?: BuyerType | null;
  readonly note?: string | null;
  readonly giftProduct?: Product | null;
  readonly debt?: DebtDraft | null;
  readonly appointmentId?: string | null;
  /** Order total typed by hand; null bills the lines as they are. */
  readonly totalOverride?: number | null;
  /** When the sale actually happened, for one rung up after the fact. */
  readonly createdAt?: TashkentDate | null;
  readonly confirmPin?: string | null;
  readonly idempotencyKey?: string;
}

/**
 * Body for `POST orders/preview/` — everything that moves the money, and
 * nothing that doesn't.
 *
 * The payment type and the idempotency key are left out (a preview books
 * nothing), and so is a **guest** phone: a delivery to a number the base has
 * never seen would have the server resolving or creating a client card just to
 * quote a price. A known client's phone IS sent, because the loyalty gift
 * depends on their order count.
 */
export function orderPreviewBody(draft: OrderDraft): Record<string, unknown> {
  const isGuest = Boolean(draft.clientName);
  return {
    order_type: draft.orderType,
    ...(!isGuest && draft.clientPhone ? { client_phone: draft.clientPhone } : {}),
    ...(draft.doctor ? { doctor_id: Number.parseInt(draft.doctor.id, 10) } : {}),
    ...(draft.buyerType ? { buyer_type: draft.buyerType } : {}),
    items: orderItemsBody(draft.items),
    ...(draft.giftProduct && allowsGift(draft.orderType)
      ? { gift_product_id: Number.parseInt(draft.giftProduct.id, 10) }
      : {}),
    ...(draft.debt ? { debt: debtDraftToJson(draft.debt) } : {}),
    ...(draft.totalOverride !== null && draft.totalOverride !== undefined
      ? { total_override: draft.totalOverride }
      : {}),
  };
}

export function previewOrder(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<OrderPreview> {
  return http
    .post<unknown>(endpoints.ordersPreview, { json: body, signal })
    .then(parseOrderPreview);
}

/** How much reaches the till now — `payable − credited`, never below zero. */
function paidNowOf(payableTotal: number, draft: OrderDraft): number {
  return Math.max(0, payableTotal - (draft.debt?.amount ?? 0));
}

export function createOrder(
  draft: OrderDraft,
  payableTotal: number,
): Promise<CreateOrderResult> {
  const paidNow = paidNowOf(payableTotal, draft);

  return http
    .post<unknown>(endpoints.orders, {
      json: {
        order_type: draft.orderType,
        client_phone: draft.clientPhone,
        ...(draft.clientName?.trim() ? { client_name: draft.clientName.trim() } : {}),
        // Omitted for a staff purchase or a delivery with no doctor selected.
        ...(draft.doctor ? { doctor_id: Number.parseInt(draft.doctor.id, 10) } : {}),
        ...orderPaymentBody({
          paidNow,
          paymentType: draft.paymentType,
          payments: draft.payments ?? null,
        }),
        ...(draft.buyerType ? { buyer_type: draft.buyerType } : {}),
        items: orderItemsBody(draft.items),
        ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
        // A delivery never carries the loyalty gift, whatever the caller passed.
        ...(draft.giftProduct && allowsGift(draft.orderType)
          ? { gift_product_id: Number.parseInt(draft.giftProduct.id, 10) }
          : {}),
        ...(draft.debt ? { debt: debtDraftToJson(draft.debt) } : {}),
        ...(draft.appointmentId ? { appointment_id: draft.appointmentId } : {}),
        ...(draft.totalOverride !== null && draft.totalOverride !== undefined
          ? { total_override: draft.totalOverride }
          : {}),
        ...(draft.createdAt ? { created_at: toApiIso(draft.createdAt) } : {}),
      },
      headers: {
        // One key per submission, reused on every retry: a dropped connection
        // followed by a second tap must not create two orders.
        [IDEMPOTENCY_HEADER]: draft.idempotencyKey ?? uuidV4(),
        ...(draft.confirmPin ? { [CONFIRM_PIN_HEADER]: draft.confirmPin } : {}),
      },
    })
    .then(parseCreateOrderResult);
}

/**
 * `PATCH orders/{id}/` — **`items` fully replaces the basket**.
 *
 * There is no "remove one line" call: the request carries the cart's NEW state
 * in full, and the server reverses the old one (stock, commission, debt, gift)
 * inside a single transaction, so a rejected edit leaves the order as it was.
 *
 * What an edit cannot touch: the client, the order type and the order number.
 * The loyalty gift is not part of the PATCH contract either.
 */
export function updateOrder(
  id: string,
  draft: OrderDraft,
  payableTotal: number,
): Promise<CreateOrderResult> {
  const paidNow = paidNowOf(payableTotal, draft);

  return http
    .patch<unknown>(endpoints.order(id), {
      json: {
        items: orderItemsBody(draft.items),
        ...orderPaymentBody({
          paidNow,
          paymentType: draft.paymentType,
          payments: draft.payments ?? null,
        }),
        // ALWAYS sent, `null` included: the body carries the order's new state,
        // and a key left out is a field the server keeps as it was. Omitting it
        // for a cleared doctor left the old one on the order — an edit that
        // moved a sale to a staff purchase went on paying them commission.
        doctor_id: draft.doctor ? Number.parseInt(draft.doctor.id, 10) : null,
        ...(draft.buyerType ? { buyer_type: draft.buyerType } : {}),
        ...(draft.note !== null && draft.note !== undefined
          ? { note: draft.note.trim() }
          : {}),
        ...(draft.debt ? { debt: debtDraftToJson(draft.debt) } : {}),
        ...(draft.totalOverride !== null && draft.totalOverride !== undefined
          ? { total_override: draft.totalOverride }
          : {}),
        // Only sent when the desk actually moved the order to another day.
        ...(draft.createdAt ? { created_at: toApiIso(draft.createdAt) } : {}),
      },
      headers: draft.confirmPin ? { [CONFIRM_PIN_HEADER]: draft.confirmPin } : undefined,
    })
    .then(parseCreateOrderResult);
}

/**
 * `POST orders/{id}/cancel/` — the reason is what the audit log and the client's
 * history feed will show. `confirmPin` is required for an order that isn't
 * today's.
 */
export function cancelOrder(
  id: string,
  input: { reason?: string; confirmPin?: string | null },
): Promise<OrderDetail> {
  return http
    .post<Record<string, unknown>>(endpoints.orderCancel(id), {
      json: input.reason?.trim() ? { reason: input.reason.trim() } : undefined,
      headers: input.confirmPin ? { [CONFIRM_PIN_HEADER]: input.confirmPin } : undefined,
    })
    .then((data) => {
      const order = data?.order;
      return parseOrderDetail(typeof order === "object" && order !== null ? order : data);
    });
}

/**
 * `DELETE orders/{id}/` — erases an order for good.
 *
 * Different from a cancel: a cancelled order stays in the history as a
 * cancelled line, a deleted one is gone from every list and report. It is for a
 * mistake that should never have existed (a test sale, a double entry), so it
 * always takes a reason for the audit log and the PIN.
 *
 * The reason travels in the BODY: a DELETE query string would end up in the
 * server's access log next to a client's name.
 */
export function deleteOrder(
  id: string,
  input: { reason: string; confirmPin: string },
): Promise<void> {
  return http.delete<void>(endpoints.order(id), {
    json: { reason: input.reason.trim() },
    headers: { [CONFIRM_PIN_HEADER]: input.confirmPin },
  });
}
