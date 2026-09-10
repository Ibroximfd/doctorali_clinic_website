import { endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  parseOutstanding,
  parsePayout,
  parseWeekDetail,
  type OutstandingResponse,
  type Payout,
  type PayoutStatus,
  type WeekDetail,
} from "../types/payout";

/** `GET payouts/outstanding/` — doctors with unpaid, completed weeks. */
export function fetchOutstanding(
  doctorId?: string | null,
  signal?: AbortSignal,
): Promise<OutstandingResponse> {
  return http
    .get<unknown>(endpoints.payoutsOutstanding, {
      query: doctorId ? { doctor_id: doctorId } : undefined,
      signal,
    })
    .then(parseOutstanding);
}

/**
 * `GET payouts/week/` — the day → order → product breakdown for one
 * doctor-week, checked before the week is cashed out.
 */
export function fetchWeekDetail(input: {
  doctorId: string;
  weekStart: string;
  signal?: AbortSignal;
}): Promise<WeekDetail> {
  return http
    .get<unknown>(endpoints.payoutsWeek, {
      query: { doctor_id: input.doctorId, week_start: input.weekStart },
      signal: input.signal,
    })
    .then(parseWeekDetail);
}

/** `POST payouts/pay/` — marks a completed week paid. */
export function payWeek(input: {
  doctorId: string;
  weekStart: string;
  note?: string;
}): Promise<Payout> {
  return http
    .post<unknown>(endpoints.payoutsPay, {
      json: {
        doctor_id: Number.parseInt(input.doctorId, 10),
        week_start: input.weekStart,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    })
    .then(parsePayout);
}

export interface PayoutFilter {
  readonly doctorId?: string | null;
  /** `week_start` window (inclusive). */
  readonly dateFrom?: TashkentDate | null;
  readonly dateTo?: TashkentDate | null;
  readonly status?: PayoutStatus | null;
}

export function payoutFilterQuery(filter: PayoutFilter): Query {
  return {
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.dateFrom ? { date_from: ymd(filter.dateFrom) } : {}),
    ...(filter.dateTo ? { date_to: ymd(filter.dateTo) } : {}),
    ...(filter.status && filter.status !== "unknown" ? { status: filter.status } : {}),
  };
}

export function payoutFilterKey(filter: PayoutFilter): readonly unknown[] {
  return [
    filter.doctorId ?? null,
    filter.dateFrom?.getTime() ?? null,
    filter.dateTo?.getTime() ?? null,
    filter.status ?? null,
  ];
}

export function fetchPayouts(input: {
  filter: PayoutFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Payout>> {
  return http
    .get<unknown>(endpoints.payouts, {
      query: { page: input.page ?? 1, ...payoutFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parsePayout));
}

/** `GET payouts/{id}/` — one payout with its `days` breakdown. */
export function fetchPayout(id: string, signal?: AbortSignal): Promise<Payout> {
  return http.get<unknown>(endpoints.payout(id), { signal }).then(parsePayout);
}

/** `POST payouts/{id}/cancel/` — its week becomes outstanding again. */
export function cancelPayout(id: string, reason?: string): Promise<Payout> {
  return http
    .post<unknown>(endpoints.payoutCancel(id), {
      json: reason?.trim() ? { reason: reason.trim() } : {},
    })
    .then(parsePayout);
}
