"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { DateRange } from "@/shared/domain/date-range";
import type { OrderType } from "@/shared/domain/order-type";
import { addDays, dateFromYmd, ymd } from "@/shared/lib/format/date";

import type { IncomingPaidFilter } from "../api/incoming-orders-api";
import { DEFAULT_INCOMING_ORDERING } from "../api/incoming-orders-api";
import {
  INCOMING_STATUS_GROUPS,
  type IncomingStatusGroup,
} from "../types/incoming-order";

/**
 * Fallback sort menu for when `filters/` hasn't answered (yet) — the codes are
 * the documented stable ones, and the live dictionary replaces this list as
 * soon as it loads.
 */
export const INCOMING_ORDERING_FALLBACK = [
  { value: "-created_at", label: "Avval yangilari" },
  { value: "created_at", label: "Avval eskilari" },
  { value: "-total_amount", label: "Katta summa" },
  { value: "total_amount", label: "Kichik summa" },
] as const;

export const PAID_FILTERS = [
  { value: "paid", label: "To'langan" },
  { value: "pending", label: "To'lanmagan" },
] as const;

/** Everything that decides which incoming orders are on screen, and which page. */
export interface IncomingListState {
  readonly statusGroup: IncomingStatusGroup | null;
  readonly range: DateRange | null;
  readonly paymentMethod: string | null;
  readonly paidFilter: IncomingPaidFilter | null;
  readonly orderType: OrderType | null;
  readonly giftOnly: boolean;
  readonly ordering: string;
  readonly search: string;
  readonly page: number;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Reads the list's state back out of the URL — the list's memory, so Back from
 * a client card lands on the exact list the desk left.
 *
 * Unlike the showroom orders list, NO range in the URL means ALL TIME (§3's
 * default), so a plain `/incoming-orders` shows everything and `from`/`to`
 * only appear once a period is picked. `from`/`to` are INCLUSIVE days on the
 * wire; the app's ranges end exclusive, so `to` gains a day here.
 */
export function parseIncomingListParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): IncomingListState {
  const from = params.get("from");
  const to = params.get("to");
  const page = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    statusGroup: oneOf(params.get("status"), INCOMING_STATUS_GROUPS),
    range:
      from && to ? { start: dateFromYmd(from), end: addDays(dateFromYmd(to), 1) } : null,
    paymentMethod: params.get("payment_method")?.trim() || null,
    paidFilter: oneOf(params.get("pay"), ["paid", "pending"] as const),
    orderType: oneOf(params.get("order_type"), ["clinic", "delivery"] as const),
    giftOnly: params.get("gift") === "1",
    ordering: params.get("ordering")?.trim() || DEFAULT_INCOMING_ORDERING,
    search: params.get("q")?.trim() ?? "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/**
 * The URL for a list state — only what differs from the defaults, so a plain
 * `/incoming-orders` stays plain and a filtered one reads as exactly its
 * filters.
 */
export function incomingListSearchParams(state: IncomingListState): string {
  const params = new URLSearchParams();

  if (state.statusGroup) params.set("status", state.statusGroup);
  if (state.range) {
    params.set("from", ymd(state.range.start));
    params.set("to", ymd(addDays(state.range.end, -1)));
  }
  if (state.paymentMethod) params.set("payment_method", state.paymentMethod);
  if (state.paidFilter) params.set("pay", state.paidFilter);
  if (state.orderType) params.set("order_type", state.orderType);
  if (state.giftOnly) params.set("gift", "1");
  if (state.ordering !== DEFAULT_INCOMING_ORDERING) {
    params.set("ordering", state.ordering);
  }
  if (state.search.trim() !== "") params.set("q", state.search.trim());
  if (state.page > 1) params.set("page", String(state.page));

  return params.toString();
}

/** The list state the current URL describes, re-read only when the URL changes. */
export function useIncomingUrlFilter(
  searchParams: ReadonlyURLSearchParams,
): IncomingListState {
  const key = searchParams.toString();
  return useMemo(() => parseIncomingListParams(new URLSearchParams(key)), [key]);
}
