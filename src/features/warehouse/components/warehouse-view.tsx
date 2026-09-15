"use client";

import {
  ClipboardCheck,
  Download,
  MinusCircle,
  Package,
  PackagePlus,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Product } from "@/features/products/types/product";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { DateRange } from "@/shared/domain/date-range";
import { lastDay } from "@/shared/domain/date-range-label";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/lib/utils";

import {
  STOCK_ORDERINGS,
  STOCK_ORDERING_LABEL,
  type StockFilter,
  type StockOrdering,
} from "../api/warehouse-api";
import {
  useCreateCount,
  useStockQuery,
  useWarehouseExport,
  useWarehouseSummaryQuery,
} from "../hooks/use-warehouse";
import type { StockCount } from "../types/count";
import type { StockItem } from "../types/stock";
import { MovementsList } from "./movements-list";
import { ReceiptFormDialog } from "./receipt-form-dialog";
import { StockCountDialog } from "./stock-count-dialog";
import { StockDetailDialog, type StockDetailActions } from "./stock-detail-dialog";
import { StockTableHeader, StockTableRow } from "./stock-table-row";
import { CountsList, ReceiptsList, WriteOffsList } from "./warehouse-documents";
import { WarehouseExportDialog } from "./warehouse-export-dialog";
import { WarehouseSummaryRow } from "./warehouse-summary-row";
import { WriteOffFormDialog } from "./write-off-form-dialog";

const PAGE_SIZE = 20;

const TABS = ["stock", "receipts", "writeOffs", "counts", "movements"] as const;
type WarehouseTab = (typeof TABS)[number];

const TAB_LABEL: Readonly<Record<WarehouseTab, string>> = {
  stock: "Qoldiqlar",
  receipts: "Kirim",
  writeOffs: "Chiqim",
  counts: "Inventarizatsiya",
  movements: "Harakatlar",
};

/**
 * "Sklad" — the clinic's own stock room, not the central warehouse the client
 * app orders from.
 *
 * The design rule visible throughout: A BALANCE IS NEVER EDITED BY HAND. There
 * is no such button and no such endpoint — stock moves through a confirmed
 * document (goods in, write-off, stock count), which is what keeps the ledger
 * and the balances reconcilable.
 */
