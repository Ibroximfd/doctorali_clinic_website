import { endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import {
  parseFollowupEntry,
  parseFollowupHistoryEntry,
  parseFollowupInfo,
  type FollowupEntry,
  type FollowupHistoryEntry,
  type FollowupInfo,
  type FollowupPeriod,
  type FollowupStatus,
} from "../types/followup";

export interface FollowupFilter {
  readonly period: FollowupPeriod;
  /** A free day-range; when set it OVERRIDES `period` on the server. */
  readonly daysFrom?: number | null;
  readonly daysTo?: number | null;
  readonly doctorId?: string | null;
  readonly status?: FollowupStatus | null;
  readonly search?: string;
  readonly ordering: string;
}

/** True when a free day-range is active (it takes precedence over the preset). */
export function usesCustomRange(filter: FollowupFilter): boolean {
  return (
    (filter.daysFrom !== null && filter.daysFrom !== undefined) ||
    (filter.daysTo !== null && filter.daysTo !== undefined)
  );
}

export function followupFilterQuery(filter: FollowupFilter): Query {
  return {
    ...(usesCustomRange(filter)
      ? {
          ...(filter.daysFrom !== null && filter.daysFrom !== undefined
            ? { days_from: filter.daysFrom }
            : {}),
          ...(filter.daysTo !== null && filter.daysTo !== undefined
            ? { days_to: filter.daysTo }
            : {}),
        }
      : { period: filter.period }),
    ordering: filter.ordering,
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
  };
}

export function followupFilterKey(filter: FollowupFilter): readonly unknown[] {
  return [
    filter.period,
    filter.daysFrom ?? null,
    filter.daysTo ?? null,
    filter.doctorId ?? null,
    filter.status ?? null,
    filter.search?.trim() ?? "",
    filter.ordering,
  ];
}

export function fetchFollowups(input: {
  filter: FollowupFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<FollowupEntry>> {
  return http
    .get<unknown>(endpoints.followups, {
      query: { page: input.page ?? 1, ...followupFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseFollowupEntry));
}

/** `POST followups/{clientId}/contact/` → the updated last-contact state. */
export function recordContact(input: {
  clientId: number;
  status: FollowupStatus;
  note?: string;
  orderId?: string;
}): Promise<FollowupInfo> {
  return http
    .post<Record<string, unknown>>(endpoints.followupContact(input.clientId), {
      json: {
        status: input.status,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.orderId ? { order_id: input.orderId } : {}),
      },
    })
    .then((data) => {
      // Tolerate a `{ followup: {…} }` envelope as well as a bare object.
      const nested = data?.followup;
      return parseFollowupInfo(
        typeof nested === "object" && nested !== null ? nested : data,
      );
    });
}

export function fetchFollowupHistory(input: {
  clientId: number;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<FollowupHistoryEntry>> {
  return http
    .get<unknown>(endpoints.followupHistory(input.clientId), {
      query: { page: input.page ?? 1 },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseFollowupHistoryEntry));
}
