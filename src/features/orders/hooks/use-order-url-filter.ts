"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { DateRange } from "@/shared/domain/date-range";
import { STAT_PERIODS, isSameRange, resolveRange } from "@/shared/domain/date-range";
import type { OrderType } from "@/shared/domain/order-type";
import type { PaymentType } from "@/shared/domain/payment-type";
import { PAYMENT_TYPES } from "@/shared/domain/payment-type";
import { addDays, dateFromYmd, ymd } from "@/shared/lib/format/date";

import { DEBT_STATUS_LABEL } from "@/features/debts/types/debt";

/** What the desk actually asks a debt list: everything, or only the trouble. */
export const DEBT_FILTERS = [
  { value: "any", label: "Qarzli buyurtmalar" },
  { value: "open", label: `Qarz · ${DEBT_STATUS_LABEL.open}` },
  { value: "partial", label: `Qarz · ${DEBT_STATUS_LABEL.partial}` },
  { value: "paid", label: `Qarz · ${DEBT_STATUS_LABEL.paid}` },
  { value: "none", label: "Qarzsiz" },
] as const;
export type DebtFilterValue = (typeof DEBT_FILTERS)[number]["value"];

export const ORDERINGS = [
  { value: "-created_at", label: "Avval yangilari" },
  { value: "created_at", label: "Avval eskilari" },
  { value: "-total_amount", label: "Katta summa" },
  { value: "total_amount", label: "Kichik summa" },
] as const;
export type OrderingValue = (typeof ORDERINGS)[number]["value"];

const DEFAULT_ORDERING: OrderingValue = "-created_at";

/** Everything that decides which orders are on screen, and which page of them. */
export interface OrderListState {
  readonly range: DateRange | null;
  readonly paymentType: PaymentType | null;
  readonly orderType: OrderType | null;
  readonly doctorId: string | null;
  readonly debtFilter: DebtFilterValue | null;
  readonly ordering: OrderingValue;
  readonly search: string;
  readonly page: number;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Reads the list's state back out of the URL.
 *
 * The URL is the list's memory. Reception opens an order's client from a row,
 * reads the card, presses Back — and used to land on today's first page, the
 * filter they had built gone. With the state in the query string, Back returns
 * to the exact list they left, and a filtered view can be bookmarked or sent.
 *
 * `from`/`to` are INCLUSIVE days on the wire; the app's ranges end exclusive,
 * so `to` gains a day here. `all=1` says "no date limit" explicitly, because an
 * absent range means the default — today — and the two must not be confused.
 * `period=` is what a dashboard card's "Barchasi" link carries.
 */
export function parseOrderListParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): OrderListState {
  const from = params.get("from");
  const to = params.get("to");
  const period = oneOf(params.get("period"), STAT_PERIODS);

  let range: DateRange | null;
  if (params.get("all") === "1") range = null;
  else if (from && to)
    range = { start: dateFromYmd(from), end: addDays(dateFromYmd(to), 1) };
  else if (period && period !== "custom") range = resolveRange(period);
  else range = resolveRange("daily");

  const page = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    range,
    paymentType: oneOf(params.get("payment_type"), PAYMENT_TYPES),
    orderType: oneOf(params.get("order_type"), ["clinic", "delivery"] as const),
    doctorId: params.get("doctor_id")?.trim() || null,
    debtFilter: oneOf(
      params.get("debt"),
      DEBT_FILTERS.map((item) => item.value),
    ),
    ordering:
      oneOf(
        params.get("ordering"),
        ORDERINGS.map((item) => item.value),
      ) ?? DEFAULT_ORDERING,
    search: params.get("q")?.trim() ?? "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/**
 * The URL for a list state — only what differs from the defaults, so a plain
 * `/orders` stays plain and a filtered one reads as exactly its filters.
 */
export function orderListSearchParams(state: OrderListState): string {
  const params = new URLSearchParams();

  if (state.range === null) params.set("all", "1");
  else if (!isSameRange(state.range, resolveRange("daily"))) {
    params.set("from", ymd(state.range.start));
    params.set("to", ymd(addDays(state.range.end, -1)));
  }
  if (state.paymentType) params.set("payment_type", state.paymentType);
  if (state.orderType) params.set("order_type", state.orderType);
  if (state.doctorId) params.set("doctor_id", state.doctorId);
  if (state.debtFilter) params.set("debt", state.debtFilter);
  if (state.ordering !== DEFAULT_ORDERING) params.set("ordering", state.ordering);
  if (state.search.trim() !== "") params.set("q", state.search.trim());
  if (state.page > 1) params.set("page", String(state.page));

  return params.toString();
}

/** The list state the current URL describes, re-read only when the URL changes. */
export function useOrderUrlFilter(searchParams: ReadonlyURLSearchParams): OrderListState {
  const key = searchParams.toString();
  return useMemo(() => parseOrderListParams(new URLSearchParams(key)), [key]);
}