export function WarehouseView() {
  const [tab, setTab] = useState<WarehouseTab>("stock");

  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [ordering, setOrdering] = useState<StockOrdering>("name");
  const [page, setPage] = useState(1);

  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [activeCount, setActiveCount] = useState<StockCount | null>(null);
  // A document opened from a stock card starts with that product on it.
  const [receiptProduct, setReceiptProduct] = useState<Product | null>(null);
  const [writeOffProduct, setWriteOffProduct] = useState<Product | null>(null);
  // The ledger's product filter lives here so the stock card can set it and
  // switch tabs in one move.
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const filter = useMemo<StockFilter>(
    () => ({ search: debouncedSearch, lowStockOnly, outOfStockOnly, ordering }),
    [debouncedSearch, lowStockOnly, outOfStockOnly, ordering],
  );

  const summary = useWarehouseSummaryQuery();
  const stock = useStockQuery(filter, page);
  const exportWarehouse = useWarehouseExport();
  const createCount = useCreateCount();

  function toggle(setter: (value: boolean) => void, current: boolean) {
    setter(!current);
    setPage(1);
  }

  /** The export is a PERIOD REPORT — the range comes from the dialog. */
  function exportRange(range: DateRange) {
    exportWarehouse.mutate(
      { filter, dateFrom: range.start, dateTo: lastDay(range) },
      { onSuccess: () => setExportOpen(false) },
    );
  }

  async function startCount() {
    const count = await createCount.mutateAsync({});
    setActiveCount(count);
  }

  const detailActions: StockDetailActions = {
    onReceive(product) {
      setReceiptProduct(product);
      setReceiptOpen(true);
    },
    onWriteOff(product) {
      setWriteOffProduct(product);
      setWriteOffOpen(true);
    },
    onShowMovements(product) {
      setMovementsProduct(product);
      setTab("movements");
      setDetailItem(null);
    },
  };

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[280px] flex-1">
          <WarehouseSummaryRow
            summary={summary.data}
            loading={summary.isPending}
            lowActive={lowStockOnly}
            outActive={outOfStockOnly}
            onToggleLow={() => toggle(setLowStockOnly, lowStockOnly)}
            onToggleOut={() => toggle(setOutOfStockOnly, outOfStockOnly)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={exportWarehouse.isPending}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden />
            Excel
          </Button>
          <Button onClick={() => setReceiptOpen(true)}>
            <PackagePlus className="size-4" aria-hidden />
            Kirim
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Sklad bo'limlari"
          className="flex flex-wrap gap-1.5"
        >
          {TABS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={cn(
                "text-label-sm rounded-full border px-3 py-1.5 transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                tab === option
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              {TAB_LABEL[option]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          {tab === "writeOffs" && (
            <Button variant="outline" size="sm" onClick={() => setWriteOffOpen(true)}>
              <MinusCircle className="size-4" aria-hidden />
              Chiqim qilish
            </Button>
          )}
          {tab === "counts" && (
            <Button
              variant="outline"
              size="sm"
              disabled={createCount.isPending}
              onClick={() => void startCount()}
            >
              <ClipboardCheck className="size-4" aria-hidden />
              Inventarizatsiya boshlash
            </Button>
          )}
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Mahsulot…"
              className="w-full sm:w-[300px]"
            />
            <Select
              value={ordering}
              onValueChange={(value) => {
                setOrdering(value as StockOrdering);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-[38px] w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_ORDERINGS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {STOCK_ORDERING_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AppCard padded={false} className="overflow-hidden">
            {stock.error && !stock.data ? (
              <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
            ) : stock.isPending || !stock.data ? (
              <ListSkeleton rows={9} height={54} />
            ) : stock.data.results.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Mahsulot topilmadi"
                message="Qidiruv yoki filtrni o'zgartiring."
              />
            ) : (
              <>
                <StockTableHeader />
                <ul
                  style={{ opacity: stock.isPlaceholderData ? 0.6 : 1 }}
                  aria-busy={stock.isPlaceholderData}
                >
                  {stock.data.results.map((item, index) => (
                    <li
                      key={item.product.id}
                      className={index > 0 ? "border-surface-alt border-t" : undefined}
                    >
                      <StockTableRow item={item} onOpen={() => setDetailItem(item)} />
                    </li>
                  ))}
                </ul>
                <PaginationBar
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={stock.data.count}
                  onPageChange={setPage}
                  busy={stock.isFetching}
                />
              </>
            )}
          </AppCard>
        </>
      )}

      {tab === "receipts" && (
        <AppCard>
          <ReceiptsList />
        </AppCard>
      )}
      {tab === "writeOffs" && (
        <AppCard>
          <WriteOffsList />
        </AppCard>
      )}
      {tab === "counts" && (
        <AppCard>
          <CountsList onOpen={setActiveCount} />
        </AppCard>
      )}
      {tab === "movements" && (
        <AppCard>
          <MovementsList
            product={movementsProduct}
            onProductChange={setMovementsProduct}
          />
        </AppCard>
      )}

      <StockDetailDialog
        item={detailItem}
        open={detailItem !== null}
        onOpenChange={(open) => !open && setDetailItem(null)}
        actions={detailActions}
      />
      <WarehouseExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        busy={exportWarehouse.isPending}
        onExport={exportRange}
      />
      <ReceiptFormDialog
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) setReceiptProduct(null);
        }}
        initialProduct={receiptProduct}
      />
      <WriteOffFormDialog
        open={writeOffOpen}
        onOpenChange={(open) => {
          setWriteOffOpen(open);
          if (!open) setWriteOffProduct(null);
        }}
        initialProduct={writeOffProduct}
      />
      <StockCountDialog
        count={activeCount}
        open={activeCount !== null}
        onOpenChange={(open) => !open && setActiveCount(null)}
      />
    </PageContainer>
  );
}
