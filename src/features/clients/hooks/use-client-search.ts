"use client";

import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

import { isSearchable, searchClients } from "../api/clients-api";

export const clientKeys = {
  all: ["clients"] as const,
  search: (query: string) => [...clientKeys.all, "search", query] as const,
};

/**
 * The client typeahead.
 *
 * Debounced here rather than at the call site so every picker in the app waits
 * the same amount, and short queries never reach the network at all.
 */
export function useClientSearchQuery(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 300);
  const enabled = isSearchable(query);

  return useQuery({
    queryKey: clientKeys.search(query),
    queryFn: ({ signal }) => searchClients({ query, signal }),
    enabled,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}
