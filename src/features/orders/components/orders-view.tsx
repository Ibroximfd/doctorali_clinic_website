"use client";

import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AppRoutes, clientDetailPath } from "@/config/routes";
import { ReceiptPrintButton } from "@/features/receipt/components/receipt-print-button";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DateRangePicker } from "@/shared/components/data-display/date-range-picker";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ReasonDialog } from "@/shared/components/feedback/reason-dialog";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { resolveRange, type DateRange } from "@/shared/domain/date-range";
import { activeRangeLabel } from "@/shared/domain/date-range-label";
import { ORDER_TYPE_LABEL, type OrderType } from "@/shared/domain/order-type";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { dayMonthTime, hhmm, isToday } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/lib/utils";

import type { OrderFilter } from "../api/orders-api";
import { useCancelOrder, useDeleteOrder, useOrdersQuery } from "../hooks/use-orders";
import type { OrderDetail, OrderSummary } from "../types/order";
import {
  AppOrderBadge,
  BuyerTypeBadge,
  GiftBadge,
  OrderDebtBadge,
  OrderTypeBadge,
  PaymentBadge,
} from "./order-badges";
import { useStartOrderEdit } from "@/features/new-order/hooks/use-start-order-edit";

import { OrderDetailDialog } from "./order-detail-dialog";
import { useOrderUrlFilter } from "../hooks/use-order-url-filter";

const PAGE_SIZE = 20;
const ALL = "__all__";

/**
 * "Buyurtmalar" — the sales history.
 *
 * The dashboard links here carrying a period and a till (`?period=&from=&to=
 * &payment_type=`), so the desk can drill from a filtered statistics card into
 * the exact orders behind those figures without re-applying the filter.
 */
