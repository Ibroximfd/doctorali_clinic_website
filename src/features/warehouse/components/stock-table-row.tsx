"use client";

import { formatProductUnits } from "@/features/products/types/product";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { shortDate } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { StockItem } from "../types/stock";
import { StockLevelBadge } from "./stock-level-badge";

/** Column geometry, shared by the header and the rows so they can't drift apart. */
export const STOCK_GRID =
  "grid grid-cols-[minmax(0,1fr)_140px_64px_110px_88px] items-center gap-3 px-4";

export function StockTableHeader() {
  return (
    <div className={cn(STOCK_GRID, "border-border bg-surface-alt/40 border-b py-2.5")}>
      {(
        [
          ["Mahsulot", "text-left"],
          ["Qoldiq", "text-right"],
          ["Min", "text-right"],
          ["Holat", "text-right"],
          ["Oxirgi", "text-right"],
        ] as const
      ).map(([label, align]) => (
        <span
          key={label}
          className={cn("text-label-xs text-text-tertiary uppercase", align)}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * One balance row.
 *
 * Tinted by stock state rather than only badged: a shelf that has run out
 * should be visible while scrolling past, not only when read.
 */
export function StockTableRow({ item, onOpen }: { item: StockItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        STOCK_GRID,
        "hover:bg-surface-hover w-full py-2.5 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        item.isOut ? "bg-danger/6" : item.isLow ? "bg-warning/6" : undefined,
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <AppAvatar name={item.product.name} imageUrl={item.product.imageUrl} size={30} />
        <span className="min-w-0">
          <span className="text-body-sm block truncate">{item.product.name}</span>
          {item.product.category !== "" && (
            <span className="text-caption text-text-tertiary block truncate">
              {item.product.category}
            </span>
          )}
        </span>
      </span>

      {/* Boxed products read the way the shelf looks — "4 karobka + 6 dona" —
          so the ×9 misread has nowhere left to happen. */}
      <span className="text-body-sm text-text-secondary tabular text-right">
        {item.trackStock ? formatProductUnits(item.product, item.quantity) : "∞"}
      </span>

      <span className="text-body-sm text-text-secondary tabular text-right">
        {item.minQuantity}
      </span>

      <span className="flex justify-end">
        <StockLevelBadge
          quantity={item.quantity}
          minQuantity={item.minQuantity}
          trackStock={item.trackStock}
          showUnits={false}
        />
      </span>

      <span
        className="text-body-sm text-text-secondary tabular text-right"
        title={item.stockValue > 0 ? money.uzs(item.stockValue) : undefined}
      >
        {item.lastMovementAt === null ? "—" : shortDate(item.lastMovementAt)}
      </span>
    </button>
  );
}
