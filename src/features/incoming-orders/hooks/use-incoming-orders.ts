"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchIncomingFilterOptions,
  fetchIncomingOrderDetail,
  fetchIncomingOrders,
  fetchIncomingOrdersStats,
  incomingFilterKey,
  type IncomingOrdersFilter,
} from "../api/incoming-orders-api";

export const incomingOrderKeys = {
  all: ["incoming-orders"] as const,
  list: (filter: IncomingOrdersFilter, page: number) =>
    [...incomingOrderKeys.all, "list", ...incomingFilterKey(filter), page] as const,
  stats: (filter: IncomingOrdersFilter) =>
    [...incomingOrderKeys.all, "stats", ...incomingFilterKey(filter)] as const,
  options: () => [...incomingOrderKeys.all, "options"] as const,
  detail: (id: string) => [...incomingOrderKeys.all, "detail", id] as const,
};

export function useIncomingOrdersQuery(filter: IncomingOrdersFilter, page: number) {
  return useQuery({
    queryKey: incomingOrderKeys.list(filter, page),
    queryFn: ({ signal }) => fetchIncomingOrders({ filter, page, signal }),
    placeholderData: (previous) => previous,
  });
}

/**
 * The KPI strip's numbers, asked with the SAME filter as the list (§6): the
 * server's own totals, never a sum of the visible page.
 */
export function useIncomingOrdersStatsQuery(filter: IncomingOrdersFilter) {
  return useQuery({
    queryKey: incomingOrderKeys.stats(filter),
    queryFn: ({ signal }) => fetchIncomingOrdersStats(filter, signal),
    placeholderData: (previous) => previous,
  });
}

/**
 * Dropdown dictionaries (§7). Effectively static per session, so they are kept
 * for an hour — and a failure here leaves the dropdowns on their fallbacks,
 * never a dead page.
 */
export function useIncomingFilterOptionsQuery() {
  return useQuery({
    queryKey: incomingOrderKeys.options(),
    queryFn: ({ signal }) => fetchIncomingFilterOptions(signal),
    staleTime: 60 * 60 * 1000,
  });
}

export function useIncomingOrderDetailQuery(id: string | null) {
  return useQuery({
    queryKey: incomingOrderKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchIncomingOrderDetail(id as string, signal),
    enabled: id !== null,
  });
}