export function OrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 63.98rem)");

  const urlFilter = useOrderUrlFilter(searchParams);

  const [search, setSearch] = useState("");
  /*
   * The list opens on TODAY. Reception's question is almost always "what has
   * been sold today", and answering it used to cost a filter click on every
   * visit while the first screen showed months of history. A link from the
   * dashboard still wins — it arrives with the period it was filtered by — and
   * the chip's ✕ opens the whole history again.
   */
  const [range, setRange] = useState<DateRange | null>(
    () => urlFilter.range ?? resolveRange("daily"),
  );
  const [paymentType, setPaymentType] = useState<PaymentType | null>(
    urlFilter.paymentType,
  );
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<OrderDetail | null>(null);
  const [deleting, setDeleting] = useState<OrderDetail | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const pinGate = usePinGate();
  const cancel = useCancelOrder();
  const edit = useStartOrderEdit();
  const remove = useDeleteOrder();

  const filter = useMemo<OrderFilter>(
    () => ({
      search: debouncedSearch,
      range,
      paymentType,
      orderType,
      ordering: "-created_at",
    }),
    [debouncedSearch, range, paymentType, orderType],
  );

  const list = useOrdersQuery(filter, page);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  /** A change to an order that isn't today's goes through the PIN gate. */
  function runGated(order: OrderDetail, action: (pin?: string) => void) {
    if (isToday(order.createdAt)) action();
    else pinGate.requestPin((pin) => action(pin));
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Raqam, ism yoki telefon…"
          className="w-full sm:w-[300px]"
        />
        <DateRangePicker value={range} onChange={reset(setRange)} />
        <Select
          value={paymentType ?? ALL}
          onValueChange={reset((value: string) =>
            setPaymentType(value === ALL ? null : (value as PaymentType)),
          )}
        >
          <SelectTrigger className="w-[170px]" aria-label="To'lov turi">
            <SelectValue placeholder="Barcha to'lovlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Barcha to&rsquo;lovlar</SelectItem>
            {PAYMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {PAYMENT_TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={orderType ?? ALL}
          onValueChange={reset((value: string) =>
            setOrderType(value === ALL ? null : (value as OrderType)),
          )}
        >
          <SelectTrigger className="w-[160px]" aria-label="Buyurtma turi">
            <SelectValue placeholder="Klinika + Dastavka" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Barcha turlar</SelectItem>
            <SelectItem value="clinic">{ORDER_TYPE_LABEL.clinic}</SelectItem>
            <SelectItem value="delivery">{ORDER_TYPE_LABEL.delivery}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => router.push(AppRoutes.newOrder)}>
          <Plus className="size-4" aria-hidden />
          Yangi buyurtma
        </Button>
      </div>

      <ActiveFilters
        filters={[
          ...(range
            ? [
                {
                  id: "range",
                  label: activeRangeLabel(range),
                  emphasized: true,
                  onClear: () => reset(setRange)(null),
                },
              ]
            : []),
          ...(paymentType
            ? [
                {
                  id: "payment",
                  label: PAYMENT_TYPE_LABEL[paymentType],
                  onClear: () => reset(setPaymentType)(null),
                },
              ]
            : []),
          ...(orderType
            ? [
                {
                  id: "orderType",
                  label: ORDER_TYPE_LABEL[orderType],
                  onClear: () => reset(setOrderType)(null),
                },
              ]
            : []),
        ]}
      />

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={9} height={64} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Buyurtma topilmadi"
            message="Tanlangan filtr bo'yicha buyurtmalar mavjud emas."
          />
        ) : (
          <>
            {!isMobile && <OrdersTableHeader />}
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((order, index) => (
                <li
                  key={order.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  {isMobile ? (
                    <OrderCard order={order} onOpen={() => setDetailId(order.id)} />
                  ) : (
                    <OrderTableRow order={order} onOpen={() => setDetailId(order.id)} />
                  )}
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
        onEdit={(order) => {
          setDetailId(null);
          void edit.start(order);
        }}
        onCancel={(order) => {
          setDetailId(null);
          setCancelling(order);
        }}
        onDelete={(order) => {
          setDetailId(null);
          setDeleting(order);
        }}
      />

      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        busy={cancel.isPending}
        title="Buyurtmani bekor qilish"
        description={
          cancelling
            ? `${cancelling.orderNumber} · ${money.uzs(cancelling.totalAmount)}`
            : undefined
        }
        confirmLabel="Bekor qilish"
        onConfirm={(reason) => {
          const order = cancelling;
          setCancelling(null);
          if (!order) return;
          runGated(order, (pin) =>
            cancel.mutate({ id: order.id, reason, confirmPin: pin ?? null }),
          );
        }}
      />

      <ReasonDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        busy={remove.isPending}
        title="Buyurtmani butunlay o'chirish"
        description={
          deleting
            ? `${deleting.orderNumber} har qanday ro'yxat va hisobotdan yo'qoladi. Bekor qilish esa uni tarixda qoldiradi.`
            : undefined
        }
        confirmLabel="O'chirish"
        onConfirm={(reason) => {
          const order = deleting;
          setDeleting(null);
          if (!order) return;
          // A delete ALWAYS needs the PIN, whatever day the order is from.
          pinGate.requestPin((pin) =>
            remove.mutate({ id: order.id, reason, confirmPin: pin }),
          );
        }}
      />

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
      />
    </PageContainer>
  );
}

const GRID =
  "grid grid-cols-[150px_minmax(0,1fr)_130px_84px_130px_120px_92px] items-center gap-3 px-5";

function OrdersTableHeader() {
  return (
    <div className={cn(GRID, "border-border bg-surface-alt/40 border-b py-3")}>
      {["Raqam", "Mijoz", "Shifokor", "Dona", "Summa", "Holat", ""].map((label, i) => (
        <span
          key={label || i}
          className={cn(
            "text-label-xs text-text-tertiary uppercase",
            (i === 3 || i === 4) && "text-right",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function OrderTableRow({ order, onOpen }: { order: OrderSummary; onOpen: () => void }) {
  const cancelled = order.status === "cancelled";

  return (
    /*
     * The whole row opens the order — reception aims at the client's name far
     * more often than at the number, and a row where only one word is clickable
     * reads as broken. The client link and the row menu inside it stop the
     * event so they still do their own job.
     */
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${order.orderNumber} buyurtmasini ochish`}
      className={cn(
        GRID,
        "hover:bg-surface-hover focus-visible:ring-ring cursor-pointer py-3 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      <div>
        <span className={cn("text-title-sm tabular block", cancelled && "line-through")}>
          {order.orderNumber}
        </span>
        <span className="text-caption text-text-tertiary tabular block">
          {hhmm(order.createdAt)}
        </span>
      </div>

      {/*
        Name first, markers under it. They used to sit BESIDE the name in a
        `shrink-0` box, which squeezed the name to nothing and pushed the badges
        over the next column as soon as an order had a debt and a gift.
      */}
      <div className="flex min-w-0 items-center gap-2.5">
        <AppAvatar
          name={order.clientName || "Mijoz"}
          imageUrl={order.clientAvatarUrl}
          size={32}
        />
        <div className="min-w-0 flex-1">
          {order.clientId ? (
            <Link
              href={clientDetailPath(order.clientId)}
              onClick={(event) => event.stopPropagation()}
              className="text-title-sm focus-visible:ring-ring block truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {order.clientName || "Mijoz"}
            </Link>
          ) : (
            <span className="text-title-sm block truncate">
              {order.clientName || "Mijoz"}
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
            <span className="text-caption text-text-tertiary tabular truncate">
              {phoneFromApi(order.clientPhone)}
            </span>
            <OrderDebtBadge order={order} />
            <GiftBadge order={order} />
            <OrderTypeBadge order={order} />
            <BuyerTypeBadge order={order} />
            <AppOrderBadge order={order} />
          </div>
        </div>
      </div>

      <span className="text-body-sm text-text-secondary truncate">
        {order.doctorName ? (
          <span className="flex min-w-0 items-center gap-2">
            <AppAvatar
              name={order.doctorName}
              imageUrl={order.doctorAvatarUrl}
              size={26}
            />
            <span className="truncate">{order.doctorName}</span>
          </span>
        ) : (
          "—"
        )}
      </span>
      <span className="text-body-sm tabular text-right">{order.itemCount}</span>
      <span className="text-title-sm tabular text-right">
        {money.plain(order.totalAmount)}
      </span>

      <div className="flex flex-wrap gap-1">
        {cancelled ? (
          <span className="bg-danger/12 text-label-xs text-danger rounded-full px-2 py-0.5">
            Bekor qilingan
          </span>
        ) : (
          <PaymentBadge order={order} />
        )}
      </div>

      <div className="flex justify-end">
        {!cancelled && <ReceiptPrintButton orderId={order.id} />}
      </div>
    </div>
  );
}

function OrderCard({ order, onOpen }: { order: OrderSummary; onOpen: () => void }) {
  const cancelled = order.status === "cancelled";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "hover:bg-surface-hover flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("text-title-sm tabular", cancelled && "line-through")}>
          {order.orderNumber}
        </span>
        <span className="text-caption text-text-tertiary">
          {dayMonthTime(order.createdAt)}
        </span>
        <span className="text-title tabular ml-auto">
          {money.plain(order.totalAmount)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <AppAvatar
          name={order.clientName || "Mijoz"}
          imageUrl={order.clientAvatarUrl}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm truncate">{order.clientName || "Mijoz"}</p>
          <p className="text-caption text-text-tertiary tabular truncate">
            {phoneFromApi(order.clientPhone)}
            {order.doctorName && ` · ${order.doctorName}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {cancelled ? (
          <span className="bg-danger/12 text-label-xs text-danger rounded-full px-2 py-0.5">
            Bekor qilingan
          </span>
        ) : (
          <PaymentBadge order={order} />
        )}
        <OrderDebtBadge order={order} />
        <GiftBadge order={order} />
        <OrderTypeBadge order={order} />
        <BuyerTypeBadge order={order} />
        <AppOrderBadge order={order} />
      </div>
    </button>
  );
}
