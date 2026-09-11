"use client";

import { ImageOff, Leaf } from "lucide-react";
import { useState } from "react";

import { AppCard } from "@/shared/components/data-display/app-card";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { formatUnits } from "@/shared/domain/packaging";
import { money } from "@/shared/lib/format/money";
import { MediaImage } from "@/shared/components/ui/media-image";
import { cn } from "@/shared/lib/utils";

import type { ProductStat } from "../types/statistics";

type SortKey = "revenue" | "units";

const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

/** The ranking, sortable by money or by pieces — the two questions asked of it. */
export function TopProductsCard({ products }: { products: readonly ProductStat[] }) {
  const [sort, setSort] = useState<SortKey>("revenue");

  const rows = [...products].sort((a, b) =>
    sort === "revenue" ? b.revenue - a.revenue : b.unitsSold - a.unitsSold,
  );
  const max = rows.reduce(
    (m, p) => Math.max(m, sort === "revenue" ? p.revenue : p.unitsSold),
    0,
  );

  return (
    <AppCard className="flex flex-col">
      <SectionHeader
        icon={Leaf}
        title="Eng ko'p sotilganlar"
        subtitle="Mahsulotlar reytingi"
        actions={
          <div
            role="tablist"
            aria-label="Saralash"
            className="border-border bg-surface-alt inline-flex gap-1 rounded-md border p-1"
          >
            {(["revenue", "units"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={sort === key}
                onClick={() => setSort(key)}
                className={cn(
                  "text-label-sm rounded-sm px-3 py-1.5 transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  sort === key
                    ? "bg-surface text-primary-dark shadow-xs"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {key === "revenue" ? "Summa" : "Dona"}
              </button>
            ))}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Ma'lumot yo'q"
          message="Bu davrda mahsulot sotilmagan."
          icon={Leaf}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.slice(0, 6).map((product, index) => (
            <ProductRow
              key={product.productId}
              product={product}
              sort={sort}
              max={max}
              color={BAR_COLORS[index % BAR_COLORS.length]}
            />
          ))}
        </ul>
      )}
    </AppCard>
  );
}

function ProductRow({
  product,
  sort,
  max,
  color,
}: {
  product: ProductStat;
  sort: SortKey;
  max: number;
  color: string;
}) {
  const value = sort === "revenue" ? product.revenue : product.unitsSold;
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;

  return (
    <li className="flex items-center gap-3">
      <span
        className="bg-surface-alt flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm"
        aria-hidden
      >
        {product.imageUrl ? (
          <MediaImage
            src={product.imageUrl}
            alt=""
            size={40}
            className="size-full object-cover"
          />
        ) : (
          <ImageOff className="text-text-tertiary size-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-title-sm truncate">{product.name}</span>
          <span className="text-caption text-text-tertiary shrink-0">
            {formatUnits(product.packaging, product.unitsSold)}
          </span>
          <span className="text-title-sm tabular ml-auto shrink-0">
            {sort === "revenue" ? money.plain(product.revenue) : product.unitsSold}
          </span>
        </div>
        <div className="bg-surface-alt mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", color)}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </li>
  );
}
