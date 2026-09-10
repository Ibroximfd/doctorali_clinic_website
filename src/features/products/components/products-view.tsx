"use client";

import { ImageOff, Leaf } from "lucide-react";
import { useMemo, useState } from "react";

import { useProductStatsQuery } from "@/features/statistics/hooks/use-dashboard";
import type { StatsQuery } from "@/features/statistics/api/statistics-api";
import type { ProductStat } from "@/features/statistics/types/statistics";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { PeriodSelector } from "@/shared/components/data-display/period-selector";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { StatPeriod } from "@/shared/domain/date-range";
import { formatUnits } from "@/shared/domain/packaging";
import { money } from "@/shared/lib/format/money";
import { resolveMediaUrl } from "@/shared/lib/media";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

const ORDERINGS = [
  { value: "-revenue", label: "Ko'p daromad" },
  { value: "revenue", label: "Kam daromad" },
  { value: "-units_sold", label: "Ko'p sotilgan" },
  { value: "units_sold", label: "Kam sotilgan" },
  { value: "name", label: "Nomi (A→Z)" },
  { value: "-name", label: "Nomi (Z→A)" },
] as const;

/** DRF's page size for the statistics lists. */
const PAGE_SIZE = 20;

/**
 * "Mahsulotlar" — the catalog seen through the period's sales, which is the
 * only view of it reception actually needs: what moved, and for how much.
 */
export function ProductsView() {
  const [period, setPeriod] = useState<StatPeriod>("monthly");
  const [ordering, setOrdering] = useState<string>("-revenue");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);
  const query = useMemo<StatsQuery>(() => ({ period }), [period]);

  const { data, error, isPending, isFetching, refetch } = useProductStatsQuery({
    query,
    ordering,
    search: debouncedSearch,
    page,
  });

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Mahsulot nomi…"
          className="w-full sm:w-[280px]"
        />
        <PeriodSelector value={period} onChange={reset(setPeriod)} granularity />
        <div className="flex-1" />
        <Select value={ordering} onValueChange={reset(setOrdering)}>
          <SelectTrigger className="w-[190px]" aria-label="Saralash">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDERINGS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && !data ? (
        <AppCard padded={false}>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </AppCard>
      ) : isPending || !data ? (
        <AppCard padded={false}>
          <ListSkeleton rows={8} height={72} />
        </AppCard>
      ) : data.results.length === 0 ? (
        <AppCard padded={false}>
          <EmptyState
            icon={Leaf}
            title="Mahsulot topilmadi"
            message="Filtrni o'zgartiring yoki qidiruvni tozalang."
          />
        </AppCard>
      ) : (
        <>
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            style={{ opacity: isFetching ? 0.6 : 1 }}
            aria-busy={isFetching}
          >
            {data.results.map((product) => (
              <ProductStatCard key={product.productId} product={product} />
            ))}
          </div>
          <AppCard padded={false}>
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={data.count}
              onPageChange={setPage}
              busy={isFetching}
              className="border-t-0"
            />
          </AppCard>
        </>
      )}
    </PageContainer>
  );
}

function ProductStatCard({ product }: { product: ProductStat }) {
  const image = resolveMediaUrl(product.imageUrl);

  return (
    <AppCard className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="bg-surface-alt flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-sm"
          aria-hidden
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary-origin catalog thumbnail
            <img src={image} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <ImageOff className="text-text-tertiary size-6" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-sm line-clamp-2">{product.name}</p>
          {product.currentPrice !== null && (
            <p className="text-caption text-text-tertiary tabular mt-0.5">
              {money.uzs(product.currentPrice)}
            </p>
          )}
        </div>
      </div>

      <div className="border-surface-alt flex items-end justify-between border-t pt-3">
        <div>
          <p className="text-caption text-text-tertiary">Sotilgan</p>
          <p className="text-title-sm tabular mt-0.5">
            {formatUnits(product.packaging, product.unitsSold)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-caption text-text-tertiary">Daromad</p>
          <p className="text-title tabular mt-0.5">{money.plain(product.revenue)}</p>
        </div>
      </div>
    </AppCard>
  );
}
