"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { nextPageParam } from "@/shared/lib/api/pagination";

import { fetchProducts, fetchProductsByIds } from "../api/products-api";

export const productKeys = {
  all: ["products"] as const,
  list: (search: string, ordering: string) =>
    [...productKeys.all, "list", search, ordering] as const,
  byIds: (ids: readonly string[]) =>
    [...productKeys.all, "byIds", [...ids].sort().join(",")] as const,
};

/**
 * The catalog for the New Order picker, paged as reception scrolls.
 *
 * `staleTime` is short because stock moves under the desk all day — two tills
 * selling the last box at once is the race this exists to lose gracefully.
 */
export function useProductsInfiniteQuery(search: string, ordering = "title") {
  return useInfiniteQuery({
    queryKey: productKeys.list(search, ordering),
    queryFn: ({ pageParam, signal }) =>
      fetchProducts({ search, page: pageParam, ordering, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => nextPageParam(lastPage, allPages.length),
    staleTime: 20_000,
  });
}

/** Whole catalog products behind an existing order's lines. */
export function useProductsByIdsQuery(ids: readonly string[], enabled = true) {
  return useQuery({
    queryKey: productKeys.byIds(ids),
    queryFn: ({ signal }) => fetchProductsByIds(ids, signal),
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
  });
}
