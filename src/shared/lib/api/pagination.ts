/**
 * The DRF pagination envelope every list endpoint uses:
 *
 * ```json
 * { "count": 42, "next": "…?page=2", "previous": null, "results": [ … ] }
 * ```
 *
 * Two endpoints deliberately do NOT use it and have their own shapes:
 * `clients/?phone=` (a bare `{results: []}`) and `appointments/today/`.
 */
export interface Paginated<T> {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly T[];
}

/** Raw envelope as it arrives, before the item parser runs. */
export interface RawPaginated {
  readonly count?: number;
  readonly next?: string | null;
  readonly previous?: string | null;
  readonly results?: readonly unknown[];
}

/** Maps a raw envelope through an item parser. Missing keys degrade to empty. */
export function parsePaginated<T>(
  raw: RawPaginated | null | undefined,
  parseItem: (item: unknown) => T,
): Paginated<T> {
  const results = raw?.results ?? [];
  return {
    count: raw?.count ?? results.length,
    next: raw?.next ?? null,
    previous: raw?.previous ?? null,
    results: results.map(parseItem),
  };
}

export function emptyPage<T>(): Paginated<T> {
  return { count: 0, next: null, previous: null, results: [] };
}

/** True when another page exists. */
export function hasMore(page: Paginated<unknown>): boolean {
  return page.next !== null;
}

/**
 * The page number React Query's `getNextPageParam` should ask for, or
 * `undefined` when the list is exhausted.
 */
export function nextPageParam(
  page: Paginated<unknown>,
  currentPage: number,
): number | undefined {
  return page.next !== null ? currentPage + 1 : undefined;
}
