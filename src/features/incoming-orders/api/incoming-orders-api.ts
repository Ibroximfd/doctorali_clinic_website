import { toApiRange, type DateRange } from "@/shared/domain/date-range";
import type { OrderType } from "@/shared/domain/order-type";
import { endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import {
  parseIncomingFilterOptions,
  parseIncomingOrderDetail,
  parseIncomingOrderSummary,
  parseIncomingOrdersStats,
  type IncomingFilterOptions,
  type IncomingOrderDetail,
  type IncomingOrderSummary,
  type IncomingOrdersStats,
  type IncomingStatusGroup,
} from "../types/incoming-order";

/** `is_paid` — has the money arrived, separate from the fulfilment status. */
export type IncomingPaidFilter = "paid" | "pending";

export interface IncomingOrdersFilter {
  /** Status bucket tab (`status=` group code); null = all statuses. */
  readonly statusGroup?: IncomingStatusGroup | null;
  /**
   * Date window; null = ALL TIME — the deliberate default (§3). Silently
   * cutting the list to a period reads as "my order disappeared" at the desk.
   */
  readonly range?: DateRange | null;
  /** Backend `payment_method` code from the filters dictionary; null = all. */
  readonly paymentMethod?: string | null;
  readonly paidFilter?: IncomingPaidFilter | null;
  readonly orderType?: OrderType | null;
  /** Only orders carrying a gift line (`has_gift=true`); false sends nothing. */
  readonly giftOnly?: boolean;
  /** Free-text `search`: order number, external id, name, phone. */
  readonly search?: string;
  readonly ordering?: string;
}

export const DEFAULT_INCOMING_ORDERING = "-created_at";

/**
 * The shared filter → query-string mapping. The list and the summary MUST stay
 * on identical parameters (§6) — that is why this is one function.
 */
export function incomingFilterQuery(filter: IncomingOrdersFilter): Query {
  return {
    ...(filter.statusGroup ? { status: filter.statusGroup } : {}),
    ...(filter.range ? toApiRange(filter.range) : {}),
    ...(filter.paymentMethod ? { payment_method: filter.paymentMethod } : {}),
    ...(filter.paidFilter ? { is_paid: String(filter.paidFilter === "paid") } : {}),
    ...(filter.orderType ? { order_type: filter.orderType } : {}),
    ...(filter.giftOnly ? { has_gift: "true" } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
  };
}

export function incomingFilterKey(filter: IncomingOrdersFilter): readonly unknown[] {
  return [
    filter.statusGroup ?? null,
    filter.range?.start.getTime() ?? null,
    filter.range?.end.getTime() ?? null,
    filter.paymentMethod ?? null,
    filter.paidFilter ?? null,
    filter.orderType ?? null,
    filter.giftOnly ?? false,
    filter.search?.trim() ?? "",
    filter.ordering ?? DEFAULT_INCOMING_ORDERING,
  ];
}

export function fetchIncomingOrders(input: {
  filter: IncomingOrdersFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<IncomingOrderSummary>> {
  return http
    .get<unknown>(endpoints.incomingOrders, {
      query: {
        page: input.page ?? 1,
        ordering: input.filter.ordering ?? DEFAULT_INCOMING_ORDERING,
        ...incomingFilterQuery(input.filter),
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseIncomingOrderSummary));
}

export function fetchIncomingOrdersStats(
  filter: IncomingOrdersFilter,
  signal?: AbortSignal,
): Promise<IncomingOrdersStats> {
  return http
    .get<unknown>(endpoints.incomingOrdersSummary, {
      query: incomingFilterQuery(filter),
      signal,
    })
    .then(parseIncomingOrdersStats);
}

export function fetchIncomingFilterOptions(
  signal?: AbortSignal,
): Promise<IncomingFilterOptions> {
  return http
    .get<unknown>(endpoints.incomingOrdersFilters, { signal })
    .then(parseIncomingFilterOptions);
}

export function fetchIncomingOrderDetail(
  id: string,
  signal?: AbortSignal,
): Promise<IncomingOrderDetail> {
  return http
    .get<unknown>(endpoints.incomingOrder(id), { signal })
    .then(parseIncomingOrderDetail);
}
