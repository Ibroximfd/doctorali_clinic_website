"use client";

import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { useState } from "react";

import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { ReasonDialog } from "@/shared/components/feedback/reason-dialog";
import { Button } from "@/shared/components/ui/button";
import { shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

import {
  useCancelReceipt,
  useCancelWriteOff,
  useConfirmReceipt,
  useConfirmWriteOff,
  useCountsQuery,
  useReceiptsQuery,
  useWriteOffsQuery,
} from "../hooks/use-warehouse";
import { countedCount, uncountedCount, type StockCount } from "../types/count";
import { receiptTotalUnits, type StockReceipt } from "../types/receipt";
import { isDocEditable } from "../types/stock";
import {
  WRITE_OFF_REASON_LABEL,
  writeOffTotalUnits,
  type StockWriteOff,
} from "../types/write-off";
import { DocStatusChip } from "./doc-status-chip";

const PAGE_SIZE = 20;

/** Goods-in documents, with confirm/cancel where the status allows it. */
export function ReceiptsList() {
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<StockReceipt | null>(null);
  const list = useReceiptsQuery(page);
  const confirm = useConfirmReceipt();
  const cancel = useCancelReceipt();

  return (
    <>
      <DocumentList
        query={list}
        page={page}
        onPageChange={setPage}
        emptyTitle="Kirim hujjati yo'q"
        rowKey={(receipt) => receipt.id}
        renderRow={(receipt) => (
          <DocumentRow
            number={receipt.number || receipt.id}
            status={receipt.status}
            subtitle={[
              shortDateTime(receipt.createdAt),
              receipt.supplier,
              receipt.createdByName,
            ]
              .filter((part) => part !== "")
              .join(" · ")}
            amount={`${receiptTotalUnits(receipt)} dona`}
            secondary={receipt.totalCost > 0 ? money.plain(receipt.totalCost) : undefined}
            actions={
              <>
                {isDocEditable(receipt.status) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirm.isPending}
                    onClick={() => void confirm.mutateAsync(receipt.id)}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Tasdiqlash
                  </Button>
                )}
                {receipt.status === "confirmed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setCancelling(receipt)}
                  >
                    <XCircle className="size-3.5" aria-hidden />
                    Bekor qilish
                  </Button>
                )}
              </>
            }
          />
        )}
      />

      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        busy={cancel.isPending}
        title="Kirimni bekor qilish"
        description="Kirim bekor qilinsa, mahsulot qoldiqdan qaytariladi. Agar u allaqachon sotilgan bo'lsa, server rad etadi."
        confirmLabel="Bekor qilish"
        onConfirm={(reason) => {
          if (cancelling) void cancel.mutateAsync({ id: cancelling.id, reason });
          setCancelling(null);
        }}
      />
    </>
  );
}

export function WriteOffsList() {
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<StockWriteOff | null>(null);
  const list = useWriteOffsQuery(page);
  const confirm = useConfirmWriteOff();
  const cancel = useCancelWriteOff();

  return (
    <>
      <DocumentList
        query={list}
        page={page}
        onPageChange={setPage}
        emptyTitle="Chiqim hujjati yo'q"
        rowKey={(doc) => doc.id}
        renderRow={(doc) => (
          <DocumentRow
            number={doc.number || doc.id}
            status={doc.status}
            subtitle={[
              shortDateTime(doc.createdAt),
              WRITE_OFF_REASON_LABEL[doc.reason],
              doc.note,
            ]
              .filter((part) => part !== "")
              .join(" · ")}
            amount={`${writeOffTotalUnits(doc)} dona`}
            secondary={doc.totalValue > 0 ? money.plain(doc.totalValue) : undefined}
            actions={
              <>
                {isDocEditable(doc.status) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirm.isPending}
                    onClick={() => void confirm.mutateAsync(doc.id)}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Tasdiqlash
                  </Button>
                )}
                {doc.status === "confirmed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setCancelling(doc)}
                  >
                    <XCircle className="size-3.5" aria-hidden />
                    Bekor qilish
                  </Button>
                )}
              </>
            }
          />
        )}
      />

      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        busy={cancel.isPending}
        title="Chiqimni bekor qilish"
        description="Bekor qilinsa, chiqim qilingan dona qoldiqqa qaytariladi."
        confirmLabel="Bekor qilish"
        onConfirm={(reason) => {
          if (cancelling) void cancel.mutateAsync({ id: cancelling.id, reason });
          setCancelling(null);
        }}
      />
    </>
  );
}

export function CountsList({ onOpen }: { onOpen: (count: StockCount) => void }) {
  const [page, setPage] = useState(1);
  const list = useCountsQuery(page);

  return (
    <DocumentList
      query={list}
      page={page}
      onPageChange={setPage}
      emptyTitle="Inventarizatsiya yo'q"
      rowKey={(count) => count.id}
      renderRow={(count) => (
        <DocumentRow
          number={count.number || count.id}
          status={count.status}
          subtitle={[shortDateTime(count.createdAt), count.createdByName, count.note]
            .filter((part) => part !== "")
            .join(" · ")}
          amount={`${countedCount(count)} / ${count.lines.length}`}
          secondary={
            uncountedCount(count) > 0
              ? `${uncountedCount(count)} ta sanalmagan`
              : `−${count.totalShortage} / +${count.totalSurplus}`
          }
          actions={
            isDocEditable(count.status) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpen(count)}
              >
                Davom ettirish
              </Button>
            ) : null
          }
        />
      )}
    />
  );
}

/** The shell all three document lists share. */
function DocumentList<T>({
  query,
  page,
  onPageChange,
  emptyTitle,
  renderRow,
  rowKey,
}: {
  query: {
    data?: { count: number; results: readonly T[] };
    error: unknown;
    isPending: boolean;
    /** True only while the PREVIOUS page's rows are still on screen. */
    isPlaceholderData: boolean;
    refetch: () => unknown;
  };
  page: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  renderRow: (item: T) => React.ReactNode;
  rowKey: (item: T) => string;
}) {
  if (query.error && !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending || !query.data) return <ListSkeleton rows={6} height={62} />;
  if (query.data.results.length === 0) {
    return <EmptyState icon={FileText} title={emptyTitle} />;
  }

  return (
    <div className="flex flex-col">
      <ul
        className="divide-border/60 border-border divide-y rounded-md border"
        style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}
        aria-busy={query.isPlaceholderData}
      >
        {query.data.results.map((item) => (
          <li key={rowKey(item)}>{renderRow(item)}</li>
        ))}
      </ul>
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data.count}
        onPageChange={onPageChange}
        busy={query.isPlaceholderData}
      />
    </div>
  );
}

function DocumentRow({
  number,
  status,
  subtitle,
  amount,
  secondary,
  actions,
}: {
  number: string;
  status: Parameters<typeof DocStatusChip>[0]["status"];
  subtitle: string;
  amount: string;
  secondary?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-title-sm tabular truncate">{number}</span>
          <DocStatusChip status={status} />
        </span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {subtitle}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="text-title-sm tabular block">{amount}</span>
        {secondary && (
          <span className="text-caption text-text-tertiary tabular block">
            {secondary}
          </span>
        )}
      </span>

      {actions && <span className="flex shrink-0 gap-2">{actions}</span>}
    </div>
  );
}
