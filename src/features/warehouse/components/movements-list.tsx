"use client";

import {
  ArrowDownLeft,
  ClipboardCheck,
  Gift,
  History,
  ShoppingCart,
  Trash2,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { shortDateTime } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import type { MovementFilter } from "../api/warehouse-api";
import { useMovementsQuery } from "../hooks/use-warehouse";
import {
  FILTERABLE_MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
  movementSourceLabel,
  movementTypeLabel,
  packagedQuantityLabel,
  signedQuantityLabel,
  type StockMovement,
  type StockMovementType,
} from "../types/movement";

const PAGE_SIZE = 20;
const ALL = "__all__";

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
 */
export function MovementsList({ productId }: { productId?: string | null }) {
  const [type, setType] = useState<StockMovementType | null>(null);
  const [page, setPage] = useState(1);

  const filter = useMemo<MovementFilter>(
    () => ({ productId: productId ?? null, type }),
    [productId, type],
  );
  const list = useMovementsQuery(filter, page);

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={type ?? ALL}
        onValueChange={(value) => {
          setType(value === ALL ? null : (value as StockMovementType));
          setPage(1);
        }}
      >
        <SelectTrigger className="h-[38px] w-[220px]">
          <SelectValue placeholder="Barcha harakatlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Barcha harakatlar</SelectItem>
          {FILTERABLE_MOVEMENT_TYPES.map((option) => (
            <SelectItem key={option} value={option}>
              {MOVEMENT_TYPE_LABEL[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending || !list.data ? (
        <ListSkeleton rows={8} height={56} />
      ) : list.data.results.length === 0 ? (
        <EmptyState icon={History} title="Harakat yo'q" />
      ) : (
        <>
          <ul
            className="divide-border/60 border-border divide-y rounded-md border"
            style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
            aria-busy={list.isPlaceholderData}
          >
            {list.data.results.map((movement) => (
              <li key={movement.id}>
                <MovementRow movement={movement} />
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

function MovementRow({ movement }: { movement: StockMovement }) {
  const Icon = ICON[movement.type];
  const inbound = movement.quantity > 0;
  const packaged = packagedQuantityLabel(movement);

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
        <span className="text-title-sm block truncate">{movement.productName}</span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {movementTypeLabel(movement)} · {shortDateTime(movement.createdAt)}
          {movement.source && ` · ${movementSourceLabel(movement.source)}`}
          {movement.createdByName !== "" && ` · ${movement.createdByName}`}
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
          qoldiq {movement.balanceAfter}
        </span>
      </span>
    </div>
  );
}
