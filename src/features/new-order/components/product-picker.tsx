"use client";

import { PackageSearch, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProductsInfiniteQuery } from "@/features/products/hooks/use-products";
import { saleStep, type Product } from "@/features/products/types/product";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";
import { cn } from "@/shared/lib/utils";

import { ProductPickCard } from "./product-pick-card";

/**
 * The catalog, built for speed at the desk.
 *
 * Three things make it fast, and they are why this is not just a list:
 *  • the search box is always focused and reachable with `/` from anywhere on
 *    the page, so a product is one keystroke away;
 *  • ↑/↓ move a cursor through the results and Enter adds the highlighted one,
 *    so a whole basket can be built without touching the mouse;
 *  • a product already in the cart shows its stepper ON the card, so a quantity
 *    is corrected where the eye already is rather than down in the basket.
 */
export function ProductPicker({
  quantities,
  onAdd,
  onQuantityChange,
}: {
  /** product id → units currently in the cart. */
  quantities: Readonly<Record<string, number>>;
  /** `units` omitted means one sale step — a piece, or a box for boxed-only. */
  onAdd: (product: Product, units?: number) => void;
  onQuantityChange: (product: Product, quantity: number) => void;
}) {
  const [search, setSearch] = useState("");
  // The cursor is stored WITH the search it belongs to, so a new query resets
  // it during render instead of via an effect that fires a frame too late.
  const [cursorState, setCursorState] = useState({ search: "", index: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useProductsInfiniteQuery(debouncedSearch);

  const loadMoreRef = useInfiniteScroll({
    hasMore: hasNextPage,
    loading: isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
  });

  const products = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  if (cursorState.search !== debouncedSearch) {
    setCursorState({ search: debouncedSearch, index: 0 });
  }
  const cursor = cursorState.index;
  const setCursor = (updater: number | ((current: number) => number)) => {
    setCursorState((state) => ({
      search: state.search,
      index: typeof updater === "function" ? updater(state.index) : updater,
    }));
  };

  /** `/` focuses the search from anywhere that isn't already a text field. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (products.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, products.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const product = products[cursor];
        if (product) onAdd(product);
      } else if (event.key === "Escape" && search !== "") {
        event.preventDefault();
        setSearch("");
      }
    },
    [products, cursor, onAdd, search],
  );

  return (
    /*
     * `flex-1` is load-bearing: without it this box is sized by its content, so
     * the list's own `overflow-y-auto` never gets a bounded height and the whole
     * PAGE scrolls a little and stops instead of the catalogue scrolling.
     */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="text-text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={search}
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Mahsulot qidirish…  ( / )"
            aria-label="Mahsulot qidirish"
            className="h-[46px] pr-10 pl-11 text-base"
          />
          {search !== "" && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                inputRef.current?.focus();
              }}
              aria-label="Qidiruvni tozalash"
              className="text-text-tertiary hover:bg-surface-alt focus-visible:ring-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-caption text-text-tertiary">
        <kbd className="border-border bg-surface-alt rounded-xs border px-1">↑</kbd>{" "}
        <kbd className="border-border bg-surface-alt rounded-xs border px-1">↓</kbd>{" "}
        tanlash ·{" "}
        <kbd className="border-border bg-surface-alt rounded-xs border px-1">Enter</kbd>{" "}
        savatga qo&rsquo;shish
      </p>

      {/*
        The catalogue is shown at two very different widths — the full page and
        a column beside the basket — so the column count follows THIS box, not
        the window. A viewport breakpoint would put three cards in a 380px
        column on a wide screen.
      */}
      <div className="@container/catalog min-h-0 flex-1 overflow-y-auto pr-1">
        {error && products.length === 0 ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending ? (
          <div
            className="grid gap-3 @lg/catalog:grid-cols-2 @4xl/catalog:grid-cols-3"
            aria-hidden
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[196px] rounded-md" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Mahsulot topilmadi"
            message={
              search === "" ? "Katalog bo'sh." : "Boshqa nom bilan qidirib ko'ring."
            }
          />
        ) : (
          <>
            <div className="grid gap-3 @lg/catalog:grid-cols-2 @4xl/catalog:grid-cols-3">
              {products.map((product, index) => (
                <ProductPickCard
                  key={product.id}
                  product={product}
                  quantityInCart={quantities[product.id] ?? 0}
                  highlighted={index === cursor}
                  onAdd={(units) => onAdd(product, units)}
                  onQuantityChange={(quantity) =>
                    onQuantityChange(
                      product,
                      // A package-only product steps by the box, never by 1.
                      Math.max(
                        0,
                        Math.round(quantity / saleStep(product)) * saleStep(product),
                      ),
                    )
                  }
                />
              ))}
            </div>

            {/*
              The next page loads itself as the list is scrolled — a catalogue
              is browsed by scrolling, and a button at the bottom is a stop sign
              in the middle of that. It still renders as a fallback for a
              browser without IntersectionObserver, and as the thing the
              keyboard can reach.
            */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="mt-3 flex justify-center">
                <Button
                  variant="ghost"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-text-tertiary"
                >
                  {isFetchingNextPage ? (
                    <>
                      <span
                        className={cn(
                          "size-4 animate-spin rounded-full border-2",
                          "border-border border-t-primary",
                        )}
                        aria-hidden
                      />
                      Yuklanmoqda…
                    </>
                  ) : (
                    "Yana yuklash"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
