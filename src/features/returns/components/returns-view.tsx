"use client";

import { Pencil, ServerOff, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";

import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import { AppCard } from "@/shared/components/data-display/app-card";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { FilterBar } from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import type { DateRange } from "@/shared/domain/date-range";
import { ApiError } from "@/shared/lib/api/errors";
import { PAYMENT_TYPE_LABEL } from "@/shared/domain/payment-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { ReturnFilter } from "../api/returns-api";
import { useReturnsQuery } from "../hooks/use-returns";
import { returnTotalUnits, type OrderReturn } from "../types/order-return";
import { ReturnReasonDialog } from "./return-reason-dialog";

const PAGE_SIZE = 20;

/**
 * "Vazvratlar" — every return the clinic has made.
 *
 * The page exists for one question the order list cannot answer: how much money
 * left the till today and why. Each row therefore carries all three figures —
 * the value that came back, the part written off a debt, and the cash actually
 * paid out — because only the last one is missing from the drawer.
 *
 * It opens on the whole period rather than today: a return is looked up by the
 * order it belongs to far more often than by its own date.
 */
export function ReturnsView() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderReturn | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const filter = useMemo<ReturnFilter>(
    () => ({ range, search: debouncedSearch }),
    [range, debouncedSearch],
  );
  const list = useReturnsQuery(filter, page);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  /*
   * A 404 on the LIST endpoint is not "nothing matched" — the whole feature is
   * missing from the server this panel is talking to (it shipped on `develop`
   * before it reached production). "Ma'lumot topilmadi" sends the desk hunting
   * for a filter that is not the problem, so that one case says what it is.
   */
  const notDeployed = ApiError.is(list.error) && list.error.isNotFound;
  const rows = list.data?.results ?? [];
  const totals = rows.reduce(
    (sum, doc) => ({
      value: sum.value + doc.returnedValue,
      debt: sum.debt + doc.debtReduced,
      refund: sum.refund + doc.refundAmount,
    }),
    { value: 0, debt: 0, refund: 0 },
  );

  return (
    <PageContainer className="flex flex-col gap-4">
      <FilterBar>
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Buyurtma raqami yoki sabab…"
          className="w-full sm:w-[300px]"
        />
        <DateFilter value={range} onChange={reset(setRange)} />
      </FilterBar>

      <AppCard padded={false} className="overflow-hidden">
        {notDeployed ? (
          <EmptyState
            icon={ServerOff}
            title="Vazvrat bo'limi bu serverda yoqilmagan"
            message="Backendda qaytarish endpointi hali chiqarilmagan. Server yangilangach bu sahifa o'zi ishlay boshlaydi."
          />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={64} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title="Qaytarish yo'q"
            message="Tanlangan davrda mahsulot qaytarilmagan."
          />
        ) : (
          <>
            {/* The page's own question, answered above the rows: how much of
                this period's returns actually came out of the drawer. */}
            <div className="border-border bg-surface-alt/40 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b px-4 py-2.5">
              <Figure label="Qaytgan qiymat" value={money.plain(totals.value)} />
              <Figure label="Qarzdan" value={money.plain(totals.debt)} tone="warning" />
              <Figure
                label="Kassadan"
                value={money.plain(totals.refund)}
                tone="primary"
              />
              <span className="text-caption text-text-tertiary ml-auto">
                {list.data.count} ta qaytarish
              </span>
            </div>

            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {rows.map((doc, index) => (
                <li
                  key={doc.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <ReturnRow
                    doc={doc}
                    onOpenOrder={() => setDetailId(doc.orderId)}
                    onEditReason={() => setEditing(doc)}
                  />
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
      </AppCard>

      <OrderDetailDialog
        orderId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
      />

      <ReturnReasonDialog
        target={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </PageContainer>
  );
}

function ReturnRow({
  doc,
  onOpenOrder,
  onEditReason,
}: {
  doc: OrderReturn;
  onOpenOrder: () => void;
  onEditReason: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={onOpenOrder}
        className={cn(
          "min-w-0 flex-1 rounded-sm text-left transition-colors",
          "hover:bg-surface-hover focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-title-sm tabular truncate">{doc.orderNumber}</span>
          {doc.isFull && (
            <span className="bg-danger/12 text-danger rounded-full px-2 py-0.5 text-[10.5px] font-bold">
              To&rsquo;liq qaytarish
            </span>
          )}
        </span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {shortDateTime(doc.createdAt)} · {returnTotalUnits(doc)} dona
          {doc.createdByName !== "" && ` · ${doc.createdByName}`}
          {doc.reason !== "" && ` · ${doc.reason}`}
        </span>
      </button>

      <div className="shrink-0 text-right">
        <p className="text-title-sm tabular">{money.plain(doc.returnedValue)}</p>
        <p className="text-caption text-text-tertiary tabular">
          {doc.debtReduced > 0 && `${money.plain(doc.debtReduced)} qarzdan`}
          {doc.debtReduced > 0 && doc.refundAmount > 0 && " · "}
          {doc.refundAmount > 0 &&
            `${money.plain(doc.refundAmount)} ${
              doc.refundPaymentType
                ? PAYMENT_TYPE_LABEL[doc.refundPaymentType].toLowerCase()
                : "kassadan"
            }`}
          {doc.debtReduced === 0 && doc.refundAmount === 0 && "pul chiqmadi"}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onEditReason}
        aria-label="Sababni tahrirlash"
        className="text-text-tertiary shrink-0"
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "warning";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-caption text-text-tertiary">{label}</span>
      <span
        className={cn(
          "text-title-sm tabular",
          tone === "primary" && "text-primary-dark",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
    </span>
  );
}
