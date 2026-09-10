import { endpoints } from "@/shared/lib/api/endpoints";
import { http } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import { parseProduct, type Product } from "../types/product";

/**
 * `GET products/?search=&page=&ordering=`.
 *
 * `ordering` takes backend field names: `title`, `-title`, `cost`, `-cost`,
 * `order_count`, `-order_count`, `created_at`, `-created_at`.
 */
export function fetchProducts(input: {
  search?: string;
  page?: number;
  ordering?: string;
  signal?: AbortSignal;
}): Promise<Paginated<Product>> {
  return http
    .get<unknown>(endpoints.products, {
      query: {
        page: input.page ?? 1,
        search: input.search,
        ordering: input.ordering,
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseProduct));
}

/** Enough for a few thousand products at the API's page size. */
const MAX_LOOKUP_PAGES = 40;

/**
 * Resolves whole catalog products for `ids`.
 *
 * There is no `products/{id}/`, so this pages through the list — used when an
 * existing order has to be loaded back into the cart, which needs REAL
 * products: prices, packaging and stock, none of which travel on an order line.
 * Ids no longer in the catalog are simply absent from the result.
 */
export async function fetchProductsByIds(
  ids: Iterable<string>,
  signal?: AbortSignal,
): Promise<Map<string, Product>> {
  const wanted = new Set(ids);
  const found = new Map<string, Product>();
  if (wanted.size === 0) return found;

  for (let page = 1; page <= MAX_LOOKUP_PAGES; page++) {
    const result = await fetchProducts({ page, signal });
    for (const product of result.results) {
      if (wanted.has(product.id)) found.set(product.id, product);
    }
    if (found.size === wanted.size || result.next === null) break;
  }
  return found;
}
