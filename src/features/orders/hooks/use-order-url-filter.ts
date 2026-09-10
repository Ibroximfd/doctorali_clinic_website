"use client";

import { useMemo } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";

import type { DateRange, StatPeriod } from "@/shared/domain/date-range";
import { STAT_PERIODS } from "@/shared/domain/date-range";
import type { PaymentType } from "@/shared/domain/payment-type";
import { PAYMENT_TYPES } from "@/shared/domain/payment-type";
import { addDays, dateFromYmd } from "@/shared/lib/format/date";

/**
 * Reads `/orders?period=&from=&to=&payment_type=` — the filtered link a
 * dashboard card's "Barchasi" produces.
 *
 * This is what lets the desk drill from a filtered statistics figure into the
 * orders behind it without the filter resetting to today. `from`/`to` are
 * INCLUSIVE days on the wire; the app's ranges are exclusive-end, so `to` gains
 * a day here.
 */
export function useOrderUrlFilter(searchParams: ReadonlyURLSearchParams): {
  period: StatPeriod | null;
  range: DateRange | null;
  paymentType: PaymentType | null;
} {
  const period = searchParams.get("period");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const paymentType = searchParams.get("payment_type");

  return useMemo(() => {
    const parsedPeriod = STAT_PERIODS.includes(period as StatPeriod)
      ? (period as StatPeriod)
      : null;

    const range =
      from && to ? { start: dateFromYmd(from), end: addDays(dateFromYmd(to), 1) } : null;

    return {
      period: parsedPeriod,
      range,
      paymentType: PAYMENT_TYPES.includes(paymentType as PaymentType)
        ? (paymentType as PaymentType)
        : null,
    };
  }, [period, from, to, paymentType]);
}
