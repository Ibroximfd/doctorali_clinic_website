"use client";

import { money } from "@/shared/lib/format/money";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import type { WarehouseSummary } from "../types/summary";

/**
 * The warehouse figures: how many products, how many units, what they are
 * worth, and how many need reordering.
 *
 * The two alert tiles are tappable and apply their own filter — a count of four
 * low-stock items is only useful if it leads straight to the four.
 */
export function WarehouseSummaryRow({
  summary,
  loading,
  lowActive,
  outActive,
  onToggleLow,
  onToggleOut,
}: {
  summary: WarehouseSummary | undefined;
  loading: boolean;
  lowActive: boolean;
  outActive: boolean;
  onToggleLow: () => void;
  onToggleOut: () => void;
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Tile label="SKU" value={String(summary.skuCount)} />
      <Tile label="Jami dona" value={String(summary.totalUnits)} tone="text-primary" />
      <Tile label="Qiymati" value={money.compact(summary.stockValue)} />
      <Tile
        label="Kam qolgan"
        value={String(summary.lowStockCount)}
        tone="text-warning"
        selected={lowActive}
        onClick={onToggleLow}
      />
      <Tile
        label="Tugagan"
        value={String(summary.outOfStockCount)}
        tone="text-danger"
        selected={outActive}
        onClick={onToggleOut}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  selected = false,
  onClick,
}: {
  label: string;
  value: string;
  tone?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-label-xs text-text-secondary block">{label}</span>
      <span className={cn("text-title-lg tabular mt-0.5 block", tone)}>{value}</span>
    </>
  );

  const shell = cn(
    "rounded-md border p-3 text-left transition-colors",
    selected ? "border-current bg-current/8" : "border-border bg-surface",
    selected && tone,
  );

  if (!onClick) return <div className={shell}>{content}</div>;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        shell,
        "hover:bg-surface-hover focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {content}
    </button>
  );
}
