"use client";

import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppRoutes, clientDetailPath } from "@/config/routes";
import { DoctorFilter } from "@/features/doctors/components/doctor-filter";
import { ReceiptPrintButton } from "@/features/receipt/components/receipt-print-button";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import {
  FilterBar,
  FilterSelect,
  SortSelect,
} from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ReasonDialog } from "@/shared/components/feedback/reason-dialog";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import type { DateRange } from "@/shared/domain/date-range";
import { activeRangeLabel } from "@/shared/domain/date-range-label";
import { ORDER_TYPE_LABEL, type OrderType } from "@/shared/domain/order-type";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { hhmm, isToday, shortDate, shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/lib/utils";

import type { OrderFilter } from "../api/orders-api";
import { useCancelOrder, useDeleteOrder, useOrdersQuery } from "../hooks/use-orders";
import { shortOrderNumber, type OrderDetail, type OrderSummary } from "../types/order";
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
import {
  DEBT_FILTERS,
  ORDERINGS,
  orderListSearchParams,
  useOrderUrlFilter,
  type DebtFilterValue,
  type OrderingValue,
} from "../hooks/use-order-url-filter";

const PAGE_SIZE = 20;

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

  /*
   * The URL is where this list keeps its state (see `use-order-url-filter`):
   * every filter below is seeded from it, and written back to it as it changes.
   * That is what brings the desk back to the SAME list after opening a client
   * card from a row and pressing Back.
   *
   * With nothing in the URL the list opens on TODAY. Reception's question is
   * almost always "what has been sold today", and answering it used to cost a
   * filter click on every visit while the first screen showed months of
   * history. The chip's ✕ opens the whole history again.
   */
  const urlFilter = useOrderUrlFilter(searchParams);

  const [search, setSearch] = useState(urlFilter.search);
  const [range, setRange] = useState<DateRange | null>(urlFilter.range);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(
    urlFilter.paymentType,
  );
  const [orderType, setOrderType] = useState<OrderType | null>(urlFilter.orderType);
  const [doctorId, setDoctorId] = useState<string | null>(urlFilter.doctorId);
  const [debtFilter, setDebtFilter] = useState<DebtFilterValue | null>(
    urlFilter.debtFilter,
  );
  const [ordering, setOrdering] = useState<OrderingValue>(urlFilter.ordering);
  const [page, setPage] = useState(urlFilter.page);

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
      doctorId,
      // "any"/"none" are the has_debt question; a named state is debt_status,
      // which only means anything on an order that carries a debt at all.
      hasDebt: debtFilter === null ? null : debtFilter === "none" ? false : true,
      debtStatus:
        debtFilter === null || debtFilter === "any" || debtFilter === "none"
          ? null
          : debtFilter,
      ordering,
    }),
    [debouncedSearch, range, paymentType, orderType, doctorId, debtFilter, ordering],
  );

  const list = useOrdersQuery(filter, page);

  // Mirror the state into the URL — `replace`, so the history holds one entry
  // per visit rather than one per keystroke, and the search is the debounced
  // value for the same reason.
  const urlState = orderListSearchParams({
    range,
    paymentType,
    orderType,
    doctorId,
    debtFilter,
    ordering,
    search: debouncedSearch,
    page,
  });
  useEffect(() => {
    if (urlState === searchParams.toString()) return;
    router.replace(urlState ? `${AppRoutes.orders}?${urlState}` : AppRoutes.orders, {
      scroll: false,
    });
  }, [urlState, searchParams, router]);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function clearAll() {
    setSearch("");
    setRange(null);
    setPaymentType(null);
    setOrderType(null);
    setDoctorId(null);
    setDebtFilter(null);
    setPage(1);
  }

  /** A change to an order that isn't today's goes through the PIN gate. */
  function runGated(order: OrderDetail, action: (pin?: string) => void) {
    if (isToday(order.createdAt)) action();
    else pinGate.requestPin((pin) => action(pin));
  }

  const extraCount = [doctorId, debtFilter].filter((value) => value !== null).length;

  const chips = [
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
    ...(doctorId
      ? [
          {
            id: "doctor",
            label: "Shifokor tanlangan",
            onClear: () => reset(setDoctorId)(null),
          },
        ]
      : []),
    ...(debtFilter
      ? [
          {
            id: "debt",
            label:
              DEBT_FILTERS.find((item) => item.value === debtFilter)?.label ?? "Qarz",
            onClear: () => reset(setDebtFilter)(null),
          },
        ]
      : []),
    ...(debouncedSearch.trim()
      ? [
          {
            id: "search",
            label: `“${debouncedSearch.trim()}”`,
            onClear: () => reset(setSearch)(""),
          },
        ]
      : []),
  ];

  return (
    <PageContainer className="flex flex-col gap-4">
      <FilterBar
        extraCount={extraCount}
        extra={
          <>
            <DoctorFilter value={doctorId} onChange={reset(setDoctorId)} />
            <FilterSelect
              label="Qarz holati"
              value={debtFilter}
              onChange={reset(setDebtFilter)}
              options={DEBT_FILTERS}
              allLabel="Qarzi bor-yo'q"
              width="w-[180px]"
            />
            <SortSelect
              value={ordering}
              onChange={reset(setOrdering)}
              options={ORDERINGS}
            />
          </>
        }
        action={
          <Button onClick={() => router.push(AppRoutes.newOrder)}>
            <Plus className="size-4" aria-hidden />
            Yangi buyurtma
          </Button>
        }
      >
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Raqam, ism yoki telefon…"
          className="w-full sm:w-[280px]"
        />
        <DateFilter value={range} onChange={reset(setRange)} />
        <FilterSelect
          label="To'lov turi"
          value={paymentType}
          onChange={reset(setPaymentType)}
          options={PAYMENT_TYPES.map((type) => ({
            value: type,
            label: PAYMENT_TYPE_LABEL[type],
          }))}
          allLabel="Barcha to'lovlar"
        />
        <FilterSelect
          label="Buyurtma turi"
          value={orderType}
          onChange={reset(setOrderType)}
          options={[
            { value: "clinic", label: ORDER_TYPE_LABEL.clinic },
            { value: "delivery", label: ORDER_TYPE_LABEL.delivery },
          ]}
          allLabel="Barcha turlar"
          width="w-[160px]"
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ActiveFilters filters={chips} onClearAll={clearAll} className="min-w-0 flex-1" />
        {list.data && (
          <span className="text-caption text-text-tertiary tabular shrink-0">
            {list.data.count} ta buyurtma
          </span>
        )}
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={9} height={56} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Buyurtma topilmadi"
            message="Tanlangan filtr bo'yicha buyurtmalar mavjud emas."
            action={
              chips.length > 0 ? (
                <Button variant="outline" onClick={clearAll}>
                  Filtrlarni tozalash
                </Button>
              ) : undefined
            }
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

/*
 * Fixed columns, and the ONE flexible column is the client — the only cell
 * whose content has no natural width. Everything else is a number, a badge or a
 * name that truncates, so nothing here can wrap a row onto a second line.
 */
const GRID =
  "grid grid-cols-[74px_96px_minmax(180px,1.4fr)_minmax(118px,1fr)_48px_130px_100px_36px] items-center gap-2.5 px-4";

function OrdersTableHeader() {
  const columns = [
    { label: "Raqam" },
    { label: "Sana" },
    { label: "Mijoz" },
    { label: "Shifokor" },
    { label: "Dona", right: true },
    { label: "Summa", right: true },
    { label: "To'lov" },
    { label: "" },
  ];

  return (
    <div className={cn(GRID, "border-border bg-surface-alt/40 border-b py-2.5")}>
      {columns.map((column, index) => (
        <span
          key={column.label || index}
          className={cn(
            "text-label-xs text-text-tertiary truncate uppercase",
            column.right && "text-right",
          )}
        >
          {column.label}
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
        "hover:bg-surface-hover focus-visible:ring-ring cursor-pointer py-2.5 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      <div className="min-w-0" title={order.orderNumber}>
        <span
          className={cn(
            "text-title-sm tabular block truncate",
            cancelled && "line-through",
          )}
        >
          {shortOrderNumber(order.orderNumber)}
        </span>
      </div>

      {/* Day, month, year and the clock — the whole stamp, because a list that
          spans a period turns a bare "16:56" into a guess. */}
      <div className="min-w-0">
        <span className="text-body-sm tabular block truncate">
          {shortDate(order.createdAt)}
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
          size={30}
        />
        <div className="min-w-0 flex-1">
          {order.clientId ? (
            <Link
              href={clientDetailPath(order.clientId)}
              onClick={(event) => event.stopPropagation()}
              className="text-title-sm focus-visible:ring-ring inline-block max-w-full truncate rounded-sm align-bottom hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {order.clientName || "Mijoz"}
            </Link>
          ) : (
            <span className="text-title-sm block truncate">
              {order.clientName || "Mijoz"}
            </span>
          )}
          <div className="flex min-w-0 items-center gap-1 overflow-hidden">
            <span className="text-caption text-text-tertiary tabular shrink-0">
              {phoneFromApi(order.clientPhone)}
            </span>
            <GiftBadge order={order} />
            <OrderTypeBadge order={order} />
            <BuyerTypeBadge order={order} />
            <AppOrderBadge order={order} />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        {order.doctorName ? (
          <span className="flex min-w-0 items-center gap-2">
            <AppAvatar
              name={order.doctorName}
              imageUrl={order.doctorAvatarUrl}
              size={24}
            />
            <span className="text-body-sm text-text-secondary truncate">
              {order.doctorName}
            </span>
          </span>
        ) : (
          <span className="text-body-sm text-text-tertiary">—</span>
        )}
      </div>

      <span className="text-body-sm tabular text-right">{order.itemCount}</span>

      {/* Total on top, and what is still owed under it: a sale billed at
          6 610 000 with 6 000 000 outstanding is a different fact from a paid
          one, and the list used to show them identically. */}
      <div className="min-w-0 text-right">
        <span className="text-title-sm tabular block">
          {money.plain(order.totalAmount)}
        </span>
        {order.hasDebt && order.debtRemaining > 0 && (
          <span className="text-caption tabular text-warning block">
            qarz {money.plain(order.debtRemaining)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap gap-1">
        {cancelled ? (
          <span className="bg-danger/12 text-label-xs text-danger rounded-full px-2 py-0.5">
            Bekor
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
        "hover:bg-surface-hover flex w-full flex-col gap-2.5 px-4 py-3 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("text-title-sm tabular", cancelled && "line-through")}
          title={order.orderNumber}
        >
          {shortOrderNumber(order.orderNumber)}
        </span>
        <span className="text-caption text-text-tertiary tabular">
          {shortDateTime(order.createdAt)}
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
          </p>
        </div>
        {/* The numbers a card used to drop entirely: how many units, and — when
            it differs from the bill — what actually reached the till. */}
        <div className="shrink-0 text-right">
          <p className="text-caption text-text-tertiary tabular">
            {order.itemCount} dona
          </p>
          {order.paidAmount !== order.totalAmount && (
            <p className="text-caption text-text-secondary tabular">
              kassa {money.plain(order.paidAmount)}
            </p>
          )}
        </div>
      </div>

      {order.doctorName && (
        <div className="flex items-center gap-2">
          <AppAvatar name={order.doctorName} imageUrl={order.doctorAvatarUrl} size={22} />
          <span className="text-caption text-text-secondary truncate">
            {order.doctorName}
          </span>
        </div>
      )}

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
