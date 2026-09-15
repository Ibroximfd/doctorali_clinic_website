"use client";

import {
  ArrowDownLeft,
  ClipboardCheck,
  Gift,
  History,
  Package,
  ShoppingCart,
  Trash2,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { Product } from "@/features/products/types/product";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { FilterBar, FilterSelect } from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import type { DateRange } from "@/shared/domain/date-range";
import { addDays, shortDateTime } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import type { MovementFilter } from "../api/warehouse-api";
import { useMovementsQuery } from "../hooks/use-warehouse";
import {
  FILTERABLE_MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
  movementSourceLabel,
  movementTypeLabel,
  packagedBalanceLabel,
  packagedQuantityLabel,
  signedQuantityLabel,
  type StockMovement,
  type StockMovementType,
} from "../types/movement";
import { ProductSearchPicker } from "./product-search-picker";

const PAGE_SIZE = 20;

const ICON: Readonly<Record<StockMovementType, LucideIcon>> = {
  receipt: ArrowDownLeft,
  sale: ShoppingCart,
  sale_return: Undo2,
  gift: Gift,
  gift_return: Gift,
  write_off: Trash2,
  count_adjust: ClipboardCheck,
  receipt_cancel: Undo2,
  unknown: History,
};

/**
 * The append-only stock ledger.
 *
 * Each row carries the signed quantity AND the balance it left behind, so any
 * figure on the balances tab can be traced back to the movements that produced
 * it — which is the entire reason the ledger exists.
 *
 * The product filter is owned by the caller: the stock card's "Barcha
 * harakatlar" lands here with its product already chosen, and the chip that
 * says so has to survive the tab switch.
 */
export function MovementsList({
  product = null,
  onProductChange,
}: {
  /** Narrows the ledger to one product; null is the whole room. */
  product?: Product | null;
  /** Offered when the list may be narrowed by product from its own filter bar. */
  onProductChange?: (product: Product | null) => void;
}) {
  const [type, setType] = useState<StockMovementType | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  // The page is stored WITH the product it belongs to, so a product chosen
  // elsewhere (the stock card) resets it during render rather than leaving
  // page 3 of another product's history on screen.
  const productId = product?.id ?? null;
  const [pageState, setPageState] = useState({ productId, page: 1 });
  if (pageState.productId !== productId) setPageState({ productId, page: 1 });
  const page = pageState.page;
  const setPage = (next: number) => setPageState({ productId, page: next });

  const filter = useMemo<MovementFilter>(
    () => ({
      productId,
      type,
      dateFrom: range?.start ?? null,
      // The app's range end is exclusive; the API's `date_to` is inclusive.
      dateTo: range ? addDays(range.end, -1) : null,
    }),
    [productId, type, range],
  );
  const list = useMovementsQuery(filter, page);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <DateFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Harakat turi"
          value={type}
          onChange={(next) => {
            setType(next);
            setPage(1);
          }}
          options={FILTERABLE_MOVEMENT_TYPES.map((option) => ({
            value: option,
            label: MOVEMENT_TYPE_LABEL[option],
          }))}
          allLabel="Barcha harakatlar"
          width="w-[210px]"
        />
        {onProductChange && (
          <ProductSearchPicker
            label={product ? product.name : "Mahsulot bo'yicha"}
            onSelect={onProductChange}
            className={cn(
              "h-[38px] w-auto max-w-[260px]",
              product !== null &&
                "border-primary/35 bg-primary-soft/60 text-primary-dark hover:bg-primary-soft",
            )}
          />
        )}
      </FilterBar>

      {product && onProductChange && (
        <ActiveFilters
          filters={[
            {
              id: "product",
              label: product.name,
              icon: Package,
              emphasized: true,
              onClear: () => onProductChange(null),
            },
          ]}
        />
      )}

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending || !list.data ? (
        <ListSkeleton rows={8} height={56} />
      ) : list.data.results.length === 0 ? (
        <EmptyState
          icon={History}
          title="Harakat yo'q"
          message={
            product
              ? `${product.name} bo'yicha tanlangan davrda harakat yozilmagan.`
              : "Tanlangan filtr bo'yicha sklad harakati yo'q."
          }
        />
      ) : (
        <>
          <ul
            className="divide-border/60 border-border divide-y rounded-md border"
            style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
            aria-busy={list.isPlaceholderData}
          >
            {list.data.results.map((movement) => (
              <li key={movement.id}>
                <MovementRow movement={movement} hideProduct={product !== null} />
              </li>
            ))}
          </ul>
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.count}
            onPageChange={setPage}
            busy={list.isFetching}
          />
        </>
      )}
    </div>
  );
}

/**
 * One line of the ledger. The signed quantity is the point of the row, so it
 * is the largest thing on it — green for stock arriving, red for stock leaving
 * — followed by the balance it left behind.
 */
export function MovementRow({
  movement,
  hideProduct = false,
}: {
  movement: StockMovement;
  /** On a list that is already about one product the name is noise. */
  hideProduct?: boolean;
}) {
  const Icon = ICON[movement.type];
  const inbound = movement.quantity > 0;
  const packaged = packagedQuantityLabel(movement);
  const title =
    hideProduct || movement.productName === ""
      ? movementTypeLabel(movement)
      : movement.productName;
  const meta = [
    hideProduct || movement.productName === "" ? null : movementTypeLabel(movement),
    shortDateTime(movement.createdAt),
    movement.source ? movementSourceLabel(movement.source) : null,
    movement.createdByName !== "" ? movement.createdByName : null,
    movement.note !== "" ? movement.note : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          inbound ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-title-sm block truncate">{title}</span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {meta.join(" · ")}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            "text-title-sm tabular block",
            inbound ? "text-success" : "text-danger",
          )}
        >
          {signedQuantityLabel(movement)}
        </span>
        <span className="text-caption text-text-tertiary tabular block">
          {packaged !== "" ? `${packaged} · ` : ""}
          qoldiq {packagedBalanceLabel(movement)}
        </span>
      </span>
    </div>
  );
}
